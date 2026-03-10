import { sql, poolPromise } from '../config/db';

export const getChatRooms = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().input('user_id', sql.Int, req.user.id).query(`
      SELECT cr.*,
        (SELECT TOP 1 content FROM messages WHERE chat_room_id = cr.id ORDER BY created_at DESC) AS last_message,
        (SELECT TOP 1 created_at FROM messages WHERE chat_room_id = cr.id ORDER BY created_at DESC) AS last_message_time,
        (SELECT COUNT(*) FROM messages WHERE chat_room_id = cr.id AND user_id != @user_id AND is_read = 0) AS unread_count
      FROM chat_rooms cr
      JOIN chat_room_members crm ON cr.id = crm.chat_room_id
      WHERE crm.user_id = @user_id ORDER BY last_message_time DESC
    `);

        // For DM rooms, attach the other user's info
        const rooms = [];
        for (const room of result.recordset) {
            if (room.room_type === 'dm') {
                const other = await pool.request()
                    .input('room_id', sql.Int, room.id)
                    .input('user_id', sql.Int, req.user.id)
                    .query(`SELECT u.id, u.full_name, u.avatar, u.role FROM chat_room_members crm 
                            JOIN users u ON crm.user_id = u.id 
                            WHERE crm.chat_room_id = @room_id AND crm.user_id != @user_id`);
                room.other_user = other.recordset[0] || null;
            }
            rooms.push(room);
        }

        res.json(rooms);
    } catch (err) { res.status(500).json({ message: 'Lỗi server' }); }
};

export const getMessages = async (req, res) => {
    try {
        const pool = await poolPromise;
        const member = await pool.request()
            .input('room_id', sql.Int, req.params.roomId).input('user_id', sql.Int, req.user.id)
            .query('SELECT id FROM chat_room_members WHERE chat_room_id = @room_id AND user_id = @user_id');
        if (member.recordset.length === 0) return res.status(403).json({ message: 'Không có quyền' });

        // Mark messages as read
        await pool.request()
            .input('room_id', sql.Int, req.params.roomId)
            .input('user_id', sql.Int, req.user.id)
            .query('UPDATE messages SET is_read = 1 WHERE chat_room_id = @room_id AND user_id != @user_id AND is_read = 0');

        const result = await pool.request().input('room_id', sql.Int, req.params.roomId)
            .query('SELECT TOP 100 m.*, u.full_name, u.avatar FROM messages m JOIN users u ON m.user_id = u.id WHERE m.chat_room_id = @room_id ORDER BY m.created_at ASC');
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ message: 'Lỗi server' }); }
};

export const sendMessage = async (req, res) => {
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
            .query('INSERT INTO messages (chat_room_id, user_id, content) OUTPUT INSERTED.* VALUES (@chat_room_id, @user_id, @content)');

        // Get sender info
        const sender = await pool.request().input('id', sql.Int, req.user.id)
            .query('SELECT full_name, avatar FROM users WHERE id = @id');

        const msg = { ...result.recordset[0], full_name: sender.recordset[0]?.full_name, avatar: sender.recordset[0]?.avatar };
        res.status(201).json(msg);
    } catch (err) { res.status(500).json({ message: 'Lỗi server' }); }
};

// Create or get DM room between two users
export const getOrCreateDMRoom = async (req, res) => {
    try {
        const { targetUserId } = req.body;
        const myId = req.user.id;

        if (myId === targetUserId) return res.status(400).json({ message: 'Không thể chat với chính mình' });

        const pool = await poolPromise;

        // Check target user exists
        const targetUser = await pool.request().input('id', sql.Int, targetUserId)
            .query('SELECT id, full_name, avatar, role FROM users WHERE id = @id');
        if (targetUser.recordset.length === 0) return res.status(404).json({ message: 'Người dùng không tồn tại' });

        // Check if DM room already exists between these two users
        const existing = await pool.request()
            .input('user1', sql.Int, myId).input('user2', sql.Int, targetUserId)
            .query(`
                SELECT cr.id FROM chat_rooms cr
                WHERE cr.room_type = 'dm'
                AND EXISTS (SELECT 1 FROM chat_room_members WHERE chat_room_id = cr.id AND user_id = @user1)
                AND EXISTS (SELECT 1 FROM chat_room_members WHERE chat_room_id = cr.id AND user_id = @user2)
            `);

        if (existing.recordset.length > 0) {
            return res.json({ roomId: existing.recordset[0].id, isNew: false });
        }

        // Create new DM room
        const room = await pool.request()
            .input('name', sql.NVarChar, 'DM')
            .query("INSERT INTO chat_rooms (name, room_type) OUTPUT INSERTED.id VALUES (@name, 'dm')");
        const roomId = room.recordset[0].id;

        // Add both members
        await pool.request()
            .input('room_id', sql.Int, roomId).input('user_id', sql.Int, myId)
            .query('INSERT INTO chat_room_members (chat_room_id, user_id) VALUES (@room_id, @user_id)');
        await pool.request()
            .input('room_id', sql.Int, roomId).input('user_id', sql.Int, targetUserId)
            .query('INSERT INTO chat_room_members (chat_room_id, user_id) VALUES (@room_id, @user_id)');

        res.status(201).json({ roomId, isNew: true });
    } catch (err) {
        console.error('DM room error:', err);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// Get total unread count
export const getUnreadCount = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().input('user_id', sql.Int, req.user.id).query(`
            SELECT COUNT(*) as total FROM messages m
            JOIN chat_room_members crm ON m.chat_room_id = crm.chat_room_id
            WHERE crm.user_id = @user_id AND m.user_id != @user_id AND m.is_read = 0
        `);
        res.json({ count: result.recordset[0].total });
    } catch (err) { res.status(500).json({ message: 'Lỗi server' }); }
};

