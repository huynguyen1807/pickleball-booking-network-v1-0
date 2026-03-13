import { sql, poolPromise } from '../config/db';

// Get public profile by user ID
export const getUserProfile = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query(`
                SELECT u.id, u.full_name, u.avatar, u.role, u.phone, u.status, u.created_at,
                    (SELECT COUNT(*) FROM bookings WHERE user_id = u.id) AS total_bookings,
                    (SELECT COUNT(*) FROM match_players WHERE user_id = u.id AND status = 'joined') AS total_matches,
                    (SELECT COUNT(*) FROM posts WHERE user_id = u.id) AS total_posts
                FROM users u WHERE u.id = @id
            `);
        if (result.recordset.length === 0) return res.status(404).json({ message: 'Không tìm thấy người dùng' });
        res.json(result.recordset[0]);
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// Get brief user info (for hover card)
export const getUserBrief = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query(`
                SELECT u.id, u.full_name, u.avatar, u.role, u.status, u.created_at,
                    (SELECT COUNT(*) FROM match_players WHERE user_id = u.id AND status = 'joined') AS total_matches
                FROM users u WHERE u.id = @id
            `);
        if (result.recordset.length === 0) return res.status(404).json({ message: 'Không tìm thấy người dùng' });
        res.json(result.recordset[0]);
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// Update profile
export const updateProfile = async (req, res) => {
    try {
        const { full_name, phone, latitude, longitude } = req.body;
        const pool = await poolPromise;
        await pool.request()
            .input('full_name', sql.NVarChar, full_name)
            .input('phone', sql.NVarChar, phone)
            .input('latitude', sql.Decimal(10, 7), latitude || null)
            .input('longitude', sql.Decimal(10, 7), longitude || null)
            .input('id', sql.Int, req.user.id)
            .query('UPDATE users SET full_name = @full_name, phone = @phone, latitude = @latitude, longitude = @longitude WHERE id = @id');
        res.json({ message: 'Cập nhật thành công' });
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// Request upgrade to Owner
export const requestUpgrade = async (req, res) => {
    try {
        const { reason } = req.body;

        // Handle file upload
        let fileUrl = null;
        if (req.file) {
            fileUrl = `/uploads/${req.file.filename}`;
        }

        const pool = await poolPromise;
        const existing = await pool.request()
            .input('user_id', sql.Int, req.user.id)
            .query("SELECT id FROM upgrade_requests WHERE user_id = @user_id AND status = 'pending'");
        if (existing.recordset.length > 0) {
            return res.status(400).json({ message: 'Bạn đã gửi yêu cầu rồi, vui lòng chờ duyệt' });
        }
        await pool.request()
            .input('user_id', sql.Int, req.user.id)
            .input('reason', sql.NVarChar, reason)
            .input('business_license_url', sql.NVarChar(sql.MAX), fileUrl)
            .query('INSERT INTO upgrade_requests (user_id, reason, business_license_url) VALUES (@user_id, @reason, @business_license_url)');
        res.status(201).json({ message: 'Yêu cầu nâng cấp đã được gửi' });
    } catch (err) {
        console.error('Request upgrade error:', err);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// Get all users (admin)
export const getAllUsers = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .query('SELECT id, email, full_name, phone, role, status, created_at FROM users ORDER BY created_at DESC');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server' });
    }
};

