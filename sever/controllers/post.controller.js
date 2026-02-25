const { sql, poolPromise } = require('../config/db');

// Create post
exports.createPost = async (req, res) => {
    try {
        const { content, image, post_type } = req.body;
        const pool = await poolPromise;
        const result = await pool.request()
            .input('user_id', sql.Int, req.user.id)
            .input('content', sql.NVarChar, content)
            .input('image', sql.NVarChar, image || null)
            .input('post_type', sql.NVarChar, post_type || 'share')
            .query(`INSERT INTO posts (user_id, content, image, post_type) OUTPUT INSERTED.id VALUES (@user_id, @content, @image, @post_type)`);
        res.status(201).json({ message: 'Đã đăng bài', postId: result.recordset[0].id });
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// Get all posts
exports.getAllPosts = async (req, res) => {
    try {
        const { type, sort } = req.query;
        const pool = await poolPromise;
        const request = pool.request();
        let sql_query = 'SELECT TOP 50 p.*, u.full_name, u.avatar, u.role AS user_role FROM posts p JOIN users u ON p.user_id = u.id';
        if (type) {
            request.input('type', sql.NVarChar, type);
            sql_query += ' WHERE p.post_type = @type';
        }
        sql_query += sort === 'popular' ? ' ORDER BY p.is_promoted DESC, p.created_at DESC' : ' ORDER BY p.created_at DESC';
        const result = await request.query(sql_query);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// Delete post
exports.deletePost = async (req, res) => {
    try {
        const pool = await poolPromise;
        const post = await pool.request().input('id', sql.Int, req.params.id).query('SELECT user_id FROM posts WHERE id = @id');
        if (post.recordset.length === 0) return res.status(404).json({ message: 'Không tìm thấy bài viết' });
        if (post.recordset[0].user_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Không có quyền' });
        }
        await pool.request().input('id', sql.Int, req.params.id).query('DELETE FROM posts WHERE id = @id');
        res.json({ message: 'Đã xóa bài viết' });
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server' });
    }
};
