import { sql, poolPromise } from '../config/db';

export const getNotifications = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().input('user_id', sql.Int, req.user.id)
            .query(`SELECT TOP 50 n.id, n.title, n.message, n.type, n.reference_id, n.is_read, n.created_at,
                CASE n.type 
                    WHEN 'like'    THEN '❤️'
                    WHEN 'comment' THEN '💬'
                    WHEN 'share'   THEN '🔗'
                    WHEN 'match_join' THEN '✅'
                    WHEN 'match_payment_confirmed' THEN '💰'
                    WHEN 'booking_confirmed' THEN '🎫'
                    WHEN 'match_full' THEN '🏆'
                    WHEN 'match_cancelled' THEN '❌'
                    WHEN 'match_created' THEN '🎯'
                    WHEN 'booking_payment' THEN '💵'
                    WHEN 'match_payment_owner' THEN '💰'
                    ELSE '🔔'
                END AS icon
                FROM notifications n
                WHERE n.user_id = @user_id
                ORDER BY n.created_at DESC`);
        const rows = result.recordset.map(r => ({
            ...r,
            created_at: r.created_at ? new Date(r.created_at).toISOString() : null
        }));
        res.json(rows);
    } catch (err) { res.status(500).json({ message: 'Lỗi server' }); }
};

export const getUnreadCount = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().input('user_id', sql.Int, req.user.id)
            .query('SELECT COUNT(*) AS cnt FROM notifications WHERE user_id = @user_id AND is_read = 0');
        res.json({ count: result.recordset[0].cnt });
    } catch (err) { res.status(500).json({ message: 'Lỗi server' }); }
};

export const markRead = async (req, res) => {
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .input('user_id', sql.Int, req.user.id)
            .query('UPDATE notifications SET is_read = 1 WHERE id = @id AND user_id = @user_id');
        res.json({ message: 'Đã đánh dấu đã đọc' });
    } catch (err) { res.status(500).json({ message: 'Lỗi server' }); }
};

export const markAllRead = async (req, res) => {
    try {
        const pool = await poolPromise;
        await pool.request().input('user_id', sql.Int, req.user.id)
            .query('UPDATE notifications SET is_read = 1 WHERE user_id = @user_id');
        res.json({ message: 'Đã đánh dấu tất cả đã đọc' });
    } catch (err) { res.status(500).json({ message: 'Lỗi server' }); }
};

export const createNotification = async (userId: number, title: string, message: string, type: string, referenceId: number) => {
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('user_id', sql.Int, userId)
            .input('title', sql.NVarChar, title)
            .input('message', sql.NVarChar, message)
            .input('type', sql.NVarChar, type)
            .input('reference_id', sql.Int, referenceId)
            .query('INSERT INTO notifications (user_id, title, message, type, reference_id) VALUES (@user_id, @title, @message, @type, @reference_id)');
    } catch (err) { console.error('Notification error:', err); }
};
