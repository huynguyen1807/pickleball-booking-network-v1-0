import { sql, poolPromise } from '../config/db';

export const getUpgradeRequests = async (req, res) => {
    try {
        const { status } = req.query;
        const pool = await poolPromise;
        const request = pool.request();
        let q = 'SELECT ur.*, u.full_name, u.email, u.phone FROM upgrade_requests ur JOIN users u ON ur.user_id = u.id';
        if (status) { request.input('status', sql.NVarChar, status); q += ' WHERE ur.status = @status'; }
        q += ' ORDER BY ur.created_at DESC';
        const result = await request.query(q);
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ message: 'Lỗi server' }); }
};

export const approveUpgrade = async (req, res) => {
    try {
        const pool = await poolPromise;
        const request_data = await pool.request().input('id', sql.Int, req.params.id)
            .query('SELECT user_id FROM upgrade_requests WHERE id = @id');
        if (request_data.recordset.length === 0) return res.status(404).json({ message: 'Không tìm thấy yêu cầu' });

        await pool.request().input('id', sql.Int, req.params.id)
            .query("UPDATE upgrade_requests SET status = 'approved' WHERE id = @id");
        await pool.request().input('id', sql.Int, request_data.recordset[0].user_id)
            .query("UPDATE users SET role = 'owner', status = 'active' WHERE id = @id");
        res.json({ message: 'Đã duyệt nâng cấp Owner' });
    } catch (err) { res.status(500).json({ message: 'Lỗi server' }); }
};

export const rejectUpgrade = async (req, res) => {
    try {
        const { admin_note } = req.body;
        const pool = await poolPromise;
        await pool.request().input('admin_note', sql.NVarChar, admin_note || null).input('id', sql.Int, req.params.id)
            .query("UPDATE upgrade_requests SET status = 'rejected', admin_note = @admin_note WHERE id = @id");
        res.json({ message: 'Đã từ chối yêu cầu' });
    } catch (err) { res.status(500).json({ message: 'Lỗi server' }); }
};

export const getAllUsers = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query('SELECT id, email, full_name, phone, role, status, created_at FROM users ORDER BY created_at DESC');
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ message: 'Lỗi server' }); }
};

export const toggleUserStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const pool = await poolPromise;
        await pool.request().input('status', sql.NVarChar, status).input('id', sql.Int, req.params.id)
            .query('UPDATE users SET status = @status WHERE id = @id');
        res.json({ message: 'Đã cập nhật trạng thái user' });
    } catch (err) { res.status(500).json({ message: 'Lỗi server' }); }
};

