import { sql, poolPromise } from '../config/db';
import { getIO } from '../socket/index';
import { createNotification } from './notification.controller';

// Get single post by ID
export const getPostById = async (req, res) => {
    try {
        const postId = parseInt(req.params.id);
        const pool = await poolPromise;
        const result = await pool.request()
            .input('id', sql.Int, postId)
            .query(`SELECT p.*, u.full_name AS user_name, u.avatar, u.role AS user_role,
                (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) AS likes,
                (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comments,
                (SELECT COUNT(*) FROM post_shares ps WHERE ps.post_id = p.id) AS shares
                FROM posts p JOIN users u ON p.user_id = u.id WHERE p.id = @id`);
        if (result.recordset.length === 0) return res.status(404).json({ message: 'Không tìm thấy bài viết' });
        const post = result.recordset[0];
        if (post.created_at) post.created_at = new Date(post.created_at).toISOString();
        res.json(post);
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// Create post
export const createPost = async (req, res) => {
    try {
        const { content, image, post_type } = req.body;
        const pool = await poolPromise;
        const result = await pool.request()
            .input('user_id', sql.Int, req.user.id)
            .input('content', sql.NVarChar(sql.MAX), content)
            .input('image', sql.NVarChar(sql.MAX), image || null)
            .input('post_type', sql.NVarChar, post_type || 'share')
            .query(`INSERT INTO posts (user_id, content, image, post_type) OUTPUT INSERTED.id VALUES (@user_id, @content, @image, @post_type)`);

        const postId = result.recordset[0].id;
        const postRes = await pool.request()
            .input('id', sql.Int, postId)
            .query(`SELECT p.*, u.full_name AS user_name, u.avatar, u.role AS user_role,
                (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) AS likes,
                (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comments,
                (SELECT COUNT(*) FROM post_shares ps WHERE ps.post_id = p.id) AS shares
                FROM posts p JOIN users u ON p.user_id = u.id WHERE p.id = @id`);

        const createdPost = postRes.recordset[0];
        if (createdPost?.created_at) createdPost.created_at = new Date(createdPost.created_at).toISOString();

        try {
            getIO()?.emit('post_created', createdPost);
        } catch { }

        res.status(201).json({ message: 'Đã đăng bài', postId, post: createdPost });
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// Get all posts
export const getAllPosts = async (req, res) => {
    try {
        const { type, sort } = req.query;
        const pool = await poolPromise;
        const request = pool.request();
        // alias full_name to user_name so frontend can display author correctly
        let sql_query = `SELECT TOP 50 p.*, u.full_name AS user_name, u.avatar, u.role AS user_role,
            (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) AS likes,
            (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comments,
            (SELECT COUNT(*) FROM post_shares ps WHERE ps.post_id = p.id) AS shares
            FROM posts p JOIN users u ON p.user_id = u.id`;
        if (type) {
            request.input('type', sql.NVarChar, type);
            sql_query += ' WHERE p.post_type = @type';
        }
        sql_query += sort === 'popular' ? ' ORDER BY p.is_promoted DESC, p.created_at DESC' : ' ORDER BY p.created_at DESC';
        const result = await request.query(sql_query);
        // normalize created_at to ISO UTC strings to avoid client timezone mismatch
        const rows = result.recordset.map(r => ({
            ...r,
            created_at: r.created_at ? new Date(r.created_at).toISOString() : null
        }));
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// Delete post
export const deletePost = async (req, res) => {
    try {
        const postId = parseInt(req.params.id);
        const pool = await poolPromise;
        const post = await pool.request().input('id', sql.Int, postId).query('SELECT user_id FROM posts WHERE id = @id');
        if (post.recordset.length === 0) return res.status(404).json({ message: 'Không tìm thấy bài viết' });
        if (post.recordset[0].user_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Không có quyền' });
        }
        await pool.request().input('id', sql.Int, postId).query('DELETE FROM posts WHERE id = @id');
        try {
            getIO()?.emit('post_deleted', { postId });
        } catch { }
        res.json({ message: 'Đã xóa bài viết' });
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// Like a post
export const likePost = async (req, res) => {
    try {
        const postId = parseInt(req.params.id);
        const pool = await poolPromise;
        const postRes = await pool.request().input('id', sql.Int, postId).query('SELECT id, user_id FROM posts WHERE id = @id');
        if (postRes.recordset.length === 0) return res.status(404).json({ message: 'Không tìm thấy bài viết' });
        const postOwnerId = postRes.recordset[0].user_id;

        try {
            await pool.request()
                .input('post_id', sql.Int, postId)
                .input('user_id', sql.Int, req.user.id)
                .query('INSERT INTO post_likes (post_id, user_id) VALUES (@post_id, @user_id)');
        } catch (err) {
            // ignore duplicate key (already liked)
        }

        const likesRes = await pool.request().input('post_id', sql.Int, postId).query('SELECT COUNT(*) AS cnt FROM post_likes WHERE post_id = @post_id');
        const likes = likesRes.recordset[0].cnt;
        // Broadcast real-time like count
        try { getIO()?.to(`post_${postId}`).emit('post_liked', { postId, likes }); } catch { }
        // Notify post owner (not self)
        if (postOwnerId !== req.user.id) {
            await createNotification(postOwnerId, '❤️ Thích mới', `${req.user.full_name} đã thích bài viết của bạn`, 'like', postId);
            try { getIO()?.to(`user_${postOwnerId}`).emit('new_notification'); } catch { }
        }
        res.json({ message: 'Đã thích', likes });
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// Unlike a post
export const unlikePost = async (req, res) => {
    try {
        const postId = parseInt(req.params.id);
        const pool = await poolPromise;
        await pool.request().input('post_id', sql.Int, postId).input('user_id', sql.Int, req.user.id).query('DELETE FROM post_likes WHERE post_id = @post_id AND user_id = @user_id');
        const likesRes = await pool.request().input('post_id', sql.Int, postId).query('SELECT COUNT(*) AS cnt FROM post_likes WHERE post_id = @post_id');
        const likes = likesRes.recordset[0].cnt;
        try { getIO()?.to(`post_${postId}`).emit('post_liked', { postId, likes }); } catch { }
        res.json({ message: 'Bỏ thích', likes });
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// Get comments for a post
export const getComments = async (req, res) => {
    try {
        const postId = parseInt(req.params.id);
        const pool = await poolPromise;
        const result = await pool.request()
            .input('post_id', sql.Int, postId)
            .query(`SELECT c.id, c.content, c.created_at, u.id AS user_id, u.full_name AS user_name, u.avatar
                FROM comments c JOIN users u ON c.user_id = u.id
                WHERE c.post_id = @post_id ORDER BY c.created_at DESC`);
        const rows = result.recordset.map(r => ({ ...r, created_at: r.created_at ? new Date(r.created_at).toISOString() : null }));
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// Add comment to a post
export const addComment = async (req, res) => {
    try {
        const postId = parseInt(req.params.id);
        const { content } = req.body;
        if (!content || !content.trim()) return res.status(400).json({ message: 'Nội dung bình luận không được trống' });
        const pool = await poolPromise;
        const postRes = await pool.request().input('id', sql.Int, postId).query('SELECT id, user_id FROM posts WHERE id = @id');
        if (postRes.recordset.length === 0) return res.status(404).json({ message: 'Không tìm thấy bài viết' });
        const postOwnerId = postRes.recordset[0].user_id;

        const insert = await pool.request()
            .input('post_id', sql.Int, postId)
            .input('user_id', sql.Int, req.user.id)
            .input('content', sql.NVarChar, content)
            .query('INSERT INTO comments (post_id, user_id, content) OUTPUT INSERTED.id, INSERTED.created_at VALUES (@post_id, @user_id, @content)');

        const commentId = insert.recordset[0].id;

        const commentRes = await pool.request().input('id', sql.Int, commentId)
            .query('SELECT c.id, c.content, c.created_at, u.id AS user_id, u.full_name AS user_name, u.avatar FROM comments c JOIN users u ON c.user_id = u.id WHERE c.id = @id');

        const countRes = await pool.request().input('post_id', sql.Int, postId).query('SELECT COUNT(*) AS cnt FROM comments WHERE post_id = @post_id');

        const comment = commentRes.recordset[0];
        if (comment) comment.created_at = comment.created_at ? new Date(comment.created_at).toISOString() : null;
        const comments = countRes.recordset[0].cnt;
        // Broadcast real-time
        try { getIO()?.to(`post_${postId}`).emit('post_commented', { postId, comment, comments }); } catch { }
        // Notify post owner (not self)
        if (postOwnerId !== req.user.id) {
            const preview = content.length > 50 ? content.substring(0, 50) + '...' : content;
            await createNotification(postOwnerId, '💬 Bình luận mới', `${req.user.full_name}: "${preview}"`, 'comment', postId);
            try { getIO()?.to(`user_${postOwnerId}`).emit('new_notification'); } catch { }
        }
        res.status(201).json({ comment, comments });
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// Record share for a post
export const sharePost = async (req, res) => {
    try {
        const postId = parseInt(req.params.id);
        const pool = await poolPromise;
        const postRes = await pool.request().input('id', sql.Int, postId).query('SELECT id, user_id FROM posts WHERE id = @id');
        if (postRes.recordset.length === 0) return res.status(404).json({ message: 'Không tìm thấy bài viết' });
        const postOwnerId = postRes.recordset[0].user_id;

        await pool.request()
            .input('post_id', sql.Int, postId)
            .input('user_id', sql.Int, req.user?.id || null)
            .query('INSERT INTO post_shares (post_id, user_id) VALUES (@post_id, @user_id)');

        const sharesRes = await pool.request().input('post_id', sql.Int, postId).query('SELECT COUNT(*) AS cnt FROM post_shares WHERE post_id = @post_id');
        // Notify post owner (not self)
        if (req.user?.id && postOwnerId !== req.user.id) {
            await createNotification(postOwnerId, '🔗 Chia sẻ mới', `${req.user.full_name} đã chia sẻ bài viết của bạn`, 'share', postId);
            try { getIO()?.to(`user_${postOwnerId}`).emit('new_notification'); } catch { }
        }
        res.json({ message: 'Đã lưu chia sẻ', shares: sharesRes.recordset[0].cnt });
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server' });
    }
};

