import { sql, poolPromise } from '../config/db';

export const getPaymentHistory = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().input('user_id', sql.Int, req.user.id).query(`
      SELECT p.*, b.booking_date, c.name AS court_name
      FROM payments p
      LEFT JOIN bookings b ON p.booking_id = b.id
      LEFT JOIN matches m ON p.match_id = m.id
      LEFT JOIN courts c ON (b.court_id = c.id OR m.court_id = c.id)
      WHERE p.user_id = @user_id ORDER BY p.created_at DESC
    `);
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ message: 'Lỗi server' }); }
};

export const processPayment = async (req, res) => {
    try {
        const { booking_id, match_id, amount, payment_method } = req.body;
        const commission = amount * 0.05;
        const pool = await poolPromise;

        const result = await pool.request()
            .input('user_id', sql.Int, req.user.id)
            .input('booking_id', sql.Int, booking_id || null)
            .input('match_id', sql.Int, match_id || null)
            .input('amount', sql.Decimal(12, 2), amount)
            .input('commission', sql.Decimal(12, 2), commission)
            .input('payment_method', sql.NVarChar, payment_method || 'mock')
            .query("INSERT INTO payments (user_id, booking_id, match_id, amount, commission, payment_method, status) OUTPUT INSERTED.id VALUES (@user_id, @booking_id, @match_id, @amount, @commission, @payment_method, 'completed')");

        if (match_id) {
            await pool.request().input('match_id', sql.Int, match_id).input('user_id', sql.Int, req.user.id)
                .query("UPDATE match_players SET payment_status = 'paid' WHERE match_id = @match_id AND user_id = @user_id");
        }
        res.json({ message: 'Thanh toán thành công', paymentId: result.recordset[0].id });
    } catch (err) { res.status(500).json({ message: 'Lỗi server' }); }
};

