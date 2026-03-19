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

        const profile = result.recordset[0];

        // Nếu là chủ sân (owner), lấy luôn danh sách sân đang sở hữu
        if (profile.role === 'owner') {
            const facilitiesResult = await pool.request()
                .input('owner_id', sql.Int, req.params.id)
                .query('SELECT id, name, address, avatar, min_price = (SELECT ISNULL(MIN(price_per_hour), 0) FROM courts WHERE facility_id = facilities.id) FROM facilities WHERE owner_id = @owner_id AND is_active = 1');
            profile.owned_facilities = facilitiesResult.recordset;
        }

        res.json(profile);
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

// Get current user's balance (wallet)
export const getMyBalance = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('id', sql.Int, req.user.id)
            .query('SELECT ISNULL(balance, 0) AS balance FROM users WHERE id = @id');

        if (result.recordset.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy người dùng' });
        }

        res.json({ balance: Number(result.recordset[0].balance || 0) });
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// Get current user's wallet transactions (refund history)
export const getMyWalletTransactions = async (req, res) => {
    try {
        const pool = await poolPromise;

        const tableCheck = await pool.request()
            .query("SELECT OBJECT_ID('wallet_transactions', 'U') AS wallet_table_id");

        if (!tableCheck.recordset?.[0]?.wallet_table_id) {
            return res.json([]);
        }

        const result = await pool.request()
            .input('user_id', sql.Int, req.user.id)
            .query(`
                SELECT id, user_id, payment_id, amount, type, description, reference_type, reference_id, status, created_at
                FROM wallet_transactions
                WHERE user_id = @user_id
                ORDER BY created_at DESC
            `);

        res.json(result.recordset);
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

// Update avatar
export const updateAvatar = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Vui lòng chọn ảnh' });
        }

        const avatarUrl = `/uploads/avatars/${req.file.filename}`;

        const pool = await poolPromise;
        await pool.request()
            .input('avatar', sql.NVarChar, avatarUrl)
            .input('id', sql.Int, req.user.id)
            .query('UPDATE users SET avatar = @avatar WHERE id = @id');

        console.log(`[AVATAR] Updated avatar for user ${req.user.id}: ${avatarUrl}`);
        res.json({ message: 'Cập nhật ảnh đại diện thành công', avatar: avatarUrl });
    } catch (err) {
        console.error('Update avatar error:', err);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

