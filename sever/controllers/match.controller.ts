import { sql, poolPromise } from '../config/db';
import { getIO } from '../socket/index';
import { createNotification } from './notification.controller';
import dotenv from 'dotenv';
dotenv.config();

const COMMISSION = parseFloat(process.env.COMMISSION_RATE) || 0.05;

const toMinutes = (t: string): number => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
};

const FORMAT_PLAYERS: Record<string, number> = { '1v1': 2, '2v2': 4 };

const REFUND_FULL_HOURS = 4;
const REFUND_NO_REFUND_FROM_HOURS = 2;

const pad2 = (value: number): string => String(value).padStart(2, '0');

const toLocalDateOnly = (matchDate: any): string => {
    if (matchDate instanceof Date) {
        return `${matchDate.getFullYear()}-${pad2(matchDate.getMonth() + 1)}-${pad2(matchDate.getDate())}`;
    }

    const raw = String(matchDate || '').trim();
    if (!raw) return '';

    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
        return raw.slice(0, 10);
    }

    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
        return `${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}-${pad2(parsed.getDate())}`;
    }

    return raw;
};

const getHoursUntilMatchStart = (matchDate: any, startTime: any): number => {
    const dateStr = toLocalDateOnly(matchDate);
    const timeStr = String(startTime || '').slice(0, 8);

    if (!dateStr || !timeStr) {
        return Number.NEGATIVE_INFINITY;
    }

    const startAt = new Date(`${dateStr}T${timeStr}`);

    if (Number.isNaN(startAt.getTime())) {
        return Number.NEGATIVE_INFINITY;
    }

    return (startAt.getTime() - Date.now()) / 3_600_000;
};

const evaluateRefundPolicyForLeave = (hoursUntil: number) => {
    if (hoursUntil >= REFUND_FULL_HOURS) {
        return {
            status: 'full',
            shouldRefund: true,
            message: 'Hoàn tiền 100% vì hủy trước 4 giờ.'
        };
    }

    if (hoursUntil >= REFUND_NO_REFUND_FROM_HOURS && hoursUntil < REFUND_FULL_HOURS) {
        return {
            status: 'none',
            shouldRefund: false,
            message: 'Không hoàn tiền vì hủy trong khoảng 2–4 giờ trước trận.'
        };
    }

    return {
        status: 'none',
        shouldRefund: false,
        message: 'Không hoàn tiền vì hủy trong vòng 2 giờ trước trận.'
    };
};

const getUserBalance = async (userId: number): Promise<number> => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('id', sql.Int, userId)
        .query('SELECT ISNULL(balance, 0) AS balance FROM users WHERE id = @id');
    return Number(result.recordset?.[0]?.balance || 0);
};

const refundCompletedMatchPaymentsToBalance = async (
    matchId: number,
    description: string,
    targetUserId: number | null = null
) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('match_id', sql.Int, matchId)
        .input('description', sql.NVarChar, description)
        .input('target_user_id', sql.Int, targetUserId)
        .query(`
            SET XACT_ABORT ON;

            BEGIN TRY
                BEGIN TRAN;

            DECLARE @refunded TABLE (
                payment_id INT,
                user_id INT,
                amount DECIMAL(12,2)
            );

            UPDATE payments
            SET status = 'refunded'
            OUTPUT INSERTED.id, INSERTED.user_id, INSERTED.amount
            INTO @refunded(payment_id, user_id, amount)
            WHERE match_id = @match_id
              AND status = 'completed'
              AND (@target_user_id IS NULL OR user_id = @target_user_id);

            UPDATE u
            SET u.balance = ISNULL(u.balance, 0) + x.total_amount
            FROM users u
            JOIN (
                SELECT user_id, SUM(amount) AS total_amount
                FROM @refunded
                GROUP BY user_id
            ) x ON x.user_id = u.id;

            IF OBJECT_ID('wallet_transactions', 'U') IS NOT NULL
            BEGIN
                INSERT INTO wallet_transactions (
                    user_id, payment_id, amount, type, description, reference_type, reference_id, status
                )
                SELECT user_id, payment_id, amount, 'refund', @description, 'match', @match_id, 'completed'
                FROM @refunded;
            END

                COMMIT TRAN;
            END TRY
            BEGIN CATCH
                IF @@TRANCOUNT > 0 ROLLBACK TRAN;
                THROW;
            END CATCH

            SELECT
                COUNT(1) AS refunded_count,
                ISNULL(SUM(amount), 0) AS refunded_total
            FROM @refunded;
        `);

    return {
        refundedCount: Number(result.recordset?.[0]?.refunded_count || 0),
        refundedTotal: Number(result.recordset?.[0]?.refunded_total || 0)
    };
};

// ── Create Match ─────────────────────────────────────────────────────────────
export const createMatch = async (req, res) => {
    try {
        const {
            court_id, sub_court_id, match_date, start_time, end_time,
            max_players, format = '2v2', skill_level = 'all', description
        } = req.body;
        const pool = await poolPromise;

        if (!['1v1', '2v2'].includes(format))
            return res.status(400).json({ message: 'Format không hợp lệ. Chọn 1v1 hoặc 2v2' });

        const mp = max_players ?? FORMAT_PLAYERS[format] ?? 4;

        let pricingRow: any;
        if (sub_court_id) {
            const r = await pool.request()
                .input('id', sql.Int, sub_court_id)
                .input('court_id', sql.Int, court_id)
                .query(`SELECT price_per_hour, 
                               CONVERT(NVARCHAR(5), peak_start_time, 108) AS peak_start_time, 
                               CONVERT(NVARCHAR(5), peak_end_time, 108) AS peak_end_time, 
                               peak_price_per_hour,
                               weekend_price_per_hour, min_booking_minutes, slot_step_minutes
                        FROM sub_courts WHERE id = @id AND court_id = @court_id`);
            if (r.recordset.length === 0) return res.status(404).json({ message: 'Sân con không tồn tại' });
            pricingRow = r.recordset[0];
        } else {
            const r = await pool.request().input('id', sql.Int, court_id)
                .query('SELECT price_per_hour, peak_start_time, peak_end_time, peak_price, weekend_price, is_active FROM courts WHERE id = @id');
            if (r.recordset.length === 0 || !r.recordset[0].is_active)
                return res.status(404).json({ message: 'Sân không tồn tại hoặc không hoạt động' });
            const c = r.recordset[0];
            pricingRow = {
                price_per_hour: c.price_per_hour || 100000,
                peak_start_time: c.peak_start_time, peak_end_time: c.peak_end_time,
                peak_price_per_hour: c.peak_price || 0,
                weekend_price_per_hour: c.weekend_price || 0,
                min_booking_minutes: 30, slot_step_minutes: 30
            };
        }

        const duration = toMinutes(end_time) - toMinutes(start_time);
        if (duration <= 0)
            return res.status(400).json({ message: 'Thời gian kết thúc phải sau thời gian bắt đầu' });
        if (duration < pricingRow.min_booking_minutes)
            return res.status(400).json({ message: `Thời lượng tối thiểu là ${pricingRow.min_booking_minutes} phút` });

        // Conflict check — no overlapping matches on same court
        const conflict = await pool.request()
            .input('court_id', sql.Int, court_id)
            .input('match_date', sql.Date, match_date)
            .input('start_time', sql.NVarChar, start_time)
            .input('end_time', sql.NVarChar, end_time)
            .query(`SELECT id FROM matches
                    WHERE court_id = @court_id AND match_date = @match_date
                      AND status NOT IN ('cancelled','completed','finished')
                      AND start_time < @end_time AND end_time > @start_time`);
        if (conflict.recordset.length > 0)
            return res.status(409).json({ message: 'Sân đã có trận khác trong khung giờ này' });

        // Price calculation
        let unitPrice = pricingRow.price_per_hour;
        const dayOfWeek = new Date(match_date).getDay();
        if ((dayOfWeek === 0 || dayOfWeek === 6) && pricingRow.weekend_price_per_hour > 0) {
            unitPrice = pricingRow.weekend_price_per_hour;
        } else if (
            pricingRow.peak_start_time && pricingRow.peak_end_time &&
            start_time >= pricingRow.peak_start_time && end_time <= pricingRow.peak_end_time &&
            pricingRow.peak_price_per_hour > 0
        ) {
            unitPrice = pricingRow.peak_price_per_hour;
        }
        const total_cost = Math.ceil((unitPrice / 60) * duration);
        const price_per_player = Math.ceil(total_cost / mp);

        // Insert match
        const result = await pool.request()
            .input('creator_id', sql.Int, req.user.id).input('court_id', sql.Int, court_id)
            .input('match_date', sql.Date, match_date).input('start_time', sql.NVarChar, start_time)
            .input('end_time', sql.NVarChar, end_time).input('max_players', sql.Int, mp)
            .input('total_cost', sql.Decimal(12, 2), total_cost).input('commission_rate', sql.Decimal(4, 2), COMMISSION)
            .input('format', sql.NVarChar, format).input('skill_level', sql.NVarChar, skill_level)
            .input('description', sql.NVarChar, description || null)
            .query(`INSERT INTO matches
                      (creator_id, court_id, match_date, start_time, end_time, max_players,
                       total_cost, commission_rate, format, skill_level, description, status)
                    OUTPUT INSERTED.id
                    VALUES (@creator_id, @court_id, @match_date, @start_time, @end_time, @max_players,
                            @total_cost, @commission_rate, @format, @skill_level, @description, 'waiting')`);

        const matchId = result.recordset[0].id;

        // Add host as first player (payment pending — must pay via PayOS)
        await pool.request()
            .input('match_id', sql.Int, matchId).input('user_id', sql.Int, req.user.id)
            .input('amount_due', sql.Decimal(12, 2), price_per_player)
            .query("INSERT INTO match_players (match_id, user_id, amount_due, status, payment_status) VALUES (@match_id, @user_id, @amount_due, 'joined', 'pending')");

        // Create match chat room
        const room = await pool.request()
            .input('match_id', sql.Int, matchId).input('name', sql.NVarChar, `Trận #${matchId}`)
            .query('INSERT INTO chat_rooms (match_id, name) OUTPUT INSERTED.id VALUES (@match_id, @name)');
        const chatRoomId = room.recordset[0].id;

        await pool.request()
            .input('chat_room_id', sql.Int, chatRoomId).input('user_id', sql.Int, req.user.id)
            .query('INSERT INTO chat_room_members (chat_room_id, user_id) VALUES (@chat_room_id, @user_id)');

        // Get court + facility info for notification and auto post content
        const courtOwner = await pool.request()
            .input('court_id', sql.Int, court_id)
            .query(`
                SELECT f.owner_id, f.name AS facility_name, c.name AS court_name
                FROM courts c
                JOIN facilities f ON c.facility_id = f.id
                WHERE c.id = @court_id
            `);

        // Auto-create feed post with type=find_player whenever a match is created
        try {
            const matchDateText = new Date(match_date).toLocaleDateString('vi-VN');
            const courtName = courtOwner.recordset?.[0]?.court_name || `Sân #${court_id}`;
            const facilityName = courtOwner.recordset?.[0]?.facility_name || 'Cơ sở chưa xác định';
            const skillLabel = skill_level && skill_level !== 'all' ? `, trình độ ${skill_level}` : '';
            const descText = description?.trim() ? `\nGhi chú: ${description.trim()}` : '';

            const postContent =
                `🎯 Tìm người chơi ${format} tại ${courtName} (${facilityName})\n` +
                `🗓️ ${matchDateText} | ⏰ ${start_time} - ${end_time}${skillLabel}\n` +
                `💰 ${price_per_player.toLocaleString('vi-VN')}đ/người\n` +
                `🎮 Trận #${matchId}${descText}`;

            const postInsert = await pool.request()
                .input('user_id', sql.Int, req.user.id)
                .input('content', sql.NVarChar(sql.MAX), postContent)
                .input('post_type', sql.NVarChar, 'find_player')
                .query(`INSERT INTO posts (user_id, content, post_type)
                        OUTPUT INSERTED.id
                        VALUES (@user_id, @content, @post_type)`);

            const createdPostId = postInsert.recordset[0].id;
            const createdPostRes = await pool.request()
                .input('id', sql.Int, createdPostId)
                .query(`SELECT p.*, u.full_name AS user_name, u.avatar, u.role AS user_role,
                    (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) AS likes,
                    (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comments,
                    (SELECT COUNT(*) FROM post_shares ps WHERE ps.post_id = p.id) AS shares
                    FROM posts p JOIN users u ON p.user_id = u.id WHERE p.id = @id`);

            const createdPost = createdPostRes.recordset[0];
            if (createdPost?.created_at) {
                createdPost.created_at = new Date(createdPost.created_at).toISOString();
            }
            try { getIO()?.emit('post_created', createdPost); } catch { }
        } catch (postErr) {
            console.error('[createMatch][auto-post]', postErr);
        }

        if (courtOwner.recordset.length > 0) {
            const { owner_id, facility_name, court_name } = courtOwner.recordset[0];
            const matchDateTime = `${new Date(match_date).toLocaleDateString('vi-VN')} lúc ${start_time}`;
            
            // Only notify if owner is not the creator
            if (owner_id !== req.user.id) {
                await createNotification(
                    owner_id,
                    '🎯 Có trận ghép mới trên sân',
                    `Trận ${format} tại "${court_name}" (${facility_name}) - ${matchDateTime}`,
                    'match_created',
                    matchId
                );
                try { getIO()?.to(`user_${owner_id}`).emit('new_notification'); } catch { }
            }
        }

        res.status(201).json({ message: 'Tạo trận thành công', matchId, price_per_player, total_cost, chatRoomId });
    } catch (err) {
        console.error('[createMatch]', err);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// ── Get All Matches ──────────────────────────────────────────────────────────
export const getAllMatches = async (req, res) => {
    try {
        const { status, skill_level, format } = req.query;
        const pool = await poolPromise;
        const request = pool.request();
        const conditions: string[] = [];
        request.input('user_id', sql.Int, req.user?.id || 0);
        if (status) { request.input('status', sql.NVarChar, status); conditions.push('m.status = @status'); }
        if (skill_level && skill_level !== 'all') { request.input('skill_level', sql.NVarChar, skill_level); conditions.push('m.skill_level = @skill_level'); }
        if (format) { request.input('format', sql.NVarChar, format); conditions.push('m.format = @format'); }
        const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
         const result = await request.query(`
             SELECT m.*, c.name AS court_name, f.address, u.full_name AS creator_name, u.id AS creator_id,
                 (SELECT COUNT(*) FROM match_players WHERE match_id = m.id AND status = 'joined') AS active_players,
                 CASE WHEN m.creator_id = @user_id THEN 1 ELSE 0 END AS is_creator,
                 CASE WHEN EXISTS (SELECT 1 FROM match_players WHERE match_id = m.id AND user_id = @user_id AND status IN ('joined','waitlist')) THEN 1 ELSE 0 END AS is_joined
             FROM matches m
             JOIN courts c ON m.court_id = c.id
             LEFT JOIN facilities f ON c.facility_id = f.id
             JOIN users u ON m.creator_id = u.id
             ${where}
             ORDER BY m.match_date ASC, m.start_time ASC`);
        res.json(result.recordset);
    } catch (err) {
        console.error('[getAllMatches]', err);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// ── Get My Match History ─────────────────────────────────────────────────────
export const getMyMatchHistory = async (req, res) => {
    try {
        const pool = await poolPromise;
        const uid = req.user.id;

        const result = await pool.request()
            .input('uid', sql.Int, uid)
            .query(`
                SELECT
                    m.*, c.name AS court_name, f.address,
                    u.full_name AS creator_name,
                    CASE WHEN m.creator_id = @uid THEN 1 ELSE 0 END AS is_host,
                    CASE WHEN EXISTS (
                        SELECT 1 FROM match_players mp
                        WHERE mp.match_id = m.id AND mp.user_id = @uid AND mp.status = 'joined'
                    ) THEN 1 ELSE 0 END AS is_joined,
                    CASE WHEN EXISTS (
                        SELECT 1 FROM match_players mp
                        WHERE mp.match_id = m.id AND mp.user_id = @uid AND mp.status = 'waitlist'
                    ) THEN 1 ELSE 0 END AS is_waitlisted,
                    (SELECT COUNT(*) FROM match_players mp2 WHERE mp2.match_id = m.id AND mp2.status = 'joined') AS active_players
                FROM matches m
                JOIN courts c ON m.court_id = c.id
                LEFT JOIN facilities f ON c.facility_id = f.id
                JOIN users u ON m.creator_id = u.id
                WHERE m.creator_id = @uid
                   OR EXISTS (
                        SELECT 1
                        FROM match_players mp
                        WHERE mp.match_id = m.id
                          AND mp.user_id = @uid
                          AND mp.status IN ('joined', 'waitlist')
                   )
                ORDER BY m.match_date DESC, m.start_time DESC
            `);

        res.json(result.recordset);
    } catch (err) {
        console.error('[getMyMatchHistory]', err);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// ── Get Match By ID ──────────────────────────────────────────────────────────
export const getMatchById = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('id', sql.Int, req.params.id)
            .input('user_id', sql.Int, req.user.id)
            .query(`SELECT m.*, c.name AS court_name, f.address, u.full_name AS creator_name, u.id AS creator_id,
                           cr.id AS chat_room_id,
                           CASE WHEN m.creator_id = @user_id THEN 1 ELSE 0 END AS is_creator
                    FROM matches m
                    JOIN courts c ON m.court_id = c.id
                    LEFT JOIN facilities f ON c.facility_id = f.id
                    JOIN users u ON m.creator_id = u.id
                    LEFT JOIN chat_rooms cr ON cr.match_id = m.id
                    WHERE m.id = @id`);
        if (result.recordset.length === 0) return res.status(404).json({ message: 'Không tìm thấy trận' });

        const players = await pool.request().input('match_id', sql.Int, req.params.id)
            .query(`SELECT mp.*, u.full_name, u.avatar
                    FROM match_players mp JOIN users u ON mp.user_id = u.id
                    WHERE mp.match_id = @match_id ORDER BY mp.created_at ASC`);
        res.json({ ...result.recordset[0], players: players.recordset });
    } catch (err) {
        console.error('[getMatchById]', err);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// ── Join Match ───────────────────────────────────────────────────────────────
export const joinMatch = async (req, res) => {
    try {
        const pool = await poolPromise;
        const matchRes = await pool.request().input('id', sql.Int, req.params.id)
            .query('SELECT * FROM matches WHERE id = @id');
        if (matchRes.recordset.length === 0) return res.status(404).json({ message: 'Không tìm thấy trận' });
        const m = matchRes.recordset[0];

        if (['cancelled', 'completed', 'finished'].includes(m.status))
            return res.status(400).json({ message: 'Trận đã kết thúc hoặc bị hủy' });

        // Rule 1: 1 user = 1 slot
        const existing = await pool.request()
            .input('match_id', sql.Int, req.params.id).input('user_id', sql.Int, req.user.id)
            .query("SELECT id FROM match_players WHERE match_id = @match_id AND user_id = @user_id AND status != 'left'");
        if (existing.recordset.length > 0)
            return res.status(400).json({ message: 'Bạn đã trong trận này rồi' });

        const price_per_player = Math.ceil(m.total_cost / m.max_players);
        const isWaitlist = m.current_players >= m.max_players;
        const playerStatus = isWaitlist ? 'waitlist' : 'joined';

        await pool.request()
            .input('match_id', sql.Int, req.params.id).input('user_id', sql.Int, req.user.id)
            .input('amount_due', sql.Decimal(12, 2), price_per_player)
            .input('status', sql.NVarChar, playerStatus)
            .query("INSERT INTO match_players (match_id, user_id, amount_due, status, payment_status) VALUES (@match_id, @user_id, @amount_due, @status, 'pending')");

        if (!isWaitlist) {
            const newCount = m.current_players + 1;
            const newMatchStatus = newCount >= m.max_players ? 'full' : 'waiting';
            await pool.request()
                .input('current_players', sql.Int, newCount).input('status', sql.NVarChar, newMatchStatus).input('id', sql.Int, req.params.id)
                .query('UPDATE matches SET current_players = @current_players, status = @status WHERE id = @id');
            // Add to match chat room
            const room = await pool.request().input('match_id', sql.Int, req.params.id)
                .query('SELECT id FROM chat_rooms WHERE match_id = @match_id');
            if (room.recordset.length > 0) {
                const isMember = await pool.request()
                    .input('chat_room_id', sql.Int, room.recordset[0].id).input('user_id', sql.Int, req.user.id)
                    .query('SELECT id FROM chat_room_members WHERE chat_room_id = @chat_room_id AND user_id = @user_id');
                if (isMember.recordset.length === 0) {
                    await pool.request()
                        .input('chat_room_id', sql.Int, room.recordset[0].id).input('user_id', sql.Int, req.user.id)
                        .query('INSERT INTO chat_room_members (chat_room_id, user_id) VALUES (@chat_room_id, @user_id)');
                }
            }
        }

        // Notify match creator that someone joined
        const creator = await pool.request()
            .input('id', sql.Int, m.creator_id)
            .query('SELECT full_name FROM users WHERE id = @id');
        
        if (creator.recordset.length > 0 && m.creator_id !== req.user.id) {
            const notificationTitle = isWaitlist 
                ? '⏳ Có người chờ tham gia' 
                : '✅ Có người tham gia trận';
            const notificationMsg = isWaitlist
                ? `${req.user.full_name} chờ xếp hàng cho trận #${req.params.id}`
                : `${req.user.full_name} đã tham gia trận của bạn (${m.current_players + 1}/${m.max_players})`;
            
            await createNotification(
                m.creator_id,
                notificationTitle,
                notificationMsg,
                'match_join',
                parseInt(req.params.id)
            );
            try { getIO()?.to(`user_${m.creator_id}`).emit('new_notification'); } catch { }
        }

        res.json({
            message: isWaitlist
                ? 'Đã thêm vào danh sách chờ. Bạn sẽ được thông báo khi có chỗ trống.'
                : 'Đã tham gia trận. Vui lòng thanh toán để xác nhận chỗ.',
            status: playerStatus,
            price_per_player,
            isWaitlist
        });
    } catch (err) {
        console.error('[joinMatch]', err);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// ── Leave Match ──────────────────────────────────────────────────────────────
export const leaveMatch = async (req, res) => {
    try {
        const pool = await poolPromise;
        const matchRes = await pool.request().input('id', sql.Int, req.params.id)
            .query(`
                SELECT *,
                       DATEDIFF(
                           MINUTE,
                           SYSDATETIMEOFFSET(),
                           CONVERT(
                               DATETIMEOFFSET,
                               CONVERT(NVARCHAR(10), match_date, 23) + 'T' + LEFT(CONVERT(NVARCHAR(8), start_time, 108), 8)
                           )
                       ) AS minutes_until_start
                FROM matches
                WHERE id = @id
            `);
        if (matchRes.recordset.length === 0) return res.status(404).json({ message: 'Không tìm thấy trận' });
        const m = matchRes.recordset[0];

        if (m.creator_id === req.user.id)
            return res.status(400).json({ message: 'Người tạo không thể rời trận. Hãy hủy trận nếu cần.' });

        const playerRes = await pool.request()
            .input('match_id', sql.Int, req.params.id).input('user_id', sql.Int, req.user.id)
            .query("SELECT * FROM match_players WHERE match_id = @match_id AND user_id = @user_id AND status != 'left'");
        if (playerRes.recordset.length === 0)
            return res.status(400).json({ message: 'Bạn không có trong trận này' });
        const player = playerRes.recordset[0];

        // Refund policy based on time until match
        let refundStatus = 'none';
        let refundMessage = 'Không hoàn tiền.';
        let refundedAmount = 0;
        let balanceAfter = null;
        let shouldResetPaymentStatus = false;

        if (player.payment_status === 'paid') {
            const hoursUntil = Number(m.minutes_until_start ?? Number.NEGATIVE_INFINITY) / 60;
            const policy = evaluateRefundPolicyForLeave(hoursUntil);

            refundStatus = policy.status;
            refundMessage = policy.message;

            if (policy.shouldRefund) {
                const refundResult = await refundCompletedMatchPaymentsToBalance(
                    Number(req.params.id),
                    'Hoan tien 100% do roi tran truoc 4 gio',
                    req.user.id
                );
                if (refundResult.refundedCount > 0) {
                    refundedAmount = refundResult.refundedTotal;
                    shouldResetPaymentStatus = true;
                    refundMessage = `Hoàn tiền 100% vào số dư tài khoản: ${refundResult.refundedTotal.toLocaleString('vi-VN')}đ.`;
                    balanceAfter = await getUserBalance(req.user.id);
                } else {
                    refundMessage = 'Không tìm thấy giao dịch đã thanh toán để hoàn tiền.';
                }
            }
        }

        await pool.request()
            .input('match_id', sql.Int, req.params.id).input('user_id', sql.Int, req.user.id)
            .input('reset_payment_status', sql.Bit, shouldResetPaymentStatus ? 1 : 0)
            .query(`
                UPDATE match_players
                SET status = 'left',
                    payment_status = CASE WHEN @reset_payment_status = 1 THEN 'pending' ELSE payment_status END
                WHERE match_id = @match_id AND user_id = @user_id
            `);

        if (player.status === 'joined') {
            await pool.request().input('id', sql.Int, req.params.id)
                .query("UPDATE matches SET current_players = current_players - 1, status = 'waiting' WHERE id = @id AND current_players > 0");
            // Promote first person from waitlist
            const waitlist = await pool.request().input('match_id', sql.Int, req.params.id)
                .query("SELECT TOP 1 * FROM match_players WHERE match_id = @match_id AND status = 'waitlist' ORDER BY created_at ASC");
            if (waitlist.recordset.length > 0) {
                const promoted = waitlist.recordset[0];
                await pool.request().input('id', sql.Int, promoted.id)
                    .query("UPDATE match_players SET status = 'joined' WHERE id = @id");
                await pool.request().input('id', sql.Int, req.params.id)
                    .query('UPDATE matches SET current_players = current_players + 1 WHERE id = @id');
                try {
                    getIO().to(`user_${promoted.user_id}`).emit('match_promoted', {
                        matchId: req.params.id,
                        message: 'Bạn đã được thêm vào trận từ danh sách chờ!'
                    });
                } catch (_) { /* socket not ready */ }
            }
        }

        res.json({ message: 'Đã rời trận', refundStatus, refundMessage, refundedAmount, balanceAfter });
    } catch (err) {
        console.error('[leaveMatch]', err);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// ── Get Match Messages ───────────────────────────────────────────────────────
export const getMatchMessages = async (req, res) => {
    try {
        const pool = await poolPromise;
        const playerCheck = await pool.request()
            .input('match_id', sql.Int, req.params.id).input('user_id', sql.Int, req.user.id)
            .query("SELECT id FROM match_players WHERE match_id = @match_id AND user_id = @user_id AND status = 'joined'");
        if (playerCheck.recordset.length === 0)
            return res.status(403).json({ message: 'Bạn phải tham gia trận để xem tin nhắn' });

        const room = await pool.request().input('match_id', sql.Int, req.params.id)
            .query('SELECT id FROM chat_rooms WHERE match_id = @match_id');
        if (room.recordset.length === 0) return res.json([]);

        const messages = await pool.request().input('room_id', sql.Int, room.recordset[0].id)
            .query(`SELECT cm.*, u.full_name, u.avatar
                    FROM chat_messages cm JOIN users u ON cm.user_id = u.id
                    WHERE cm.chat_room_id = @room_id ORDER BY cm.created_at ASC`);
        res.json(messages.recordset);
    } catch (err) {
        console.error('[getMatchMessages]', err);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// ── Send Match Message ───────────────────────────────────────────────────────
export const sendMatchMessage = async (req, res) => {
    try {
        const { content } = req.body;
        if (!content?.trim()) return res.status(400).json({ message: 'Nội dung không được trống' });
        const pool = await poolPromise;

        const playerCheck = await pool.request()
            .input('match_id', sql.Int, req.params.id).input('user_id', sql.Int, req.user.id)
            .query("SELECT id FROM match_players WHERE match_id = @match_id AND user_id = @user_id AND status = 'joined'");
        if (playerCheck.recordset.length === 0)
            return res.status(403).json({ message: 'Bạn phải tham gia trận để gửi tin nhắn' });

        const room = await pool.request().input('match_id', sql.Int, req.params.id)
            .query('SELECT id FROM chat_rooms WHERE match_id = @match_id');
        if (room.recordset.length === 0) return res.status(404).json({ message: 'Chat room không tồn tại' });
        const roomId = room.recordset[0].id;

        const msg = await pool.request()
            .input('chat_room_id', sql.Int, roomId).input('user_id', sql.Int, req.user.id)
            .input('content', sql.NVarChar, content.trim())
            .query(`INSERT INTO chat_messages (chat_room_id, user_id, content)
                    OUTPUT INSERTED.id, INSERTED.created_at
                    VALUES (@chat_room_id, @user_id, @content)`);

        const userRes = await pool.request().input('id', sql.Int, req.user.id)
            .query('SELECT full_name, avatar FROM users WHERE id = @id');
        const sender = userRes.recordset[0];

        const messageData = {
            id: msg.recordset[0].id, chat_room_id: roomId,
            user_id: req.user.id, full_name: sender?.full_name || '',
            avatar: sender?.avatar || null,
            content: content.trim(), created_at: msg.recordset[0].created_at
        };
        try { getIO().to(`room_${roomId}`).emit('new_message', messageData); } catch (_) { /* socket not ready */ }
        res.status(201).json(messageData);
    } catch (err) {
        console.error('[sendMatchMessage]', err);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// ── Auto-Cancel Underpopulated Matches (run on schedule) ────────────────────
// ── Auto-Check Matches (run on schedule) ────────────────────────────────────
export const autoCheckMatches = async () => {
    try {
        const pool = await poolPromise;

        // 1. Auto-complete: mark matches whose end_time has passed
        const toComplete = await pool.request().query(`
            SELECT id FROM matches
            WHERE status NOT IN ('cancelled','completed','finished')
              AND CONVERT(DATETIMEOFFSET,
                    CONVERT(NVARCHAR(10), match_date, 23) + 'T'
                    + LEFT(CONVERT(NVARCHAR(8), end_time, 108), 8)
                  ) < SYSDATETIMEOFFSET()
        `);
        for (const { id } of toComplete.recordset) {
            await pool.request().input('id', sql.Int, id)
                .query("UPDATE matches SET status = 'completed' WHERE id = @id AND status NOT IN ('cancelled','completed','finished')");
        }

        // 2. Auto-cancel: insufficient players 30 min before start
        const toCancel = await pool.request().query(`
            SELECT m.id FROM matches m
            WHERE m.status IN ('waiting','open')
              AND m.current_players < m.max_players
              AND CONVERT(DATETIMEOFFSET,
                    CONVERT(NVARCHAR(10), m.match_date, 23) + 'T'
                    + LEFT(CONVERT(NVARCHAR(8), m.start_time, 108), 8)
                  ) BETWEEN SYSDATETIMEOFFSET()
                        AND DATEADD(MINUTE, 30, SYSDATETIMEOFFSET())
        `);
        for (const { id } of toCancel.recordset) {
            const refundResult = await refundCompletedMatchPaymentsToBalance(
                Number(id),
                'Hoan tien 100% do tran bi huy vi thieu nguoi'
            );

            await pool.request().input('id', sql.Int, id)
                .query("UPDATE matches SET status = 'cancelled' WHERE id = @id");
            await pool.request().input('match_id', sql.Int, id)
                .query("UPDATE match_players SET payment_status = 'pending' WHERE match_id = @match_id AND payment_status = 'paid'");
            try {
                getIO().to(`match_${id}`).emit('match_auto_cancelled', {
                    matchId: id,
                    message: 'Trận bị hủy tự động do không đủ người. Tiền đã được hoàn vào số dư tài khoản.'
                });
            } catch (_) { /* socket not ready */ }
            console.log(`[AutoCancel] Match #${id} cancelled — not enough players, refunded=${refundResult.refundedTotal}`);
        }
    } catch (err) {
        console.error('[autoCheckMatches]', err);
    }
};

// ── Cancel Match (creator only) ──────────────────────────────────────────────
export const cancelMatch = async (req, res) => {
    try {
        const pool = await poolPromise;
        const matchRes = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('SELECT * FROM matches WHERE id = @id');
        if (matchRes.recordset.length === 0)
            return res.status(404).json({ message: 'Không tìm thấy trận' });
        const m = matchRes.recordset[0];

        if (m.creator_id !== req.user.id)
            return res.status(403).json({ message: 'Chỉ người tạo mới có thể hủy trận' });

        if (['cancelled', 'completed', 'finished'].includes(m.status))
            return res.status(400).json({ message: 'Trận đã kết thúc hoặc đã bị hủy' });

        const refundResult = await refundCompletedMatchPaymentsToBalance(
            Number(req.params.id),
            'Hoan tien do nguoi tao huy tran'
        );

        await pool.request()
            .input('match_id', sql.Int, req.params.id)
            .query("UPDATE match_players SET payment_status = 'pending' WHERE match_id = @match_id AND payment_status = 'paid'");

        await pool.request()
            .input('id', sql.Int, req.params.id)
            .query("UPDATE matches SET status = 'cancelled' WHERE id = @id");

        try {
            getIO().to(`match_${req.params.id}`).emit('match_cancelled', {
                matchId: req.params.id,
                message: 'Trận đã bị hủy bởi người tổ chức. Tiền đã được hoàn vào số dư tài khoản.'
            });
        } catch (_) { /* socket not ready */ }

        res.json({
            message: 'Đã hủy trận. Tất cả người đã thanh toán đã được hoàn tiền vào số dư tài khoản.',
            refundedAmount: refundResult.refundedTotal,
            refundedCount: refundResult.refundedCount
        });
    } catch (err) {
        console.error('[cancelMatch]', err);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

