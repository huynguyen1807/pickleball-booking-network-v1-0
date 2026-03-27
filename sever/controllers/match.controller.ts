import { sql, poolPromise } from '../config/db';
import { getIO } from '../socket/index';
import { createNotification } from './notification.controller';
import { createPayOSPaymentSession } from './payment.controller';
import {
    JOIN_PAYMENT_WINDOW_MINUTES,
    MATCH_UNDERFILLED_CANCEL_WINDOW_MINUTES,
    getCourtAvailabilityConflict,
    getFormatConfig,
    getHoursUntilStart,
    getMatchWindowError,
    getMinimumPlayers,
    getScheduleConflictMessage,
    getUserScheduleConflict,
    isMatchFinished,
    isMatchStarted,
    normalizeTime,
    syncMatchState,
    toLocalDateOnly
} from '../utils/matchLifecycle';
import dotenv from 'dotenv';

dotenv.config();

const COMMISSION = parseFloat(process.env.COMMISSION_RATE || '0.05');
const PLAYER_REFUND_RATE_BEFORE_4H = 0.5;
const HOST_REFUND_RATE_NO_GUESTS = 0.5;

const toMinutes = (t: string): number => {
    const [h, m] = normalizeTime(t).split(':').map(Number);
    return h * 60 + m;
};

const getUserBalance = async (userId: number): Promise<number> => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('id', sql.Int, userId)
        .query('SELECT ISNULL(balance, 0) AS balance FROM users WHERE id = @id');
    return Number(result.recordset?.[0]?.balance || 0);
};

const refundMatchPaymentsToBalance = async (params: {
    matchId: number;
    description: string;
    ratio?: number;
    targetUserId?: number | null;
    excludeUserId?: number | null;
}) => {
    const {
        matchId,
        description,
        ratio = 1,
        targetUserId = null,
        excludeUserId = null
    } = params;

    const appliedRatio = Math.max(0, Math.min(1, ratio));
    if (appliedRatio <= 0) {
        return { refundedCount: 0, refundedTotal: 0 };
    }

    const pool = await poolPromise;
    const result = await pool.request()
        .input('match_id', sql.Int, matchId)
        .input('description', sql.NVarChar, description)
        .input('target_user_id', sql.Int, targetUserId)
        .input('exclude_user_id', sql.Int, excludeUserId)
        .input('refund_ratio', sql.Decimal(5, 4), appliedRatio)
        .query(`
            SET XACT_ABORT ON;

            BEGIN TRY
                BEGIN TRAN;

                DECLARE @refunded TABLE (
                    payment_id INT,
                    user_id INT,
                    refund_amount DECIMAL(12,2),
                    next_status NVARCHAR(30)
                );

                UPDATE payments
                SET refunded_amount = ROUND(amount * @refund_ratio, 0),
                    status = CASE WHEN @refund_ratio >= 1 THEN 'refunded' ELSE 'partial_refunded' END
                OUTPUT INSERTED.id,
                       INSERTED.user_id,
                       ROUND(INSERTED.amount * @refund_ratio, 0),
                       CASE WHEN @refund_ratio >= 1 THEN 'refunded' ELSE 'partial_refunded' END
                INTO @refunded(payment_id, user_id, refund_amount, next_status)
                WHERE match_id = @match_id
                  AND status = 'completed'
                  AND ISNULL(refunded_amount, 0) = 0
                  AND (@target_user_id IS NULL OR user_id = @target_user_id)
                  AND (@exclude_user_id IS NULL OR user_id <> @exclude_user_id);

                UPDATE u
                SET u.balance = ISNULL(u.balance, 0) + x.total_amount
                FROM users u
                JOIN (
                    SELECT user_id, SUM(refund_amount) AS total_amount
                    FROM @refunded
                    GROUP BY user_id
                ) x ON x.user_id = u.id;

                UPDATE mp
                SET payment_status = r.next_status
                FROM match_players mp
                JOIN @refunded r ON r.user_id = mp.user_id
                WHERE mp.match_id = @match_id;

                IF OBJECT_ID('wallet_transactions', 'U') IS NOT NULL
                BEGIN
                    INSERT INTO wallet_transactions (
                        user_id, payment_id, amount, type, description, reference_type, reference_id, status
                    )
                    SELECT user_id, payment_id, refund_amount, 'refund', @description, 'match', @match_id, 'completed'
                    FROM @refunded;
                END

                COMMIT TRAN;
            END TRY
            BEGIN CATCH
                IF @@TRANCOUNT > 0 ROLLBACK TRAN;
                THROW;
            END CATCH

            SELECT COUNT(1) AS refunded_count, ISNULL(SUM(refund_amount), 0) AS refunded_total
            FROM @refunded;
        `);

    return {
        refundedCount: Number(result.recordset?.[0]?.refunded_count || 0),
        refundedTotal: Number(result.recordset?.[0]?.refunded_total || 0)
    };
};

const getTableColumns = async (executor: any, tableName: 'courts' | 'sub_courts'): Promise<Set<string>> => {
    const result = await executor.request()
        .input('table_name', sql.NVarChar, tableName)
        .query(`
            SELECT LOWER(COLUMN_NAME) AS column_name
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = @table_name
        `);

    return new Set(result.recordset.map((r: any) => String(r.column_name)));
};

const resolvePricing = async (executor: any, courtId: number, subCourtId: number | null, matchDate: string, startTime: string, endTime: string) => {
    const tableName: 'courts' | 'sub_courts' = subCourtId ? 'sub_courts' : 'courts';
    const tableColumns = await getTableColumns(executor, tableName);

    const pickColumn = (candidates: string[], fallbackExpression: string): string => {
        for (const candidate of candidates) {
            if (tableColumns.has(candidate.toLowerCase())) {
                return candidate;
            }
        }
        return fallbackExpression;
    };

    const peakPriceExpr = pickColumn(['peak_price'], '0');
    const weekendPriceExpr = pickColumn(['weekend_price'], '0');
    const minBookingExpr = pickColumn(['min_booking_minutes'], '30');
    const slotStepExpr = pickColumn(['slot_step_minutes'], '30');
    const peakStartExpr = tableColumns.has('peak_start_time')
        ? 'CONVERT(NVARCHAR(5), peak_start_time, 108)'
        : 'NULL';
    const peakEndExpr = tableColumns.has('peak_end_time')
        ? 'CONVERT(NVARCHAR(5), peak_end_time, 108)'
        : 'NULL';
    const isActiveExpr = tableColumns.has('is_active') ? 'is_active' : '1';

    let pricingRow: any;
    if (subCourtId) {
        const r = await executor.request()
            .input('id', sql.Int, subCourtId)
            .input('court_id', sql.Int, courtId)
            .query(`
                SELECT price_per_hour,
                       ${peakStartExpr} AS peak_start_time,
                       ${peakEndExpr} AS peak_end_time,
                       ${peakPriceExpr} AS peak_price,
                       ${weekendPriceExpr} AS weekend_price,
                       ${minBookingExpr} AS min_booking_minutes,
                       ${slotStepExpr} AS slot_step_minutes
                FROM sub_courts
                WHERE id = @id AND court_id = @court_id
            `);
        if (r.recordset.length === 0) {
            throw new Error('Sân con không tồn tại');
        }
        pricingRow = r.recordset[0];
    } else {
        const r = await executor.request()
            .input('id', sql.Int, courtId)
            .query(`
                SELECT price_per_hour,
                       ${peakStartExpr} AS peak_start_time,
                       ${peakEndExpr} AS peak_end_time,
                       ${peakPriceExpr} AS peak_price,
                       ${weekendPriceExpr} AS weekend_price,
                       ${minBookingExpr} AS min_booking_minutes,
                       ${slotStepExpr} AS slot_step_minutes,
                       ${isActiveExpr} AS is_active
                FROM courts
                WHERE id = @id
            `);

        if (r.recordset.length === 0 || !r.recordset[0].is_active) {
            throw new Error('Sân không tồn tại hoặc không hoạt động');
        }
        pricingRow = r.recordset[0];
    }

    const duration = toMinutes(endTime) - toMinutes(startTime);
    if (duration <= 0) {
        throw new Error('Thời gian kết thúc phải sau thời gian bắt đầu');
    }
    if (duration < Number(pricingRow.min_booking_minutes || 30)) {
        throw new Error(`Thời lượng tối thiểu là ${pricingRow.min_booking_minutes || 30} phút`);
    }

    let unitPrice = Number(pricingRow.price_per_hour || 0);
    const dayOfWeek = new Date(matchDate).getDay();
    if ((dayOfWeek === 0 || dayOfWeek === 6) && Number(pricingRow.weekend_price || 0) > 0) {
        unitPrice = Number(pricingRow.weekend_price);
    } else if (
        pricingRow.peak_start_time && pricingRow.peak_end_time &&
        normalizeTime(startTime) >= `${pricingRow.peak_start_time}:00`.slice(0, 8) &&
        normalizeTime(endTime) <= `${pricingRow.peak_end_time}:00`.slice(0, 8) &&
        Number(pricingRow.peak_price || 0) > 0
    ) {
        unitPrice = Number(pricingRow.peak_price);
    }

    return {
        totalCost: Math.ceil((unitPrice / 60) * duration)
    };
};

const createMatchChatRoom = async (executor: any, matchId: number, userId: number) => {
    const room = await executor.request()
        .input('match_id', sql.Int, matchId)
        .input('name', sql.NVarChar, `Trận #${matchId}`)
        .query('INSERT INTO chat_rooms (match_id, name) OUTPUT INSERTED.id VALUES (@match_id, @name)');

    const chatRoomId = room.recordset[0].id;
    await executor.request()
        .input('chat_room_id', sql.Int, chatRoomId)
        .input('user_id', sql.Int, userId)
        .query('INSERT INTO chat_room_members (chat_room_id, user_id) VALUES (@chat_room_id, @user_id)');

    return chatRoomId;
};

const notifyMatchCancellation = async (matchId: number, reason: string) => {
    const pool = await poolPromise;
    const participants = await pool.request()
        .input('match_id', sql.Int, matchId)
        .query(`
            SELECT DISTINCT mp.user_id
            FROM match_players mp
            WHERE mp.match_id = @match_id
              AND mp.status IN ('joined', 'payment_pending')
        `);

    for (const row of participants.recordset) {
        await createNotification(row.user_id, 'Trận đã bị hủy', reason, 'match_cancelled', matchId);
        try { getIO()?.to(`user_${row.user_id}`).emit('new_notification'); } catch { }
    }
};

export const createMatch = async (req, res) => {
    let matchId: number | null = null;
    let bookingId: number | null = null;
    let chatRoomId: number | null = null;

    try {
        const {
            court_id,
            sub_court_id,
            match_date,
            start_time,
            end_time,
            max_players,
            min_players,
            format = '2v2',
            skill_level = 'all',
            description
        } = req.body;

        if (!court_id || !match_date || !start_time || !end_time) {
            return res.status(400).json({ message: 'Thiếu thông tin trận đấu' });
        }

        const windowError = getMatchWindowError(match_date, start_time);
        if (windowError) {
            return res.status(400).json({ message: windowError });
        }

        const pool = await poolPromise;
        const tx = pool.transaction();
        await tx.begin();

        try {
            const courtConflict = await getCourtAvailabilityConflict(tx, Number(court_id), match_date, start_time, end_time);
            if (courtConflict) {
                await tx.rollback();
                return res.status(409).json({ message: 'Sân đã có booking hoặc trận khác trong khung giờ này' });
            }

            const scheduleConflict = await getUserScheduleConflict(tx, Number(req.user.id), match_date, start_time, end_time);
            if (scheduleConflict) {
                await tx.rollback();
                return res.status(409).json({ message: getScheduleConflictMessage(scheduleConflict) });
            }

            const formatConfig = getFormatConfig(format, max_players);
            const minimumPlayers = getMinimumPlayers(formatConfig.format, formatConfig.maxPlayers, min_players);
            const pricing = await resolvePricing(tx, Number(court_id), sub_court_id ? Number(sub_court_id) : null, toLocalDateOnly(match_date), start_time, end_time);
            const pricePerPlayer = Math.ceil(pricing.totalCost / formatConfig.maxPlayers);
            const bookingCommission = Math.round(pricePerPlayer * COMMISSION);

            const bookingInsert = await tx.request()
                .input('user_id', sql.Int, req.user.id)
                .input('court_id', sql.Int, court_id)
                .input('booking_date', sql.Date, toLocalDateOnly(match_date))
                .input('start_time', sql.NVarChar, normalizeTime(start_time))
                .input('end_time', sql.NVarChar, normalizeTime(end_time))
                .input('total_price', sql.Decimal(12, 2), pricePerPlayer)
                .input('commission_rate', sql.Decimal(4, 2), COMMISSION)
                .input('commission_amount', sql.Decimal(12, 2), bookingCommission)
                .input('payment_method', sql.NVarChar, 'payos')
                .query(`
                    INSERT INTO bookings (
                        user_id, court_id, booking_date, start_time, end_time,
                        total_price, commission_rate, commission_amount, payment_method, status
                    )
                    VALUES (
                        @user_id, @court_id, @booking_date, CAST(@start_time AS TIME), CAST(@end_time AS TIME),
                        @total_price, @commission_rate, @commission_amount, @payment_method, 'payment_pending'
                    );

                    SELECT SCOPE_IDENTITY() AS id;
                `);

            bookingId = Number(bookingInsert.recordset[0].id);

            const matchInsert = await tx.request()
                .input('creator_id', sql.Int, req.user.id)
                .input('court_id', sql.Int, court_id)
                .input('booking_id', sql.Int, bookingId)
                .input('match_date', sql.Date, toLocalDateOnly(match_date))
                .input('start_time', sql.NVarChar, normalizeTime(start_time))
                .input('end_time', sql.NVarChar, normalizeTime(end_time))
                .input('max_players', sql.Int, formatConfig.maxPlayers)
                .input('min_players', sql.Int, minimumPlayers)
                .input('current_players', sql.Int, 1)
                .input('total_cost', sql.Decimal(12, 2), pricing.totalCost)
                .input('commission_rate', sql.Decimal(4, 2), COMMISSION)
                .input('format', sql.NVarChar, formatConfig.format)
                .input('skill_level', sql.NVarChar, skill_level)
                .input('description', sql.NVarChar, description || null)
                .query(`
                    INSERT INTO matches (
                        creator_id, court_id, booking_id, match_date, start_time, end_time,
                        max_players, min_players, current_players, total_cost, commission_rate,
                        format, skill_level, description, status
                    )
                    OUTPUT INSERTED.id
                    VALUES (
                        @creator_id, @court_id, @booking_id, @match_date, CAST(@start_time AS TIME), CAST(@end_time AS TIME),
                        @max_players, @min_players, @current_players, @total_cost, @commission_rate,
                        @format, @skill_level, @description, 'pending_host_payment'
                    )
                `);

            matchId = Number(matchInsert.recordset[0].id);

            await tx.request()
                .input('match_id', sql.Int, matchId)
                .input('user_id', sql.Int, req.user.id)
                .input('amount_due', sql.Decimal(12, 2), pricePerPlayer)
                .query(`
                    INSERT INTO match_players (match_id, user_id, status, payment_status, amount_due)
                    VALUES (@match_id, @user_id, 'payment_pending', 'pending', @amount_due)
                `);

            chatRoomId = await createMatchChatRoom(tx, matchId, Number(req.user.id));
            await tx.commit();

            try {
                const payment = await createPayOSPaymentSession({
                    userId: Number(req.user.id),
                    bookingId,
                    matchId,
                    amount: pricePerPlayer,
                    paymentContext: 'host_match',
                    expiresInMinutes: 5,
                    description: `MT${String(matchId).padStart(4, '0')}`
                });

                return res.status(201).json({
                    message: 'Đã giữ slot trong 5 phút. Hoàn tất thanh toán để mở trận.',
                    matchId,
                    bookingId,
                    chatRoomId,
                    total_cost: pricing.totalCost,
                    price_per_player: pricePerPlayer,
                    payment
                });
            } catch (paymentErr: any) {
                await pool.request()
                    .input('match_id', sql.Int, matchId)
                    .input('booking_id', sql.Int, bookingId)
                    .query(`
                        UPDATE match_players SET status = 'expired', payment_status = 'failed' WHERE match_id = @match_id;
                        UPDATE matches SET status = 'cancelled' WHERE id = @match_id;
                        UPDATE bookings SET status = 'cancelled' WHERE id = @booking_id;
                    `);
                return res.status(500).json({ message: paymentErr.message || 'Không thể tạo phiên thanh toán cho host' });
            }
        } catch (innerErr) {
            if (tx._aborted !== true) {
                await tx.rollback();
            }
            throw innerErr;
        }
    } catch (err: any) {
        console.error('[createMatch]', err);
        res.status(500).json({ message: err.message || 'Lỗi server' });
    }
};

export const getAllMatches = async (req, res) => {
    try {
        const { status, skill_level, format } = req.query;
        const pool = await poolPromise;
        const request = pool.request();
        const conditions: string[] = ["m.status NOT IN ('pending_host_payment', 'expired')"];

        request.input('user_id', sql.Int, req.user?.id || 0);
        if (status) {
            request.input('status', sql.NVarChar, status);
            conditions.push('m.status = @status');
        }
        if (skill_level && skill_level !== 'all') {
            request.input('skill_level', sql.NVarChar, skill_level);
            conditions.push('m.skill_level = @skill_level');
        }
        if (format) {
            request.input('format', sql.NVarChar, format);
            conditions.push('m.format = @format');
        }

        const result = await request.query(`
            SELECT
                m.*,
                c.name AS court_name,
                f.address,
                u.full_name AS creator_name,
                (SELECT COUNT(*) FROM match_players WHERE match_id = m.id AND status = 'joined') AS active_players,
                CASE WHEN m.creator_id = @user_id THEN 1 ELSE 0 END AS is_creator,
                CASE WHEN EXISTS (
                    SELECT 1 FROM match_players
                    WHERE match_id = m.id AND user_id = @user_id AND status IN ('joined', 'payment_pending')
                ) THEN 1 ELSE 0 END AS is_joined
            FROM matches m
            JOIN courts c ON m.court_id = c.id
            LEFT JOIN facilities f ON c.facility_id = f.id
            JOIN users u ON m.creator_id = u.id
            WHERE ${conditions.join(' AND ')}
            ORDER BY m.match_date ASC, m.start_time ASC
        `);

        res.json(result.recordset);
    } catch (err) {
        console.error('[getAllMatches]', err);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

export const getMyMatchHistory = async (req, res) => {
    try {
        const pool = await poolPromise;
        const uid = Number(req.user.id);

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
                        WHERE mp.match_id = m.id AND mp.user_id = @uid AND mp.status = 'payment_pending'
                    ) THEN 1 ELSE 0 END AS is_payment_pending,
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
                          AND mp.status IN ('joined', 'payment_pending', 'expired', 'left')
                   )
                ORDER BY m.match_date DESC, m.start_time DESC
            `);

        res.json(result.recordset);
    } catch (err) {
        console.error('[getMyMatchHistory]', err);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

export const getMatchById = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('id', sql.Int, req.params.id)
            .input('user_id', sql.Int, req.user.id)
            .query(`
                SELECT
                    m.*, c.name AS court_name, f.address, u.full_name AS creator_name,
                    cr.id AS chat_room_id,
                    CASE WHEN m.creator_id = @user_id THEN 1 ELSE 0 END AS is_creator
                FROM matches m
                JOIN courts c ON m.court_id = c.id
                LEFT JOIN facilities f ON c.facility_id = f.id
                JOIN users u ON m.creator_id = u.id
                LEFT JOIN chat_rooms cr ON cr.match_id = m.id
                WHERE m.id = @id
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy trận' });
        }

        const match = result.recordset[0];
        if (String(match.status || '').toLowerCase() === 'pending_host_payment' && Number(match.creator_id) !== Number(req.user.id)) {
            return res.status(404).json({ message: 'Không tìm thấy trận' });
        }

        const players = await pool.request()
            .input('match_id', sql.Int, req.params.id)
            .query(`
                SELECT mp.*, u.full_name, u.avatar
                FROM match_players mp
                JOIN users u ON mp.user_id = u.id
                WHERE mp.match_id = @match_id
                  AND mp.status <> 'expired'
                ORDER BY mp.created_at ASC
            `);

        await syncMatchState(Number(req.params.id));
        res.json({ ...match, players: players.recordset });
    } catch (err) {
        console.error('[getMatchById]', err);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

export const joinMatch = async (req, res) => {
    try {
        const pool = await poolPromise;
        const matchRes = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('SELECT * FROM matches WHERE id = @id');

        if (matchRes.recordset.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy trận' });
        }

        const match = matchRes.recordset[0];
        if (!['open', 'full'].includes(String(match.status || '').toLowerCase())) {
            return res.status(400).json({ message: 'Trận này chưa sẵn sàng để tham gia' });
        }
        if (Number(match.creator_id) === Number(req.user.id)) {
            return res.status(400).json({ message: 'Người tạo trận đã ở trong trận này' });
        }
        if (isMatchStarted(match.match_date, match.start_time)) {
            return res.status(400).json({ message: 'Trận đã bắt đầu' });
        }
        if (Number(match.current_players) >= Number(match.max_players)) {
            return res.status(400).json({ message: 'Trận đã đủ chỗ' });
        }

        const existing = await pool.request()
            .input('match_id', sql.Int, req.params.id)
            .input('user_id', sql.Int, req.user.id)
            .query(`
                SELECT id
                FROM match_players
                WHERE match_id = @match_id
                  AND user_id = @user_id
                  AND status IN ('payment_pending', 'joined')
            `);

        if (existing.recordset.length > 0) {
            return res.status(400).json({ message: 'Bạn đã có chỗ trong trận này rồi' });
        }

        const scheduleConflict = await getUserScheduleConflict(pool, Number(req.user.id), match.match_date, match.start_time, match.end_time, Number(req.params.id));
        if (scheduleConflict) {
            return res.status(409).json({ message: getScheduleConflictMessage(scheduleConflict) });
        }

        const pricePerPlayer = Math.ceil(Number(match.total_cost) / Number(match.max_players || 1));
        const tx = pool.transaction();
        await tx.begin();

        try {
            const freshMatch = await tx.request()
                .input('id', sql.Int, req.params.id)
                .query('SELECT current_players, max_players, status FROM matches WHERE id = @id');

            if (freshMatch.recordset.length === 0 || Number(freshMatch.recordset[0].current_players) >= Number(freshMatch.recordset[0].max_players)) {
                await tx.rollback();
                return res.status(409).json({ message: 'Trận vừa hết chỗ. Vui lòng tải lại.' });
            }

            await tx.request()
                .input('match_id', sql.Int, req.params.id)
                .input('user_id', sql.Int, req.user.id)
                .input('amount_due', sql.Decimal(12, 2), pricePerPlayer)
                .query(`
                    INSERT INTO match_players (match_id, user_id, amount_due, status, payment_status)
                    VALUES (@match_id, @user_id, @amount_due, 'payment_pending', 'pending')
                `);

            await tx.request()
                .input('id', sql.Int, req.params.id)
                .query(`
                    UPDATE matches
                    SET current_players = current_players + 1,
                        status = CASE WHEN current_players + 1 >= max_players THEN 'full' ELSE 'open' END
                    WHERE id = @id
                `);

            const room = await tx.request()
                .input('match_id', sql.Int, req.params.id)
                .query('SELECT id FROM chat_rooms WHERE match_id = @match_id');

            if (room.recordset.length > 0) {
                const isMember = await tx.request()
                    .input('chat_room_id', sql.Int, room.recordset[0].id)
                    .input('user_id', sql.Int, req.user.id)
                    .query('SELECT id FROM chat_room_members WHERE chat_room_id = @chat_room_id AND user_id = @user_id');
                if (isMember.recordset.length === 0) {
                    await tx.request()
                        .input('chat_room_id', sql.Int, room.recordset[0].id)
                        .input('user_id', sql.Int, req.user.id)
                        .query('INSERT INTO chat_room_members (chat_room_id, user_id) VALUES (@chat_room_id, @user_id)');
                }
            }

            await tx.commit();
        } catch (innerErr) {
            if (tx._aborted !== true) {
                await tx.rollback();
            }
            throw innerErr;
        }

        try {
            const payment = await createPayOSPaymentSession({
                userId: Number(req.user.id),
                matchId: Number(req.params.id),
                amount: pricePerPlayer,
                paymentContext: 'join_match',
                expiresInMinutes: JOIN_PAYMENT_WINDOW_MINUTES,
                description: `MT${String(req.params.id).padStart(4, '0')}`
            });

            await syncMatchState(Number(req.params.id));
            return res.json({
                message: 'Đã giữ chỗ trong 5 phút. Hoàn tất thanh toán để xác nhận tham gia.',
                price_per_player: pricePerPlayer,
                payment
            });
        } catch (paymentErr: any) {
            await pool.request()
                .input('match_id', sql.Int, req.params.id)
                .input('user_id', sql.Int, req.user.id)
                .query(`
                    UPDATE match_players
                    SET status = 'expired', payment_status = 'failed'
                    WHERE match_id = @match_id AND user_id = @user_id AND status = 'payment_pending';

                    UPDATE matches
                    SET current_players = CASE WHEN current_players > 0 THEN current_players - 1 ELSE 0 END,
                        status = 'open'
                    WHERE id = @match_id;
                `);
            return res.status(500).json({ message: paymentErr.message || 'Không thể tạo phiên thanh toán tham gia trận' });
        }
    } catch (err) {
        console.error('[joinMatch]', err);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

export const leaveMatch = async (req, res) => {
    try {
        const pool = await poolPromise;
        const matchRes = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('SELECT * FROM matches WHERE id = @id');

        if (matchRes.recordset.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy trận' });
        }

        const match = matchRes.recordset[0];
        if (Number(match.creator_id) === Number(req.user.id)) {
            return res.status(400).json({ message: 'Người tạo trận không thể rời trận. Hãy hủy trận nếu cần.' });
        }

        const playerRes = await pool.request()
            .input('match_id', sql.Int, req.params.id)
            .input('user_id', sql.Int, req.user.id)
            .query(`
                SELECT *
                FROM match_players
                WHERE match_id = @match_id AND user_id = @user_id AND status IN ('payment_pending', 'joined')
            `);

        if (playerRes.recordset.length === 0) {
            return res.status(400).json({ message: 'Bạn không có trong trận này' });
        }

        const player = playerRes.recordset[0];
        let refundedAmount = 0;
        let refundMessage = 'Không hoàn tiền.';
        let balanceAfter = null;

        if (String(player.status || '').toLowerCase() === 'payment_pending') {
            await pool.request()
                .input('match_id', sql.Int, req.params.id)
                .input('user_id', sql.Int, req.user.id)
                .query(`
                    UPDATE match_players
                    SET status = 'expired', payment_status = 'cancelled'
                    WHERE match_id = @match_id AND user_id = @user_id AND status = 'payment_pending';

                    UPDATE payments
                    SET status = 'cancelled'
                    WHERE match_id = @match_id AND user_id = @user_id AND status = 'pending';
                `);

            await syncMatchState(Number(req.params.id));
            return res.json({ message: 'Đã hủy giữ chỗ tham gia trận', refundStatus: 'none', refundMessage });
        }

        const hoursUntil = getHoursUntilStart(match.match_date, match.start_time);
        if (String(player.payment_status || '').toLowerCase() === 'paid' && hoursUntil > 4) {
            const refundResult = await refundMatchPaymentsToBalance({
                matchId: Number(req.params.id),
                description: 'Hoan 50 phan tram do roi tran truoc 4 gio',
                ratio: PLAYER_REFUND_RATE_BEFORE_4H,
                targetUserId: Number(req.user.id)
            });
            refundedAmount = refundResult.refundedTotal;
            if (refundedAmount > 0) {
                refundMessage = `Đã hoàn 50% vào số dư tài khoản: ${refundedAmount.toLocaleString('vi-VN')}đ.`;
                balanceAfter = await getUserBalance(Number(req.user.id));
            }
        } else if (hoursUntil <= 4) {
            refundMessage = 'Không hoàn tiền vì bạn rời trận trong vòng 4 giờ trước giờ bắt đầu.';
        }

        await pool.request()
            .input('match_id', sql.Int, req.params.id)
            .input('user_id', sql.Int, req.user.id)
            .query(`
                UPDATE match_players
                SET status = 'left'
                WHERE match_id = @match_id AND user_id = @user_id AND status = 'joined';
            `);

        await syncMatchState(Number(req.params.id));

        res.json({
            message: 'Đã rời trận',
            refundStatus: refundedAmount > 0 ? 'partial' : 'none',
            refundMessage,
            refundedAmount,
            balanceAfter
        });
    } catch (err) {
        console.error('[leaveMatch]', err);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

export const getMatchMessages = async (req, res) => {
    try {
        const pool = await poolPromise;
        const playerCheck = await pool.request()
            .input('match_id', sql.Int, req.params.id)
            .input('user_id', sql.Int, req.user.id)
            .query(`
                SELECT id
                FROM match_players
                WHERE match_id = @match_id AND user_id = @user_id AND status = 'joined'
            `);

        if (playerCheck.recordset.length === 0) {
            const creatorCheck = await pool.request()
                .input('id', sql.Int, req.params.id)
                .input('user_id', sql.Int, req.user.id)
                .query('SELECT id FROM matches WHERE id = @id AND creator_id = @user_id');
            if (creatorCheck.recordset.length === 0) {
                return res.status(403).json({ message: 'Bạn phải tham gia trận để xem tin nhắn' });
            }
        }

        const room = await pool.request()
            .input('match_id', sql.Int, req.params.id)
            .query('SELECT id FROM chat_rooms WHERE match_id = @match_id');
        if (room.recordset.length === 0) return res.json([]);

        const messages = await pool.request()
            .input('room_id', sql.Int, room.recordset[0].id)
            .query(`
                SELECT m.*, u.full_name, u.avatar
                FROM messages m
                JOIN users u ON m.user_id = u.id
                WHERE m.chat_room_id = @room_id
                ORDER BY m.created_at ASC
            `);
        res.json(messages.recordset);
    } catch (err) {
        console.error('[getMatchMessages]', err);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

export const sendMatchMessage = async (req, res) => {
    try {
        const { content } = req.body;
        if (!content?.trim()) {
            return res.status(400).json({ message: 'Nội dung không được trống' });
        }

        const pool = await poolPromise;
        const playerCheck = await pool.request()
            .input('match_id', sql.Int, req.params.id)
            .input('user_id', sql.Int, req.user.id)
            .query(`
                SELECT id
                FROM match_players
                WHERE match_id = @match_id AND user_id = @user_id AND status = 'joined'
            `);

        if (playerCheck.recordset.length === 0) {
            const creatorCheck = await pool.request()
                .input('id', sql.Int, req.params.id)
                .input('user_id', sql.Int, req.user.id)
                .query('SELECT id FROM matches WHERE id = @id AND creator_id = @user_id');
            if (creatorCheck.recordset.length === 0) {
                return res.status(403).json({ message: 'Bạn phải tham gia trận để gửi tin nhắn' });
            }
        }

        const room = await pool.request()
            .input('match_id', sql.Int, req.params.id)
            .query('SELECT id FROM chat_rooms WHERE match_id = @match_id');
        if (room.recordset.length === 0) return res.status(404).json({ message: 'Chat room không tồn tại' });
        const roomId = room.recordset[0].id;

        const msg = await pool.request()
            .input('chat_room_id', sql.Int, roomId)
            .input('user_id', sql.Int, req.user.id)
            .input('content', sql.NVarChar, content.trim())
            .query(`
                INSERT INTO messages (chat_room_id, user_id, content)
                OUTPUT INSERTED.id, INSERTED.created_at
                VALUES (@chat_room_id, @user_id, @content)
            `);

        const userRes = await pool.request()
            .input('id', sql.Int, req.user.id)
            .query('SELECT full_name, avatar FROM users WHERE id = @id');

        const sender = userRes.recordset[0];
        const messageData = {
            id: msg.recordset[0].id,
            chat_room_id: roomId,
            user_id: req.user.id,
            full_name: sender?.full_name || '',
            avatar: sender?.avatar || null,
            content: content.trim(),
            created_at: msg.recordset[0].created_at
        };

        try { getIO()?.to(`room_${roomId}`).emit('new_message', messageData); } catch { }
        res.status(201).json(messageData);
    } catch (err) {
        console.error('[sendMatchMessage]', err);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

export const autoCheckMatches = async () => {
    try {
        const pool = await poolPromise;

        const toComplete = await pool.request().query(`
            SELECT id, match_date, end_time
            FROM matches
            WHERE status NOT IN ('cancelled', 'completed', 'finished', 'expired', 'pending_host_payment')
        `);

        for (const row of toComplete.recordset) {
            if (isMatchFinished(row.match_date, row.end_time)) {
                await pool.request()
                    .input('id', sql.Int, row.id)
                    .query("UPDATE matches SET status = 'completed' WHERE id = @id AND status NOT IN ('cancelled','completed','finished','expired')");
            }
        }

        const underfilled = await pool.request().query(`
            SELECT
                m.id,
                m.booking_id,
                m.format,
                m.max_players,
                m.min_players,
                m.match_date,
                m.start_time,
                SUM(CASE WHEN mp.status = 'joined' THEN 1 ELSE 0 END) AS joined_players
            FROM matches m
            LEFT JOIN match_players mp ON mp.match_id = m.id
            WHERE m.status IN ('open', 'full', 'confirmed')
            GROUP BY m.id, m.booking_id, m.format, m.max_players, m.min_players, m.match_date, m.start_time
        `);

        for (const row of underfilled.recordset) {
            const minutesUntilStart = getHoursUntilStart(row.match_date, row.start_time) * 60;
            if (minutesUntilStart > MATCH_UNDERFILLED_CANCEL_WINDOW_MINUTES) {
                continue;
            }

            const requiredPlayers = getMinimumPlayers(row.format, row.max_players, row.min_players);
            if (Number(row.joined_players || 0) >= requiredPlayers) {
                continue;
            }

            const refundResult = await refundMatchPaymentsToBalance({
                matchId: Number(row.id),
                description: 'Hoan 100 phan tram do tran bi huy vi khong du nguoi',
                ratio: 1
            });

            await pool.request()
                .input('match_id', sql.Int, row.id)
                .input('booking_id', sql.Int, row.booking_id)
                .query(`
                    UPDATE matches SET status = 'cancelled' WHERE id = @match_id;
                    UPDATE bookings SET status = 'cancelled' WHERE id = @booking_id AND status <> 'cancelled';
                `);

            await notifyMatchCancellation(Number(row.id), 'Trận bị hủy tự động do không đủ số người tối thiểu. Hệ thống đã hoàn tiền cho các thành viên đã thanh toán.');
            console.log(`[autoCheckMatches] Cancelled match #${row.id}, refunded=${refundResult.refundedTotal}`);
        }
    } catch (err) {
        console.error('[autoCheckMatches]', err);
    }
};

export const cancelMatch = async (req, res) => {
    try {
        const pool = await poolPromise;
        const matchRes = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('SELECT * FROM matches WHERE id = @id');

        if (matchRes.recordset.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy trận' });
        }

        const match = matchRes.recordset[0];
        if (Number(match.creator_id) !== Number(req.user.id)) {
            return res.status(403).json({ message: 'Chỉ người tạo mới có thể hủy trận' });
        }
        if (['cancelled', 'completed', 'finished', 'expired'].includes(String(match.status || '').toLowerCase())) {
            return res.status(400).json({ message: 'Trận đã kết thúc hoặc đã bị hủy' });
        }

        const summary = await pool.request()
            .input('match_id', sql.Int, req.params.id)
            .input('host_id', sql.Int, req.user.id)
            .query(`
                SELECT
                    SUM(CASE WHEN status = 'joined' AND user_id <> @host_id THEN 1 ELSE 0 END) AS joined_guests
                FROM match_players
                WHERE match_id = @match_id
            `);

        const joinedGuests = Number(summary.recordset[0]?.joined_guests || 0);
        let refundResult = { refundedCount: 0, refundedTotal: 0 };
        let message = 'Đã hủy trận.';

        if (joinedGuests === 0) {
            refundResult = await refundMatchPaymentsToBalance({
                matchId: Number(req.params.id),
                description: 'Host huy tran truoc khi co nguoi tham gia, hoan 50 phan tram',
                ratio: HOST_REFUND_RATE_NO_GUESTS,
                targetUserId: Number(req.user.id)
            });
            message = 'Đã hủy trận. Host được hoàn 50% vì chưa có người chơi khác tham gia.';
        } else {
            refundResult = await refundMatchPaymentsToBalance({
                matchId: Number(req.params.id),
                description: 'Host huy tran sau khi da co nguoi tham gia, hoan 100 phan tram cho nguoi choi',
                ratio: 1,
                excludeUserId: Number(req.user.id)
            });
            message = 'Đã hủy trận. Người chơi đã thanh toán được hoàn 100%. Host không được hoàn tiền.';
        }

        await pool.request()
            .input('match_id', sql.Int, req.params.id)
            .input('booking_id', sql.Int, match.booking_id)
            .query(`
                UPDATE matches SET status = 'cancelled' WHERE id = @match_id;
                UPDATE bookings SET status = 'cancelled' WHERE id = @booking_id AND status <> 'cancelled';
            `);

        await notifyMatchCancellation(Number(req.params.id), message);

        res.json({
            message,
            refundedAmount: refundResult.refundedTotal,
            refundedCount: refundResult.refundedCount
        });
    } catch (err) {
        console.error('[cancelMatch]', err);
        res.status(500).json({ message: 'Lỗi server' });
    }
};