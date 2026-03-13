import { sql, poolPromise } from '../config/db';
import dotenv from 'dotenv';
dotenv.config();
const COMMISSION = parseFloat(process.env.COMMISSION_RATE) || 0.05;

// Create match
export const createMatch = async (req, res) => {
    try {
        const { court_id, sub_court_id, match_date, start_time, end_time, max_players } = req.body;
        const pool = await poolPromise;

        let pricingRow;
        if (sub_court_id) {
            // Get pricing from sub_court
            const result = await pool.request()
                .input('id', sql.Int, sub_court_id)
                .input('court_id', sql.Int, court_id)
                .query(`SELECT price_per_hour, peak_start_time, peak_end_time, peak_price_per_hour,
                               weekend_price_per_hour, min_booking_minutes, slot_step_minutes
                        FROM sub_courts WHERE id = @id AND court_id = @court_id`);
            if (result.recordset.length === 0) return res.status(404).json({ message: 'Sân con không tồn tại' });
            pricingRow = result.recordset[0];
        } else {
            // Use default values
            pricingRow = {
                price_per_hour: 100000,
                peak_start_time: null,
                peak_end_time: null,
                peak_price_per_hour: 0,
                weekend_price_per_hour: 0,
                min_booking_minutes: 30,
                slot_step_minutes: 15
            };
        }

        // Verify court exists
        const court = await pool.request().input('id', sql.Int, court_id)
            .query('SELECT id FROM courts WHERE id = @id AND is_active = 1');
        if (court.recordset.length === 0) return res.status(404).json({ message: 'Sân không tồn tại' });

        const toMinutes = t => {
            const [h, m] = t.split(':').map(Number);
            return h * 60 + m;
        };
        const startMin = toMinutes(start_time);
        const endMin = toMinutes(end_time);
        const duration = endMin - startMin;

        // Validate minimum booking duration
        if (duration < pricingRow.min_booking_minutes) {
            return res.status(400).json({ message: `Thời lượng tối thiểu là ${pricingRow.min_booking_minutes} phút` });
        }

        // Validate slot step
        if (duration % pricingRow.slot_step_minutes !== 0) {
            return res.status(400).json({ message: `Mốc thời gian phải là bội của ${pricingRow.slot_step_minutes} phút` });
        }

        // Determine price based on peak hours and weekend
        let unitPrice = pricingRow.price_per_hour;
        const bookingDay = new Date(match_date).getDay(); // 6 = Sat, 0 = Sun
        if ((bookingDay === 6 || bookingDay === 0) && pricingRow.weekend_price_per_hour > 0) {
            unitPrice = pricingRow.weekend_price_per_hour;
        } else if (
            pricingRow.peak_start_time && pricingRow.peak_end_time &&
            start_time >= pricingRow.peak_start_time && end_time <= pricingRow.peak_end_time &&
            pricingRow.peak_price_per_hour > 0
        ) {
            unitPrice = pricingRow.peak_price_per_hour;
        }

        const total_cost = (unitPrice / 60) * duration;
        const mp = max_players || 4;

        const result = await pool.request()
            .input('creator_id', sql.Int, req.user.id).input('court_id', sql.Int, court_id)
            .input('match_date', sql.Date, match_date).input('start_time', sql.NVarChar, start_time)
            .input('end_time', sql.NVarChar, end_time).input('max_players', sql.Int, mp)
            .input('total_cost', sql.Decimal(12, 2), total_cost).input('commission_rate', sql.Decimal(4, 2), COMMISSION)
            .query(`INSERT INTO matches (creator_id, court_id, match_date, start_time, end_time, max_players, total_cost, commission_rate)
              OUTPUT INSERTED.id VALUES (@creator_id, @court_id, @match_date, @start_time, @end_time, @max_players, @total_cost, @commission_rate)`);

        const matchId = result.recordset[0].id;
        const costPerPerson = total_cost / mp;

        await pool.request()
            .input('match_id', sql.Int, matchId).input('user_id', sql.Int, req.user.id)
            .input('amount_due', sql.Decimal(12, 2), costPerPerson)
            .query("INSERT INTO match_players (match_id, user_id, amount_due, status) VALUES (@match_id, @user_id, @amount_due, 'joined')");

        const room = await pool.request()
            .input('match_id', sql.Int, matchId).input('name', sql.NVarChar, `Trận #${matchId}`)
            .query('INSERT INTO chat_rooms (match_id, name) OUTPUT INSERTED.id VALUES (@match_id, @name)');

        await pool.request()
            .input('chat_room_id', sql.Int, room.recordset[0].id).input('user_id', sql.Int, req.user.id)
            .query('INSERT INTO chat_room_members (chat_room_id, user_id) VALUES (@chat_room_id, @user_id)');

        res.status(201).json({ message: 'Tạo trận thành công', matchId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// Get all matches
export const getAllMatches = async (req, res) => {
    try {
        const { status } = req.query;
        const pool = await poolPromise;
        const request = pool.request();
        let q = 'SELECT m.*, c.name AS court_name, c.address, u.full_name AS creator_name FROM matches m JOIN courts c ON m.court_id = c.id JOIN users u ON m.creator_id = u.id';
        if (status) { request.input('status', sql.NVarChar, status); q += ' WHERE m.status = @status'; }
        q += ' ORDER BY m.created_at DESC';
        const result = await request.query(q);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// Get match by ID
export const getMatchById = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().input('id', sql.Int, req.params.id)
            .query('SELECT m.*, c.name AS court_name, c.address, u.full_name AS creator_name FROM matches m JOIN courts c ON m.court_id = c.id JOIN users u ON m.creator_id = u.id WHERE m.id = @id');
        if (result.recordset.length === 0) return res.status(404).json({ message: 'Không tìm thấy trận' });

        const players = await pool.request().input('match_id', sql.Int, req.params.id)
            .query('SELECT mp.*, u.full_name, u.avatar FROM match_players mp JOIN users u ON mp.user_id = u.id WHERE mp.match_id = @match_id');

        res.json({ ...result.recordset[0], players: players.recordset });
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// Join match
export const joinMatch = async (req, res) => {
    try {
        const pool = await poolPromise;
        const match = await pool.request().input('id', sql.Int, req.params.id).query('SELECT * FROM matches WHERE id = @id');
        if (match.recordset.length === 0) return res.status(404).json({ message: 'Không tìm thấy trận' });
        const m = match.recordset[0];
        if (m.status !== 'waiting') return res.status(400).json({ message: 'Trận không còn chỗ trống' });
        if (m.current_players >= m.max_players) return res.status(400).json({ message: 'Trận đã đầy' });

        const existing = await pool.request().input('match_id', sql.Int, req.params.id).input('user_id', sql.Int, req.user.id)
            .query("SELECT id FROM match_players WHERE match_id = @match_id AND user_id = @user_id AND status = 'joined'");
        if (existing.recordset.length > 0) return res.status(400).json({ message: 'Bạn đã trong trận này rồi' });

        const costPerPerson = m.total_cost / m.max_players;
        await pool.request().input('match_id', sql.Int, req.params.id).input('user_id', sql.Int, req.user.id)
            .input('amount_due', sql.Decimal(12, 2), costPerPerson)
            .query('INSERT INTO match_players (match_id, user_id, amount_due) VALUES (@match_id, @user_id, @amount_due)');

        const newCount = m.current_players + 1;
        const newStatus = newCount >= m.max_players ? 'confirmed' : 'waiting';
        await pool.request().input('current_players', sql.Int, newCount).input('status', sql.NVarChar, newStatus).input('id', sql.Int, req.params.id)
            .query('UPDATE matches SET current_players = @current_players, status = @status WHERE id = @id');

        const room = await pool.request().input('match_id', sql.Int, req.params.id).query('SELECT id FROM chat_rooms WHERE match_id = @match_id');
        if (room.recordset.length > 0) {
            await pool.request().input('chat_room_id', sql.Int, room.recordset[0].id).input('user_id', sql.Int, req.user.id)
                .query('INSERT INTO chat_room_members (chat_room_id, user_id) VALUES (@chat_room_id, @user_id)');
        }

        res.json({ message: 'Đã tham gia trận', currentPlayers: newCount });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// Leave match
export const leaveMatch = async (req, res) => {
    try {
        const pool = await poolPromise;
        const match = await pool.request().input('id', sql.Int, req.params.id).query('SELECT creator_id FROM matches WHERE id = @id');
        if (match.recordset.length === 0) return res.status(404).json({ message: 'Không tìm thấy trận' });
        if (match.recordset[0].creator_id === req.user.id) return res.status(400).json({ message: 'Người tạo không thể rời trận' });

        await pool.request().input('match_id', sql.Int, req.params.id).input('user_id', sql.Int, req.user.id)
            .query("UPDATE match_players SET status = 'left' WHERE match_id = @match_id AND user_id = @user_id");
        await pool.request().input('id', sql.Int, req.params.id)
            .query("UPDATE matches SET current_players = current_players - 1, status = 'waiting' WHERE id = @id");
        res.json({ message: 'Đã rời trận' });
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server' });
    }
};

