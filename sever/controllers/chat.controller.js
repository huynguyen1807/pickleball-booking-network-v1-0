const { sql, poolPromise } = require('../config/db');

exports.getChatRooms = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().input('user_id', sql.Int, req.user.id).query(`
      SELECT cr.*,
        (SELECT TOP 1 content FROM messages WHERE chat_room_id = cr.id ORDER BY created_at DESC) AS last_message,
        (SELECT TOP 1 created_at FROM messages WHERE chat_room_id = cr.id ORDER BY created_at DESC) AS last_message_time
      FROM chat_rooms cr
      JOIN chat_room_members crm ON cr.id = crm.chat_room_id
      WHERE crm.user_id = @user_id ORDER BY cr.created_at DESC
    `);
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ message: 'Lỗi server' }); }
};

exports.getMessages = async (req, res) => {
    try {
        const pool = await poolPromise;
        const member = await pool.request()
            .input('room_id', sql.Int, req.params.roomId).input('user_id', sql.Int, req.user.id)
            .query('SELECT id FROM chat_room_members WHERE chat_room_id = @room_id AND user_id = @user_id');
        if (member.recordset.length === 0) return res.status(403).json({ message: 'Không có quyền' });

        const result = await pool.request().input('room_id', sql.Int, req.params.roomId)
            .query('SELECT TOP 100 m.*, u.full_name, u.avatar FROM messages m JOIN users u ON m.user_id = u.id WHERE m.chat_room_id = @room_id ORDER BY m.created_at ASC');
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ message: 'Lỗi server' }); }
};

exports.sendMessage = async (req, res) => {
    try {
        const { content } = req.body;
        const pool = await poolPromise;
        const member = await pool.request()
            .input('room_id', sql.Int, req.params.roomId).input('user_id', sql.Int, req.user.id)
            .query('SELECT id FROM chat_room_members WHERE chat_room_id = @room_id AND user_id = @user_id');
        if (member.recordset.length === 0) return res.status(403).json({ message: 'Không có quyền' });

        const result = await pool.request()
            .input('chat_room_id', sql.Int, req.params.roomId).input('user_id', sql.Int, req.user.id)
            .input('content', sql.NVarChar, content)
            .query('INSERT INTO messages (chat_room_id, user_id, content) OUTPUT INSERTED.id VALUES (@chat_room_id, @user_id, @content)');
        res.status(201).json({ message: 'Đã gửi', messageId: result.recordset[0].id });
    } catch (err) { res.status(500).json({ message: 'Lỗi server' }); }
};
