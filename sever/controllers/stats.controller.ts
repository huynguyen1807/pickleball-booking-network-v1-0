import { sql, poolPromise } from '../config/db';

export const getUserStats = async (req, res) => {
    try {
        const pool = await poolPromise;
        const uid = req.user.id;
        const r1 = await pool.request().input('uid', sql.Int, uid).query(`
            SELECT COUNT(DISTINCT m.id) AS matches_count
            FROM matches m
            WHERE m.creator_id = @uid
               OR EXISTS (
                    SELECT 1
                    FROM match_players mp
                    WHERE mp.match_id = m.id
                      AND mp.user_id = @uid
                      AND mp.status IN ('joined', 'waitlist')
               )
        `);
        const r2 = await pool.request().input('uid', sql.Int, uid).query('SELECT COUNT(*) AS bookings_count FROM bookings WHERE user_id = @uid');
        const r3 = await pool.request().input('uid', sql.Int, uid).query("SELECT ISNULL(SUM(amount),0) AS total_spent FROM payments WHERE user_id = @uid AND status='completed'");
        const r4 = await pool.request().input('uid', sql.Int, uid).query('SELECT ISNULL(AVG(CAST(rating AS FLOAT)),0) AS avg_rating FROM reviews WHERE user_id = @uid');

        res.json({
            matches_count: r1.recordset[0].matches_count,
            bookings_count: r2.recordset[0].bookings_count,
            total_spent: r3.recordset[0].total_spent,
            avg_rating: parseFloat(r4.recordset[0].avg_rating).toFixed(1)
        });
    } catch (err) { res.status(500).json({ message: 'Lỗi server' }); }
};

export const getOwnerStats = async (req, res) => {
    try {
        const pool = await poolPromise;
        const uid = req.user.id;
        const r1 = await pool.request().input('uid', sql.Int, uid).query('SELECT COUNT(*) AS total_bookings FROM bookings b JOIN courts c ON b.court_id = c.id JOIN facilities f ON c.facility_id = f.id WHERE f.owner_id = @uid');
        const r2 = await pool.request().input('uid', sql.Int, uid).query("SELECT ISNULL(SUM(b.total_price - b.commission_amount),0) AS revenue FROM bookings b JOIN courts c ON b.court_id = c.id JOIN facilities f ON c.facility_id = f.id WHERE f.owner_id = @uid AND b.status IN ('confirmed','completed')");
        const r3 = await pool.request().input('uid', sql.Int, uid).query('SELECT COUNT(*) AS match_count FROM matches m JOIN courts c ON m.court_id = c.id JOIN facilities f ON c.facility_id = f.id WHERE f.owner_id = @uid');
        const r4 = await pool.request().input('uid', sql.Int, uid).query('SELECT COUNT(*) AS court_count FROM courts c JOIN facilities f ON c.facility_id = f.id WHERE f.owner_id = @uid');
        const tb = r1.recordset[0].total_bookings;
        const cc = r4.recordset[0].court_count;
        const occupancy = tb > 0 ? Math.min(Math.round((tb / (cc * 30)) * 100), 100) : 0;

        res.json({ total_bookings: tb, revenue: r2.recordset[0].revenue, match_count: r3.recordset[0].match_count, court_count: cc, occupancy });
    } catch (err) { res.status(500).json({ message: 'Lỗi server' }); }
};

export const getAdminStats = async (req, res) => {
    try {
        const pool = await poolPromise;
        const r1 = await pool.request().query('SELECT COUNT(*) AS total_users FROM users');
        const r2 = await pool.request().query('SELECT COUNT(*) AS total_courts FROM courts WHERE is_active = 1');
        const r3 = await pool.request().query("SELECT ISNULL(SUM(commission),0) AS total_revenue FROM payments WHERE status='completed'");
        const r4 = await pool.request().query('SELECT COUNT(*) AS today_matches FROM matches WHERE match_date = CAST(GETDATE() AS DATE)');
        const r5 = await pool.request().query("SELECT COUNT(*) AS pending_requests FROM upgrade_requests WHERE status='pending'");
        const r6 = await pool.request().query('SELECT COUNT(*) AS today_bookings FROM bookings WHERE booking_date = CAST(GETDATE() AS DATE)');

        res.json({
            total_users: r1.recordset[0].total_users,
            total_courts: r2.recordset[0].total_courts,
            total_revenue: r3.recordset[0].total_revenue,
            today_matches: r4.recordset[0].today_matches,
            pending_requests: r5.recordset[0].pending_requests,
            today_bookings: r6.recordset[0].today_bookings
        });
    } catch (err) { res.status(500).json({ message: 'Lỗi server' }); }
};

