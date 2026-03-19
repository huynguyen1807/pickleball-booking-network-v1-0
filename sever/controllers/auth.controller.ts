import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import { sql, poolPromise } from '../config/db';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import type { StringValue } from 'ms';
dotenv.config();

// In-memory OTP store
const otpStore = new Map();

// Email transporter — Gmail with App Password
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

// Generate 6-digit code
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// Validate strong password
const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 8) return 'Mật khẩu phải có ít nhất 8 ký tự';
    if (!/[A-Z]/.test(pwd)) return 'Mật khẩu phải có ít nhất 1 chữ in hoa';
    if (!/[a-z]/.test(pwd)) return 'Mật khẩu phải có ít nhất 1 chữ thường';
    if (!/[0-9]/.test(pwd)) return 'Mật khẩu phải có ít nhất 1 chữ số';
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd)) return 'Mật khẩu phải có ít nhất 1 ký tự đặc biệt';
    return null;
};

// Register
export const sendRegisterOTP = async (req, res) => {
    try {
        const { email } = req.body
        if (!email)
            return res.status(400).json({ message: 'Vui lòng nhập email' })

        // Normalize email: trim and lowercase
        const trimmedEmail = email.trim().toLowerCase()

        const pool = await poolPromise

        const existing = await pool.request()
            .input('email', sql.NVarChar, trimmedEmail)
            .query('SELECT id FROM users WHERE email = @email')

        if (existing.recordset.length > 0) {
            return res.status(400).json({ message: 'Email đã tồn tại' })
        }

        const otp = generateOTP()

        console.log(`[SEND_OTP] Storing OTP for email: ${trimmedEmail}, OTP: ${otp}`)
        otpStore.set(trimmedEmail, {
            otp,
            expiresAt: Date.now() + 5 * 60 * 1000,
            type: 'register'
        })

        await transporter.sendMail({
            from: process.env.SMTP_FROM,
            to: trimmedEmail,
            subject: '🏓 Mã xác nhận đăng ký — PickleBall- Đà Nẵng',
            html: `
                <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #0d1117; color: #e6edf3; border-radius: 16px; padding: 40px 32px; border: 1px solid #30363d;">
                    <div style="text-align: center; margin-bottom: 24px;">
                        <div style="font-size: 40px;">🏓</div>
                        <h1 style="font-size: 20px; font-weight: 700; margin: 8px 0 4px;">PickleBall- Đà Nẵng</h1>
                        <p style="color: #8b949e; font-size: 14px; margin: 0;">Xác nhận đăng ký tài khoản</p>
                    </div>
                    <p style="font-size: 14px; color: #8b949e; margin-bottom: 24px;">
                        Xin chào,<br>
                        Mã xác nhận đăng ký tài khoản của bạn là:
                    </p>
                    <div style="text-align: center; margin: 24px 0;">
                        <div style="display: inline-block; background: linear-gradient(135deg, #00E676, #00C853); color: #000; font-size: 32px; font-weight: 800; letter-spacing: 8px; padding: 16px 32px; border-radius: 12px;">
                            ${otp}
                        </div>
                    </div>
                    <p style="font-size: 13px; color: #8b949e; text-align: center;">
                        ⏰ Mã này có hiệu lực trong <strong style="color: #e6edf3;">5 phút</strong>.<br>
                        Nếu bạn không yêu cầu đăng ký, hãy bỏ qua email này.
                    </p>
                </div>
            `
        })

        res.json({ message: 'OTP đã gửi về email' })

    } catch (err) {
        console.error(err)
        res.status(500).json({ message: 'Không thể gửi OTP' })
    }
}

/* ================================
   REGISTER (VERIFY OTP + CREATE)
================================ */
export const register = async (req, res) => {
    try {
        const { email, password, full_name, phone, role, code, reason } = req.body

        if (!email || !password || !full_name || !code) {
            return res.status(400).json({ message: 'Thiếu thông tin hoặc OTP' })
        }

        // Trim email to avoid whitespace issues
        const trimmedEmail = email.trim().toLowerCase()

        const pwdError = validatePassword(password)
        if (pwdError) return res.status(400).json({ message: pwdError })

        console.log(`[REGISTER] Checking OTP for email: ${trimmedEmail}`)
        const stored = otpStore.get(trimmedEmail)

        if (!stored || stored.type !== 'register') {
            console.log(`[REGISTER] OTP not found for: ${trimmedEmail}, otpStore keys:`, Array.from(otpStore.keys()))
            return res.status(400).json({ message: 'Vui lòng yêu cầu OTP trước' })
        }

        if (Date.now() > stored.expiresAt) {
            otpStore.delete(trimmedEmail)
            console.log(`[REGISTER] OTP expired for: ${trimmedEmail}`)
            return res.status(400).json({ message: 'OTP đã hết hạn' })
        }

        if (stored.otp !== code.toString()) {
            console.log(`[REGISTER] OTP mismatch for ${trimmedEmail}: expected ${stored.otp}, got ${code}`)
            return res.status(400).json({ message: 'OTP không đúng' })
        }

        // Validate reason for owner registration AFTER OTP verification
        if (role === 'owner' && !reason?.trim()) {
            return res.status(400).json({ message: 'Vui lòng nhập lý do muốn trở thành chủ sân' })
        }

        // if owner make sure file was uploaded by multer
        let businessLicenseUrl = null;
        if (role === 'owner') {
            if (!req.file) {
                return res.status(400).json({ message: 'Vui lòng tải lên giấy phép kinh doanh' });
            }
            // save file to disk with email in filename
            const uploadDir = path.join(__dirname, '../uploads/business_licenses');
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }
            const ext = path.extname(req.file.originalname);
            const base = path.basename(req.file.originalname, ext).replace(/[^a-zA-Z0-9-_\\.]/g, '_');
            const filename = `${trimmedEmail}_${Date.now()}_${base}${ext}`;
            const filepath = path.join(uploadDir, filename);
            fs.writeFileSync(filepath, req.file.buffer);
            console.log(`[REGISTER] Saved business license file: ${filename}`);
            businessLicenseUrl = `/uploads/business_licenses/${filename}`;
        }

        const pool = await poolPromise

        const hash = await bcrypt.hash(password, 10)
        const userRole = role === 'owner' ? 'owner' : 'user'
        const status = role === 'owner' ? 'pending' : 'active'

        console.log(`[REGISTER] Creating user with email: ${trimmedEmail}, role: ${userRole}, status: ${status}`)
        const result = await pool.request()
            .input('email', sql.NVarChar, trimmedEmail)
            .input('password', sql.NVarChar, hash)
            .input('full_name', sql.NVarChar, full_name)
            .input('phone', sql.NVarChar, phone || null)
            .input('role', sql.NVarChar, userRole)
            .input('status', sql.NVarChar, status)
            .query(`
                INSERT INTO users (email, password, full_name, phone, role, status)
                OUTPUT INSERTED.id
                VALUES (@email, @password, @full_name, @phone, @role, @status)
            `)

        const userId = result.recordset[0].id

        // If owner, create upgrade request
        if (role === 'owner') {
            console.log(`[REGISTER] Creating upgrade request for user ${userId}`)
            await pool.request()
                .input('user_id', sql.Int, userId)
                .input('reason', sql.NVarChar, reason)
                .input('business_license_url', sql.NVarChar(sql.MAX), businessLicenseUrl)
                .query(`
                    INSERT INTO upgrade_requests (user_id, reason, status, business_license_url)
                    VALUES (@user_id, @reason, 'pending', @business_license_url)
                `)
        }

        otpStore.delete(trimmedEmail)
        console.log(`[REGISTER] Registration successful for: ${trimmedEmail}`)

        res.status(201).json({
            message: status === 'pending'
                ? 'Đăng ký thành công! Chờ admin duyệt.'
                : 'Đăng ký thành công!',
            userId: userId
        })

    } catch (err) {
        console.error('Register error:', err)
        res.status(500).json({ message: 'Lỗi server' })
    }
}
// Login — with account lockout after 5 failed attempts
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 15;

export const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: 'Vui lòng nhập email và mật khẩu' });
        }

        const pool = await poolPromise;
        const result = await pool.request()
            .input('email', sql.NVarChar, email)
            .query('SELECT * FROM users WHERE email = @email');

        if (result.recordset.length === 0) {
            return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng' });
        }

        const user = result.recordset[0];

        // Check if account is locked
        if (user.locked_until && new Date(user.locked_until) > new Date()) {
            const remainingMs = new Date(user.locked_until).getTime() - Date.now();
            const remainingMin = Math.ceil(remainingMs / 60000);
            return res.status(423).json({
                message: `Tài khoản đã bị khóa do nhập sai quá ${MAX_LOGIN_ATTEMPTS} lần. Vui lòng thử lại sau ${remainingMin} phút.`,
                lockedUntil: user.locked_until
            });
        }

        if (user.status === 'banned') {
            return res.status(403).json({ message: 'Tài khoản của bạn đã bị khóa bởi Admin. Vui lòng liên hệ hỗ trợ.' });
        }
        if (user.status === 'pending') {
            return res.status(403).json({ message: 'Tài khoản đang chờ Admin duyệt' });
        }
        if (user.status === 'rejected') {
            return res.status(403).json({ message: 'Tài khoản đã bị từ chối' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            // Increment failed login count
            const newCount = (user.failed_login_count || 0) + 1;
            const attemptsLeft = MAX_LOGIN_ATTEMPTS - newCount;

            if (newCount >= MAX_LOGIN_ATTEMPTS) {
                // Lock account
                const lockUntil = new Date(Date.now() + LOCK_DURATION_MINUTES * 60 * 1000);
                await pool.request()
                    .input('email', sql.NVarChar, email)
                    .input('count', sql.Int, newCount)
                    .input('locked_until', sql.DateTimeOffset, lockUntil)
                    .query('UPDATE users SET failed_login_count = @count, locked_until = @locked_until WHERE email = @email');

                console.log(`[LOGIN] Account locked: ${email} after ${newCount} failed attempts`);
                return res.status(423).json({
                    message: `Tài khoản đã bị khóa do nhập sai ${MAX_LOGIN_ATTEMPTS} lần. Vui lòng thử lại sau ${LOCK_DURATION_MINUTES} phút.`,
                    lockedUntil: lockUntil
                });
            } else {
                // Just increment counter
                await pool.request()
                    .input('email', sql.NVarChar, email)
                    .input('count', sql.Int, newCount)
                    .query('UPDATE users SET failed_login_count = @count WHERE email = @email');

                console.log(`[LOGIN] Failed attempt ${newCount}/${MAX_LOGIN_ATTEMPTS} for: ${email}`);
                return res.status(401).json({
                    message: `Email hoặc mật khẩu không đúng. Còn ${attemptsLeft} lần thử.`,
                    attemptsLeft
                });
            }
        }

        // Login success → reset failed login count
        if (user.failed_login_count > 0 || user.locked_until) {
            await pool.request()
                .input('email', sql.NVarChar, email)
                .query('UPDATE users SET failed_login_count = 0, locked_until = NULL WHERE email = @email');
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role, full_name: user.full_name },
            process.env.JWT_SECRET as string,
            { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as StringValue }
        );

        const { password: _, failed_login_count: __, locked_until: ___, ...userData } = user;
        res.json({ message: 'Đăng nhập thành công', token, user: userData });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// Get profile
export const getProfile = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('id', sql.Int, req.user.id)
            .query('SELECT id, email, full_name, phone, avatar, role, status, latitude, longitude, created_at FROM users WHERE id = @id');
        if (result.recordset.length === 0) return res.status(404).json({ message: 'Không tìm thấy user' });
        res.json(result.recordset[0]);
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// Change password
export const changePassword = async (req, res) => {
    try {
        const { current_password, new_password } = req.body;
        const pool = await poolPromise;
        const result = await pool.request()
            .input('id', sql.Int, req.user.id)
            .query('SELECT password FROM users WHERE id = @id');

        const isMatch = await bcrypt.compare(current_password, result.recordset[0].password);
        if (!isMatch) return res.status(400).json({ message: 'Mật khẩu hiện tại không đúng' });

        const hash = await bcrypt.hash(new_password, 10);
        await pool.request()
            .input('password', sql.NVarChar, hash)
            .input('id', sql.Int, req.user.id)
            .query('UPDATE users SET password = @password WHERE id = @id');
        res.json({ message: 'Đổi mật khẩu thành công' });
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// Forgot Password — send 6-digit OTP to email
export const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ message: 'Vui lòng nhập email' });

        const pool = await poolPromise;
        const result = await pool.request()
            .input('email', sql.NVarChar, email)
            .query('SELECT id, full_name FROM users WHERE email = @email');

        if (result.recordset.length === 0) {
            return res.status(404).json({ message: 'Email không tồn tại trong hệ thống' });
        }

        const otp = generateOTP();
        const expiresAt = Date.now() + 5 * 60 * 1000;
        otpStore.set(email, { otp, expiresAt, verified: false });

        // Send OTP email
        await transporter.sendMail({
            from: process.env.SMTP_FROM,
            to: email,
            subject: '🏓 Mã xác nhận đặt lại mật khẩu — PickleBall- Đà Nẵng',
            html: `
                <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #0d1117; color: #e6edf3; border-radius: 16px; padding: 40px 32px; border: 1px solid #30363d;">
                    <div style="text-align: center; margin-bottom: 24px;">
                        <div style="font-size: 40px;">🏓</div>
                        <h1 style="font-size: 20px; font-weight: 700; margin: 8px 0 4px;">PickleBall- Đà Nẵng</h1>
                        <p style="color: #8b949e; font-size: 14px; margin: 0;">Đặt lại mật khẩu</p>
                    </div>
                    <p style="font-size: 14px; color: #8b949e; margin-bottom: 24px;">
                        Xin chào <strong style="color: #e6edf3;">${result.recordset[0].full_name}</strong>,<br>
                        Mã xác nhận của bạn là:
                    </p>
                    <div style="text-align: center; margin: 24px 0;">
                        <div style="display: inline-block; background: linear-gradient(135deg, #00E676, #00C853); color: #000; font-size: 32px; font-weight: 800; letter-spacing: 8px; padding: 16px 32px; border-radius: 12px;">
                            ${otp}
                        </div>
                    </div>
                    <p style="font-size: 13px; color: #8b949e; text-align: center;">
                        ⏰ Mã này có hiệu lực trong <strong style="color: #e6edf3;">5 phút</strong>.<br>
                        Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.
                    </p>
                </div>
            `
        });

        console.log(`[EMAIL] ✅ OTP sent to ${email}`);
        res.json({ message: 'Mã xác nhận đã được gửi đến email của bạn' });
    } catch (err) {
        console.error('[EMAIL] ❌ Error:', err.message);
        res.status(500).json({ message: 'Không thể gửi email. Vui lòng thử lại sau.' });
    }
};

// Verify OTP code
export const verifyCode = async (req, res) => {
    try {
        const { email, code } = req.body;
        if (!email || !code) return res.status(400).json({ message: 'Vui lòng nhập email và mã xác nhận' });

        const stored = otpStore.get(email);
        if (!stored) {
            return res.status(400).json({ message: 'Mã xác nhận không hợp lệ hoặc đã hết hạn' });
        }

        if (Date.now() > stored.expiresAt) {
            otpStore.delete(email);
            return res.status(400).json({ message: 'Mã xác nhận đã hết hạn. Vui lòng gửi lại.' });
        }

        if (stored.otp !== code.toString()) {
            return res.status(400).json({ message: 'Mã xác nhận không đúng' });
        }

        otpStore.set(email, { ...stored, verified: true });
        res.json({ message: 'Xác nhận thành công' });
    } catch (err) {
        console.error('Verify code error:', err);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// Reset Password
export const resetPassword = async (req, res) => {
    try {
        const { email, new_password } = req.body;
        if (!email || !new_password) return res.status(400).json({ message: 'Vui lòng nhập đầy đủ thông tin' });
        const pwdError = validatePassword(new_password);
        if (pwdError) return res.status(400).json({ message: pwdError });

        const stored = otpStore.get(email);
        if (!stored || !stored.verified) {
            return res.status(400).json({ message: 'Vui lòng xác nhận mã OTP trước' });
        }

        const pool = await poolPromise;
        const hash = await bcrypt.hash(new_password, 10);
        await pool.request()
            .input('email', sql.NVarChar, email)
            .input('password', sql.NVarChar, hash)
            .query('UPDATE users SET password = @password WHERE email = @email');

        otpStore.delete(email);
        res.json({ message: 'Đặt lại mật khẩu thành công!' });
    } catch (err) {
        console.error('Reset password error:', err);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

