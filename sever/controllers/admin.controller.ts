import { sql, poolPromise } from '../config/db';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

// Email transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

export const getUpgradeRequests = async (req, res) => {
    try {
        const { status } = req.query;
        const pool = await poolPromise;
        const request = pool.request();
        // Exclude business_license_url locally to reduce fetch payload
        let q = 'SELECT ur.id, ur.user_id, ur.reason, ur.status, ur.admin_note, ur.created_at, ur.updated_at, CASE WHEN ur.business_license_url IS NOT NULL THEN 1 ELSE 0 END as has_license, u.full_name, u.email, u.phone FROM upgrade_requests ur JOIN users u ON ur.user_id = u.id';
        if (status) { request.input('status', sql.NVarChar, status); q += ' WHERE ur.status = @status'; }
        q += ' ORDER BY ur.created_at DESC';
        const result = await request.query(q);
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ message: 'Lỗi server' }); }
};

export const getLicenseImage = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await poolPromise;
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT business_license_url FROM upgrade_requests WHERE id = @id');

        if (result.recordset.length === 0 || !result.recordset[0].business_license_url) {
            return res.status(404).json({ message: 'Không tìm thấy giấy phép' });
        }

        const fileUrl = result.recordset[0].business_license_url;
        const protocol = req.protocol;
        const host = req.get('host');
        res.json({ dataUrl: `${protocol}://${host}${fileUrl}` });
    } catch (err) {
        console.error('Lỗi khi lấy giấy phép:', err);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

export const approveUpgrade = async (req, res) => {
    try {
        const pool = await poolPromise;
        const request_data = await pool.request().input('id', sql.Int, req.params.id)
            .query('SELECT user_id FROM upgrade_requests WHERE id = @id');

        if (request_data.recordset.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy yêu cầu' });
        }

        // Update upgrade request status
        await pool.request().input('id', sql.Int, req.params.id)
            .query("UPDATE upgrade_requests SET status = 'approved', updated_at = GETDATE() WHERE id = @id");

        // Update user role, status and mark as verified
        await pool.request().input('id', sql.Int, request_data.recordset[0].user_id)
            .query("UPDATE users SET role = 'owner', status = 'active', is_verified = 1, updated_at = GETDATE() WHERE id = @id");

        res.json({ message: 'Đã duyệt nâng cấp Owner' });
    } catch (err) {
        console.error('Approve upgrade error:', err);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

export const rejectUpgrade = async (req, res) => {
    try {
        const { admin_note } = req.body;
        const pool = await poolPromise;

        // Get user info and current upgrade request status
        const request_data = await pool.request().input('id', sql.Int, req.params.id)
            .query(`
                SELECT ur.user_id, ur.status, u.email, u.full_name 
                FROM upgrade_requests ur 
                JOIN users u ON ur.user_id = u.id 
                WHERE ur.id = @id
            `);

        if (request_data.recordset.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy yêu cầu' });
        }

        const userId = request_data.recordset[0].user_id;
        const previousStatus = request_data.recordset[0].status;
        const userEmail = request_data.recordset[0].email;
        const userName = request_data.recordset[0].full_name;

        // Update upgrade request status with admin note
        await pool.request()
            .input('admin_note', sql.NVarChar, admin_note || null)
            .input('id', sql.Int, req.params.id)
            .query("UPDATE upgrade_requests SET status = 'rejected', admin_note = @admin_note, updated_at = GETDATE() WHERE id = @id");

        // If revoking from approved status, downgrade user role to 'user'
        if (previousStatus === 'approved') {
            await pool.request()
                .input('id', sql.Int, userId)
                .query("UPDATE users SET role = 'user', status = 'rejected', updated_at = GETDATE() WHERE id = @id");
        } else {
            // Just update status to rejected
            await pool.request()
                .input('id', sql.Int, userId)
                .query("UPDATE users SET status = 'rejected', updated_at = GETDATE() WHERE id = @id");
        }

        // Send rejection email
        const isRevoke = previousStatus === 'approved';
        const emailSubject = isRevoke
            ? '🔒 Thông báo thu hồi quyền Owner — PickleBall Đà Nẵng'
            : '❌ Thông báo từ chối yêu cầu Owner — PickleBall Đà Nẵng';

        const emailContent = `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0d1117; color: #e6edf3; border-radius: 16px; padding: 40px 32px; border: 1px solid #30363d;">
                <div style="text-align: center; margin-bottom: 24px;">
                    <div style="font-size: 48px; margin-bottom: 8px;">${isRevoke ? '🔒' : '❌'}</div>
                    <h1 style="font-size: 24px; font-weight: 700; margin: 8px 0 4px; color: #FF5252;">
                        ${isRevoke ? 'Quyền Owner đã bị thu hồi' : 'Yêu cầu Owner bị từ chối'}
                    </h1>
                    <p style="color: #8b949e; font-size: 14px; margin: 0;">PickleBall Đà Nẵng</p>
                </div>
                
                <div style="background: rgba(255, 82, 82, 0.1); border-left: 3px solid #FF5252; padding: 16px 20px; border-radius: 8px; margin-bottom: 24px;">
                    <p style="font-size: 15px; margin: 0; line-height: 1.6;">
                        Xin chào <strong style="color: #e6edf3;">${userName}</strong>,<br><br>
                        ${isRevoke
                ? 'Tài khoản Owner của bạn đã bị thu hồi bởi Admin.'
                : 'Yêu cầu nâng cấp lên tài khoản Owner của bạn đã bị từ chối.'
            }
                    </p>
                </div>

                ${admin_note ? `
                    <div style="background: var(--bg-glass, rgba(255, 255, 255, 0.05)); padding: 16px 20px; border-radius: 8px; margin-bottom: 24px;">
                        <p style="font-size: 13px; color: #8b949e; margin: 0 0 8px 0; font-weight: 600;">📝 LÝ DO TỪ ADMIN:</p>
                        <p style="font-size: 14px; color: #e6edf3; margin: 0; line-height: 1.6;">
                            ${admin_note}
                        </p>
                    </div>
                ` : ''}

                <div style="background: rgba(0, 230, 118, 0.1); border-left: 3px solid #00E676; padding: 16px 20px; border-radius: 8px; margin-bottom: 24px;">
                    <p style="font-size: 13px; margin: 0; line-height: 1.6; color: #8b949e;">
                        💡 <strong style="color: #00E676;">Bạn có thể làm gì?</strong><br>
                        ${isRevoke
                ? '• Liên hệ Admin để biết chi tiết và khắc phục vấn đề<br>• Đăng ký lại sau khi đã khắc phục'
                : '• Kiểm tra và hoàn thiện lại hồ sơ của bạn<br>• Liên hệ Admin để được tư vấn<br>• Đăng ký lại khi đã đủ điều kiện'
            }
                    </p>
                </div>

                <div style="text-align: center; padding-top: 20px; border-top: 1px solid #30363d;">
                    <p style="font-size: 12px; color: #8b949e; margin: 0;">
                        Nếu bạn có thắc mắc, vui lòng liên hệ Admin qua email hoặc hotline của chúng tôi.
                    </p>
                </div>
            </div>
        `;

        try {
            await transporter.sendMail({
                from: process.env.SMTP_FROM,
                to: userEmail,
                subject: emailSubject,
                html: emailContent
            });
            console.log(`[REJECT] Email sent to ${userEmail}`);
        } catch (emailError) {
            console.error('[REJECT] Failed to send email:', emailError);
            // Don't fail the whole operation if email fails
        }

        res.json({ message: isRevoke ? 'Đã thu hồi quyền Owner' : 'Đã từ chối yêu cầu' });
    } catch (err) {
        console.error('Reject upgrade error:', err);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

export const getAllUsers = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query('SELECT id, email, full_name, phone, avatar, role, status, created_at FROM users ORDER BY created_at DESC');
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

// Send broadcast notification to users by role
export const sendBroadcastNotification = async (req, res) => {
    try {
        const { title, message, type, targetRole } = req.body;
        if (!title || !message) {
            return res.status(400).json({ message: 'Vui lòng nhập tiêu đề và nội dung' });
        }

        const pool = await poolPromise;

        // Get target users based on role filter
        let query = "SELECT id FROM users WHERE status = 'active'";
        const request = pool.request();
        if (targetRole && targetRole !== 'all') {
            request.input('role', sql.NVarChar, targetRole);
            query += ' AND role = @role';
        }

        const users = await request.query(query);

        if (users.recordset.length === 0) {
            return res.status(400).json({ message: 'Không tìm thấy người dùng nào' });
        }

        // Insert notification for each user
        let count = 0;
        for (const u of users.recordset) {
            await pool.request()
                .input('user_id', sql.Int, u.id)
                .input('title', sql.NVarChar, title)
                .input('message', sql.NVarChar, message)
                .input('type', sql.NVarChar, type || 'system')
                .query(`INSERT INTO notifications (user_id, title, message, type)
                        VALUES (@user_id, @title, @message, @type)`);
            count++;
        }

        res.json({ message: `Đã gửi thông báo đến ${count} người dùng`, count });
    } catch (err) {
        console.error('Broadcast notification error:', err);
        res.status(500).json({ message: 'Lỗi server' });
    }
};
