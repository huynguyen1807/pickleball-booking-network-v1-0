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

        const court = await pool.request().input('id', sql.Int, court_id)
            .query('SELECT price_per_hour FROM courts WHERE id = @id AND is_active = 1');
        if (court.recordset.length === 0) return res.status(404).json({ message: 'Sân không tồn tại' });

        const startH = parseInt(start_time.split(':')[0]);
        const endH = parseInt(end_time.split(':')[0]);
        const hours = endH - startH;
        const total = court.recordset[0].price_per_hour * hours;
        const commission = total * COMMISSION;

        const result = await pool.request()
            .input('user_id', sql.Int, req.user.id).input('court_id', sql.Int, court_id)
            .input('booking_date', sql.Date, booking_date).input('start_time', sql.NVarChar, start_time)
            .input('end_time', sql.NVarChar, end_time).input('total_price', sql.Decimal(12, 2), total + commission)
            .input('commission_rate', sql.Decimal(4, 2), COMMISSION).input('commission_amount', sql.Decimal(12, 2), commission)
            .input('payment_method', sql.NVarChar, payment_method || 'mock')
            .input('status', sql.NVarChar, isPayOS ? 'pending' : 'confirmed')
            .query(`INSERT INTO bookings (user_id, court_id, booking_date, start_time, end_time, total_price, commission_rate, commission_amount, payment_method, status)
                            OUTPUT INSERTED.id VALUES (@user_id, @court_id, @booking_date, @start_time, @end_time, @total_price, @commission_rate, @commission_amount, @payment_method, @status)`);

        if (!isPayOS) {
            await pool.request()
                .input('user_id', sql.Int, req.user.id).input('booking_id', sql.Int, result.recordset[0].id)
                .input('amount', sql.Decimal(12, 2), total + commission).input('commission', sql.Decimal(12, 2), commission)
                .input('payment_method', sql.NVarChar, payment_method || 'mock')
                .query("INSERT INTO payments (user_id, booking_id, amount, commission, payment_method, status) VALUES (@user_id, @booking_id, @amount, @commission, @payment_method, 'completed')");
        }

        res.status(201).json({ message: 'Đặt sân thành công', bookingId: result.recordset[0].id, total: total + commission });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// Get user bookings
export const getMyBookings = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().input('user_id', sql.Int, req.user.id)
            .query('SELECT b.*, c.name AS court_name, c.address FROM bookings b JOIN courts c ON b.court_id = c.id WHERE b.user_id = @user_id ORDER BY b.created_at DESC');
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

