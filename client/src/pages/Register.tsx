import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api/axios'
import styles from '../styles/Register.module.css'


export default function Register() {
    const navigate = useNavigate()
    const [form, setForm] = useState({
        full_name: '', email: '', phone: '', password: '', confirmPassword: '', role: 'user', reason: ''
    })
    const [error, setError] = useState('')
    const [step, setStep] = useState(1) // 1: form đăng ký, 2: xác nhận OTP
    const [success, setSuccess] = useState('')
    const [loading, setLoading] = useState(false)
    const [licenseFile, setLicenseFile] = useState<File | null>(null)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [otp, setOtp] = useState(['', '', '', '', '', ''])
    const [countdown, setCountdown] = useState(0)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const inputRefs = useRef<(HTMLInputElement | null)[]>([])

    useEffect(() => {
        if (countdown <= 0) return
        const timer = setTimeout(() => setCountdown(c => c - 1), 1000)
        return () => clearTimeout(timer)
    }, [countdown])

    const handleChange = (e: any) => {
        setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    }

    const validatePassword = (pwd: string): string | null => {
        if (pwd.length < 8) return 'Mật khẩu phải có ít nhất 8 ký tự'
        if (!/[A-Z]/.test(pwd)) return 'Mật khẩu phải có ít nhất 1 chữ in hoa'
        if (!/[a-z]/.test(pwd)) return 'Mật khẩu phải có ít nhất 1 chữ thường'
        if (!/[0-9]/.test(pwd)) return 'Mật khẩu phải có ít nhất 1 chữ số'
        if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd)) return 'Mật khẩu phải có ít nhất 1 ký tự đặc biệt (!@#$%...)'
        return null
    }

    // Step 1: Điền form xong → bấm Đăng ký → gửi OTP
    const handleSendOTP = async (e: any) => {
        e.preventDefault()
        setError('')
        setSuccess('')

        // Normalize email
        const normalizedEmail = form.email.trim().toLowerCase()

        // Validate reason for owner
        if (form.role === 'owner') {
            if (!form.reason?.trim()) {
                return setError('Vui lòng nhập lý do muốn trở thành chủ sân')
            }
            if (!licenseFile) {
                return setError('Vui lòng tải lên giấy phép kinh doanh trước khi tiếp tục')
            }
        }

        if (form.password !== form.confirmPassword) {
            return setError('Mật khẩu xác nhận không khớp!')
        }
        const pwdError = validatePassword(form.password)
        if (pwdError) return setError(pwdError)

        setLoading(true)
        try {
            const response = await api.post('/auth/send-register-otp', { email: normalizedEmail })
            console.log('OTP sent successfully:', response.data)

            // Update form with normalized email
            setForm(prev => ({ ...prev, email: normalizedEmail }))

            setStep(2)
            setCountdown(60)
            setSuccess('Mã xác nhận đã được gửi đến email của bạn!')
        } catch (err: any) {
            console.error('Send OTP error:', err)
            setError(err.response?.data?.message || 'Không thể gửi mã xác nhận')
        } finally {
            setLoading(false)
        }
    }

    // Step 2: Nhập OTP → xác nhận → đăng ký luôn
    const handleVerifyAndRegister = async (e?: any, codeOverride?: string) => {
        e?.preventDefault()
        
        // Prevent double submission
        if (isSubmitting) {
            console.log('Already submitting, skipping...')
            return
        }
        
        const code = codeOverride || otp.join('')
        if (code.length < 6) return setError('Vui lòng nhập đủ 6 số')
        setError('')
        setIsSubmitting(true)
        setLoading(true)
        
        let registerData: any;
        if (licenseFile) {
            registerData = new FormData();
            registerData.append('full_name', form.full_name);
            registerData.append('email', form.email);
            registerData.append('phone', form.phone);
            registerData.append('password', form.password);
            registerData.append('role', form.role);
            registerData.append('reason', form.reason || '');
            registerData.append('code', code);
            registerData.append('business_license', licenseFile);
        } else {
            registerData = {
                full_name: form.full_name,
                email: form.email,
                phone: form.phone,
                password: form.password,
                role: form.role,
                reason: form.reason || '',
                code: code
            };
        }
        
        console.log('Registering with data:', { ...registerData, password: '***' })
        
        try {
            const config = licenseFile
                ? { headers: { 'Content-Type': 'multipart/form-data' } }
                : undefined;
            const response = await api.post('/auth/register', registerData, config)
            console.log('Registration response:', response.data)

            // Clear OTP to prevent re-submission
            setOtp(['', '', '', '', '', ''])

            if (form.role === 'owner') {
                setSuccess('✅ Đăng ký thành công! Tài khoản Owner đang chờ Admin duyệt. Đang chuyển đến trang đăng nhập...')
                setTimeout(() => navigate('/login'), 3000)
            } else {
                setSuccess('🎉 Đăng ký thành công! Đang chuyển đến trang đăng nhập...')
                setTimeout(() => navigate('/login'), 2000)
            }
        } catch (err: any) {
            console.error('Registration error:', err.response?.data || err)
            setError(err.response?.data?.message || 'Mã xác nhận không đúng')
            setOtp(['', '', '', '', '', ''])
            inputRefs.current[0]?.focus()
            setIsSubmitting(false) // Reset on error to allow retry
        } finally {
            setLoading(false)
        }
    }

    const handleResend = async () => {
        if (countdown > 0) return
        setError('')
        setLoading(true)
        setIsSubmitting(false) // Reset submitting flag
        try {
            await api.post('/auth/send-register-otp', { email: form.email })
            setSuccess('Đã gửi lại mã xác nhận đến email!')
            setCountdown(60)
            setOtp(['', '', '', '', '', ''])
            inputRefs.current[0]?.focus()
        } catch (err: any) {
            setError(err.response?.data?.message || 'Lỗi gửi lại mã')
        } finally {
            setLoading(false)
        }
    }

    const handleOtpChange = (idx: number, value: string) => {
        if (isSubmitting) return // Prevent changes during submission
        if (!/^\d*$/.test(value)) return
        const next = [...otp]
        next[idx] = value.slice(-1)
        setOtp(next)
        setError('')
        if (value && idx < 5) inputRefs.current[idx + 1]?.focus()
        if (value && idx === 5 && next.join('').length === 6 && !isSubmitting) {
            setTimeout(() => handleVerifyAndRegister(null, next.join('')), 200)
        }
    }

    const handleOtpKeyDown = (idx: number, e: any) => {
        if (isSubmitting) return
        if (e.key === 'Backspace' && !otp[idx] && idx > 0) inputRefs.current[idx - 1]?.focus()
    }

    const handleOtpPaste = (e: any) => {
        if (isSubmitting) return // Prevent paste during submission
        e.preventDefault()
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
        if (pasted.length > 0) {
            const next = [...otp]
            pasted.split('').forEach((ch: string, i: number) => { next[i] = ch })
            setOtp(next)
            inputRefs.current[Math.min(pasted.length, 5)]?.focus()
            if (pasted.length === 6 && !isSubmitting) {
                setTimeout(() => handleVerifyAndRegister(null, pasted), 200)
            }
        }
    }

    return (
        <div className={styles.registerPage}>
            <div className={styles.registerContainer}>
                <div className={styles.header}>
                    <div className={styles.logo}>
                        <div className={styles.logoIcon}>🏓</div>
                        <div className={styles.logoText}>Pickle<span>Ball</span></div>
                    </div>
                    {step === 1 ? (
                        <>
                            <h1 className={styles.title}>Tạo tài khoản mới</h1>
                            <p className={styles.subtitle}>Tham gia cộng đồng Pickleball sôi động nhất Đà Nẵng</p>
                        </>
                    ) : (
                        <>
                            <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🔢</div>
                            <h1 className={styles.title}>Xác nhận Email</h1>
                            <p className={styles.subtitle}>Kiểm tra hộp thư <strong>{form.email}</strong> để lấy mã 6 số</p>
                        </>
                    )}
                </div>

                <div className={styles.card}>
                    {step !== 2 && error && <div className={styles.errorMsg}>{error}</div>}
                    {step !== 2 && success && <div className={styles.successMsg}>{success}</div>}

                    {/* ========== STEP 1: Form đăng ký đầy đủ ========== */}
                    {step === 1 && (
                        <form className={styles.form} onSubmit={handleSendOTP}>
                            <div>
                                <label>Chọn loại tài khoản</label>
                                <div className={styles.roleSelector}>
                                    <div
                                        className={`${styles.roleOption} ${form.role === 'user' ? styles.active : ''}`}
                                        onClick={() => setForm(prev => ({ ...prev, role: 'user' }))}
                                    >
                                        <span className={styles.roleIcon}>👤</span>
                                        <span className={styles.roleName}>Người chơi</span>
                                        <span className={styles.roleDesc}>Tìm sân, ghép trận</span>
                                    </div>
                                    <div
                                        className={`${styles.roleOption} ${form.role === 'owner' ? styles.active : ''}`}
                                        onClick={() => setForm(prev => ({ ...prev, role: 'owner' }))}
                                    >
                                        <span className={styles.roleIcon}>🏟️</span>
                                        <span className={styles.roleName}>Chủ sân</span>
                                        <span className={styles.roleDesc}>Quản lý & cho thuê sân</span>
                                    </div>
                                </div>
                            </div>

                            {form.role === 'owner' && (
                                <div className={styles.ownerNote}>
                                    ⚠️ Tài khoản Owner cần được Admin duyệt trước khi sử dụng
                                </div>
                            )}

                            {form.role === 'owner' && (
                                <>
                                <div className="input-group">
                                    <label>Lý do muốn trở thành chủ sân *</label>
                                    <textarea
                                        name="reason"
                                        placeholder="VD: Tôi sở hữu 2 sân pickleball tại Sơn Trà và muốn cho thuê trên nền tảng..."
                                        value={form.reason}
                                        onChange={handleChange}
                                        required
                                        rows={3}
                                        style={{
                                            width: '100%',
                                            padding: '12px 16px',
                                            background: 'var(--bg-glass)',
                                            border: '1px solid var(--border-glass)',
                                            borderRadius: 'var(--radius-md)',
                                            color: 'var(--text-primary)',
                                            fontSize: '0.9rem',
                                            resize: 'vertical',
                                            minHeight: '80px'
                                        }}
                                    />
                                </div>
                                <div className="input-group">
                                    <label>Giấy phép kinh doanh (.pdf, .jpg, .png, &le;5MB) *</label>
                                    <input
                                        type="file"
                                        accept=".pdf,.jpg,.jpeg,.png"
                                        onChange={e => {
                                            const file = e.target.files?.[0] || null;
                                            if (file) {
                                                if (file.size > 5 * 1024 * 1024) {
                                                    setError('File phải nhỏ hơn 5MB');
                                                    setLicenseFile(null);
                                                    setPreviewUrl(null);
                                                    return;
                                                }
                                                setLicenseFile(file);
                                                if (file.type.startsWith('image/')) {
                                                    setPreviewUrl(URL.createObjectURL(file));
                                                } else {
                                                    setPreviewUrl(null);
                                                }
                                            } else {
                                                setLicenseFile(null);
                                                setPreviewUrl(null);
                                            }
                                        }}
                                        required
                                    />
                                    {previewUrl && (
                                        <div style={{ marginTop: '8px' }}>
                                            <img src={previewUrl} alt="preview" style={{ maxWidth: '100%', maxHeight: '200px' }} />
                                        </div>
                                    )}
                                </div>
                                </>
                            )}

                            <div className={styles.formRow}>
                                <div className="input-group">
                                    <label>Họ và tên</label>
                                    <input
                                        type="text" name="full_name" placeholder="Nguyễn Văn A"
                                        value={form.full_name} onChange={handleChange} required
                                    />
                                </div>
                                <div className="input-group">
                                    <label>Số điện thoại</label>
                                    <input
                                        type="tel" name="phone" placeholder="0901234567"
                                        value={form.phone} onChange={handleChange} required
                                    />
                                </div>
                            </div>

                            <div className="input-group">
                                <label>Email</label>
                                <input
                                    type="email" name="email" placeholder="your@email.com"
                                    value={form.email} onChange={handleChange} required
                                />
                            </div>

                            <div className={styles.formRow}>
                                <div className="input-group">
                                    <label>Mật khẩu</label>
                                    <input
                                        type="password" name="password" placeholder="••••••••"
                                        value={form.password} onChange={handleChange} required
                                    />
                                </div>
                                <div className="input-group">
                                    <label>Xác nhận mật khẩu</label>
                                    <input
                                        type="password" name="confirmPassword" placeholder="••••••••"
                                        value={form.confirmPassword} onChange={handleChange} required
                                    />
                                </div>
                            </div>

                            {/* Password strength checklist */}
                            {form.password.length > 0 && (
                                <div style={{
                                    background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)',
                                    padding: '12px 16px', fontSize: '0.8rem',
                                    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px'
                                }}>
                                    {[
                                        { ok: form.password.length >= 8, text: 'Ít nhất 8 ký tự' },
                                        { ok: /[A-Z]/.test(form.password), text: '1 chữ in hoa (A-Z)' },
                                        { ok: /[a-z]/.test(form.password), text: '1 chữ thường (a-z)' },
                                        { ok: /[0-9]/.test(form.password), text: '1 chữ số (0-9)' },
                                        { ok: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(form.password), text: '1 ký tự đặc biệt (!@#$)' },
                                        { ok: form.password === form.confirmPassword && form.confirmPassword.length > 0, text: 'Mật khẩu khớp nhau' },
                                    ].map((rule, i) => (
                                        <div key={i} style={{ color: rule.ok ? '#00E676' : '#8b949e', transition: 'color 0.2s ease' }}>
                                            {rule.ok ? '✅' : '⬜'} {rule.text}
                                        </div>
                                    ))}
                                </div>
                            )}

                            <button type="submit" className={styles.submitBtn} disabled={loading}>
                                {loading ? '⏳ Đang gửi mã xác nhận...' : '🚀 Đăng ký'}
                            </button>
                        </form>
                    )}

                    {/* ========== STEP 2: Nhập OTP xác nhận ========== */}
                    {step === 2 && (
                        <form className={styles.form} onSubmit={(e) => handleVerifyAndRegister(e)}>
                            <div style={{
                                background: error ? 'rgba(255, 82, 82, 0.1)' : 'rgba(0, 230, 118, 0.1)',
                                color: error ? '#FF5252' : '#00E676',
                                padding: '10px 16px', borderRadius: 'var(--radius-md)',
                                fontSize: '0.85rem', textAlign: 'center'
                            }}>
                                {error ? `❌ ${error}` : `📧 Mã xác nhận 6 số đã được gửi đến `}
                                {!error && <strong>{form.email}</strong>}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '12px' }}>
                                {otp.map((digit, idx) => (
                                    <input key={idx} ref={el => inputRefs.current[idx] = el}
                                        type="text" inputMode="numeric" maxLength={1} value={digit}
                                        onChange={e => handleOtpChange(idx, e.target.value)}
                                        onKeyDown={e => handleOtpKeyDown(idx, e)}
                                        onPaste={idx === 0 ? handleOtpPaste : undefined}
                                        autoFocus={idx === 0}
                                        disabled={isSubmitting}
                                        style={{
                                            width: '52px', height: '60px', textAlign: 'center',
                                            fontSize: '1.5rem', fontWeight: 800,
                                            background: 'var(--bg-glass)',
                                            border: digit ? '2px solid var(--accent-green)' : '1px solid var(--border-glass)',
                                            borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
                                            transition: 'all 0.2s ease', caretColor: 'var(--accent-green)',
                                            opacity: isSubmitting ? 0.6 : 1,
                                            cursor: isSubmitting ? 'not-allowed' : 'text'
                                        }}
                                    />
                                ))}
                            </div>
                            <button type="submit" className={styles.submitBtn} disabled={loading || isSubmitting || otp.join('').length < 6}>
                                {loading ? '⏳ Đang xác nhận...' : '✅ Xác nhận & Đăng ký'}
                            </button>
                            <div style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                {countdown > 0 ? (
                                    <span>Gửi lại sau <strong style={{ color: 'var(--accent-green)' }}>{countdown}s</strong></span>
                                ) : (
                                    <button type="button" onClick={handleResend} disabled={loading}
                                        style={{ background: 'none', border: 'none', color: 'var(--accent-green)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                                        📧 Gửi lại mã
                                    </button>
                                )}
                            </div>
                            <button type="button" onClick={() => { setStep(1); setOtp(['', '', '', '', '', '']); setError(''); setSuccess(''); setIsSubmitting(false) }}
                                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.85rem', textAlign: 'center' }}>
                                ← Quay lại sửa thông tin
                            </button>
                        </form>
                    )}
                </div>

                <div className={styles.footer}>
                    Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
                </div>
            </div>
        </div>
    )
}
