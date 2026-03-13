import { sql, poolPromise } from '../config/db';
import dotenv from 'dotenv';
dotenv.config();
const COMMISSION = parseFloat(process.env.COMMISSION_RATE) || 0.05;

// Create booking
export const createBooking = async (req, res) => {
    try {
        const { court_id, booking_date, start_time, end_time, payment_method } = req.body;
        const pool = await poolPromise;
        const isPayOS = payment_method === 'payos';

        const courtQuery = await pool.request().input('id', sql.Int, court_id)
            .query('SELECT price_per_hour, peak_start_time, peak_end_time, peak_price FROM courts WHERE id = @id AND is_active = 1');
        if (courtQuery.recordset.length === 0) return res.status(404).json({ message: 'Sân không tồn tại' });

        const court = courtQuery.recordset[0];

        const startH = parseFloat(start_time.split(':')[0]) + parseFloat(start_time.split(':')[1]) / 60;
        const endH = parseFloat(end_time.split(':')[0]) + parseFloat(end_time.split(':')[1]) / 60;

        const extractTimeH = (timeStr: any) => {
            if (!timeStr) return null;
            const str = timeStr instanceof Date ? timeStr.toISOString() : String(timeStr);
            const match = str.match(/\d{2}:\d{2}/);
            if (!match) return null;
            const [h, m] = match[0].split(':').map(Number);
            return h + m / 60;
        };

        const peakStartH = extractTimeH(court.peak_start_time);
        const peakEndH = extractTimeH(court.peak_end_time);

        let peakHours = 0;
        if (court.peak_price && peakStartH !== null && peakEndH !== null) {
            const overlapStart = Math.max(startH, peakStartH);
            const overlapEnd = Math.min(endH, peakEndH);
            if (overlapStart < overlapEnd) {
                peakHours = overlapEnd - overlapStart;
            }
        }

        const regularHours = (endH - startH) - peakHours;
        const regularPrice = regularHours * court.price_per_hour;
        const peakPriceTotal = peakHours * (court.peak_price || court.price_per_hour);
        const total = Math.round(regularPrice + peakPriceTotal);
        const commission = Math.round(total * COMMISSION);

        const result = await pool.request()
            .input('user_id', sql.Int, req.user.id).input('court_id', sql.Int, court_id)
            .input('booking_date', sql.Date, booking_date).input('start_time', sql.NVarChar, start_time)
            .input('end_time', sql.NVarChar, end_time).input('total_price', sql.Decimal(12, 2), total)
            .input('commission_rate', sql.Decimal(4, 2), COMMISSION).input('commission_amount', sql.Decimal(12, 2), commission)
            .input('payment_method', sql.NVarChar, payment_method || 'mock')
            .input('status', sql.NVarChar, isPayOS ? 'pending' : 'confirmed')
            .query(`INSERT INTO bookings (user_id, court_id, booking_date, start_time, end_time, total_price, commission_rate, commission_amount, payment_method, status)
                            OUTPUT INSERTED.id VALUES (@user_id, @court_id, @booking_date, @start_time, @end_time, @total_price, @commission_rate, @commission_amount, @payment_method, @status)`);

        if (!isPayOS) {
            await pool.request()
                .input('user_id', sql.Int, req.user.id).input('booking_id', sql.Int, result.recordset[0].id)
                .input('amount', sql.Decimal(12, 2), total).input('commission', sql.Decimal(12, 2), commission)
                .input('payment_method', sql.NVarChar, payment_method || 'mock')
                .query("INSERT INTO payments (user_id, booking_id, amount, commission, payment_method, status) VALUES (@user_id, @booking_id, @amount, @commission, @payment_method, 'completed')");
        }

        res.status(201).json({ message: 'Đặt sân thành công', bookingId: result.recordset[0].id, total });
    } catch (err) {
        console.error("LỖI TAO BOOKING:", err);
        res.status(500).json({ message: 'Lỗi server', error: err.message });
    }
};

// Get user bookings
export const getMyBookings = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().input('user_id', sql.Int, req.user.id)
            .query(`
                SELECT
                    b.id, b.user_id, b.court_id, b.court_slot_id,
                    b.booking_date,
                    CONVERT(NVARCHAR(8), b.start_time, 108) AS start_time,
                    CONVERT(NVARCHAR(8), b.end_time, 108) AS end_time,
                    b.total_price, b.commission_rate, b.commission_amount,
                    LTRIM(RTRIM(LOWER(b.status))) AS status,
                    b.payment_method, b.created_at,
                    c.name AS court_name,
                    f.name AS facility_name,
                    f.address
                FROM bookings b
                LEFT JOIN courts c ON b.court_id = c.id
                LEFT JOIN facilities f ON c.facility_id = f.id
                WHERE b.user_id = @user_id
                ORDER BY b.created_at DESC
            `);
        console.log('[getMyBookings] user_id:', req.user.id, '| rows:', result.recordset.length, '| statuses:', result.recordset.map((b: any) => b.status));
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// Get bookings for owner courts
export const getOwnerBookings = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().input('owner_id', sql.Int, req.user.id)
            .query('SELECT b.*, c.name AS court_name, u.full_name AS user_name FROM bookings b JOIN courts c ON b.court_id = c.id JOIN facilities f ON c.facility_id = f.id JOIN users u ON b.user_id = u.id WHERE f.owner_id = @owner_id ORDER BY b.created_at DESC');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// Cancel booking
export const cancelBooking = async (req, res) => {
    try {
        const pool = await poolPromise;
        const booking = await pool.request().input('id', sql.Int, req.params.id).query('SELECT user_id, status FROM bookings WHERE id = @id');
        if (booking.recordset.length === 0) return res.status(404).json({ message: 'Không tìm thấy booking' });
        if (booking.recordset[0].user_id !== req.user.id) return res.status(403).json({ message: 'Không có quyền' });
        if (booking.recordset[0].status !== 'pending' && booking.recordset[0].status !== 'confirmed') {
            return res.status(400).json({ message: 'Không thể hủy booking này' });
        }
        await pool.request().input('id', sql.Int, req.params.id).query("UPDATE bookings SET status = 'cancelled' WHERE id = @id");
        res.json({ message: 'Đã hủy booking' });
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// Get booked slots for a court on a specific date
export const getBookedSlots = async (req, res) => {
    try {
        const { courtId, date } = req.params;
        const pool = await poolPromise;
        const result = await pool.request()
            .input('court_id', sql.Int, courtId)
            .input('booking_date', sql.Date, date)
            .query(`
                SELECT start_time, end_time 
                FROM bookings 
                WHERE court_id = @court_id 
                AND booking_date = @booking_date
                AND status IN ('confirmed', 'pending')
            `);
        res.json(result.recordset);
    } catch (err) {
        console.error("Lỗi lấy khung giờ đã đặt:", err);
        res.status(500).json({ message: 'Lỗi server' });
    }
};
