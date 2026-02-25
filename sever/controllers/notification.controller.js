const { sql, poolPromise } = require('../config/db');

exports.getNotifications = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().input('user_id', sql.Int, req.user.id)
            .query('SELECT TOP 30 * FROM notifications WHERE user_id = @user_id ORDER BY created_at DESC');
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ message: 'Lỗi server' }); }
};

exports.markRead = async (req, res) => {
    try {
        const pool = await poolPromise;
        await pool.request().input('id', sql.Int, req.params.id).input('user_id', sql.Int, req.user.id)
            .query('UPDATE notifications SET is_read = 1 WHERE id = @id AND user_id = @user_id');
        res.json({ message: 'Đã đánh dấu đã đọc' });
    } catch (err) { res.status(500).json({ message: 'Lỗi server' }); }
};

exports.markAllRead = async (req, res) => {
    try {
        const pool = await poolPromise;
        await pool.request().input('user_id', sql.Int, req.user.id)
            .query('UPDATE notifications SET is_read = 1 WHERE user_id = @user_id');
        res.json({ message: 'Đã đánh dấu tất cả đã đọc' });
    } catch (err) { res.status(500).json({ message: 'Lỗi server' }); }
};

exports.createNotification = async (userId, title, message, type, referenceId) => {
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('user_id', sql.Int, userId).input('title', sql.NVarChar, title)
            .input('message', sql.NVarChar, message).input('type', sql.NVarChar, type)
            .input('reference_id', sql.Int, referenceId)
            .query('INSERT INTO notifications (user_id, title, message, type, reference_id) VALUES (@user_id, @title, @message, @type, @reference_id)');
    } catch (err) { console.error('Notification error:', err); }
};
