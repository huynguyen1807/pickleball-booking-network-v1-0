import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api/axios'
import styles from '../styles/Login.module.css'

export default function ForgotPassword() {
    const navigate = useNavigate()
    const [step, setStep] = useState(1)
    const [email, setEmail] = useState('')
    const [otp, setOtp] = useState(['', '', '', '', '', ''])
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [countdown, setCountdown] = useState(0)
    const inputRefs = useRef([])

    useEffect(() => {
        if (countdown <= 0) return
        const timer = setTimeout(() => setCountdown(c => c - 1), 1000)
        return () => clearTimeout(timer)
    }, [countdown])

    const handleSendOTP = async (e) => {
        e.preventDefault()
        if (!email.trim()) return setError('Vui lòng nhập email')
        setError('')
        setSuccess('')
        setLoading(true)
        try {
            await api.post('/auth/forgot-password', { email })
            setSuccess('Mã xác nhận 6 số đã được gửi đến email của bạn!')
            setStep(2)
            setCountdown(60)
        } catch (err) {
            setError(err.response?.data?.message || 'Không thể gửi mã xác nhận')
        } finally {
            setLoading(false)
        }
    }

    const handleVerifyOTP = async (e?, codeOverride?) => {
        e?.preventDefault()
        const code = codeOverride || otp.join('')
        if (code.length < 6) return setError('Vui lòng nhập đủ 6 số')
        setError('')
        setLoading(true)
        try {
            await api.post('/auth/verify-code', { email, code })
            setSuccess('Xác nhận thành công! Nhập mật khẩu mới.')
            setStep(3)
        } catch (err) {
            setError(err.response?.data?.message || 'Mã xác nhận không đúng')
            setOtp(['', '', '', '', '', ''])
            inputRefs.current[0]?.focus()
        } finally {
            setLoading(false)
        }
    }

    const handleResetPassword = async (e) => {
        e.preventDefault()
        if (newPassword.length < 8) return setError('Mật khẩu phải có ít nhất 8 ký tự')
        if (!/[A-Z]/.test(newPassword)) return setError('Mật khẩu phải có ít nhất 1 chữ in hoa')
        if (!/[a-z]/.test(newPassword)) return setError('Mật khẩu phải có ít nhất 1 chữ thường')
        if (!/[0-9]/.test(newPassword)) return setError('Mật khẩu phải có ít nhất 1 chữ số')
        if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword)) return setError('Mật khẩu phải có ít nhất 1 ký tự đặc biệt (!@#$%...)')
        if (newPassword !== confirmPassword) return setError('Mật khẩu xác nhận không khớp')
        setError('')
        setLoading(true)
        try {
            await api.post('/auth/reset-password', { email, new_password: newPassword })
            setSuccess('')
            setStep(4)
        } catch (err) {
            setError(err.response?.data?.message || 'Không thể đặt lại mật khẩu')
        } finally {
            setLoading(false)
        }
    }

    const handleResend = async () => {
        if (countdown > 0) return
        setError('')
        setLoading(true)
        try {
            await api.post('/auth/forgot-password', { email })
            setSuccess('Đã gửi lại mã xác nhận đến email!')
            setCountdown(60)
            setOtp(['', '', '', '', '', ''])
            inputRefs.current[0]?.focus()
        } catch (err) {
            setError(err.response?.data?.message || 'Lỗi gửi lại mã')
        } finally {
            setLoading(false)
        }
    }

    const handleOtpChange = (idx, value) => {
        if (!/^\d*$/.test(value)) return
        const next = [...otp]
        next[idx] = value.slice(-1)
        setOtp(next)
        setError('')
        if (value && idx < 5) inputRefs.current[idx + 1]?.focus()
        if (value && idx === 5 && next.join('').length === 6) {
            setTimeout(() => handleVerifyOTP(null, next.join('')), 200)
        }
    }

    const handleOtpKeyDown = (idx, e) => {
        if (e.key === 'Backspace' && !otp[idx] && idx > 0) inputRefs.current[idx - 1]?.focus()
    }

    const handleOtpPaste = (e) => {
        e.preventDefault()
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
        if (pasted.length > 0) {
            const next = [...otp]
            pasted.split('').forEach((ch, i) => { next[i] = ch })
            setOtp(next)
            inputRefs.current[Math.min(pasted.length, 5)]?.focus()
            if (pasted.length === 6) setTimeout(() => handleVerifyOTP(null, pasted), 200)
        }
    }

    const stepTitles = {
        1: { icon: '📧', title: 'Quên mật khẩu', subtitle: 'Nhập email để nhận mã xác nhận' },
        2: { icon: '🔢', title: 'Nhập mã xác nhận', subtitle: `Kiểm tra hộp thư ${email} để lấy mã 6 số` },
        3: { icon: '🔑', title: 'Đặt lại mật khẩu', subtitle: 'Nhập mật khẩu mới cho tài khoản' },
        4: { icon: '✅', title: 'Thành công!', subtitle: 'Mật khẩu đã được đặt lại' }
    }
    const currentStep = stepTitles[step]

    return (
        <div className={styles.loginPage}>
            <div className={styles.loginContainer}>
                <div className={styles.loginHeader}>
                    <div className={styles.loginLogo}>
                        <div className={styles.loginLogoIcon}>🏓</div>
                        <div className={styles.loginLogoText}>Pickle<span>Ball</span></div>
                    </div>
                    <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>{currentStep.icon}</div>
                    <h1 className={styles.loginTitle}>{currentStep.title}</h1>
                    <p className={styles.loginSubtitle}>{currentStep.subtitle}</p>
                </div>

                <div className={styles.loginCard}>
                    {step < 4 && (
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '24px' }}>
                            {[1, 2, 3].map(s => (
                                <div key={s} style={{
                                    width: '32px', height: '4px', borderRadius: '2px',
                                    background: step >= s ? 'var(--gradient-primary)' : 'var(--border-glass)',
                                    transition: 'all 0.3s ease'
                                }} />
                            ))}
                        </div>
                    )}

                    {error && <div className={styles.errorMsg}>{error}</div>}
                    {success && step < 4 && (
                        <div style={{
                            background: 'rgba(0, 230, 118, 0.1)', color: '#00E676',
                            padding: '12px 16px', borderRadius: 'var(--radius-md)',
                            fontSize: '0.875rem', textAlign: 'center', marginBottom: '16px'
                        }}>{success}</div>
                    )}

                    {step === 1 && (
                        <form className={styles.loginForm} onSubmit={handleSendOTP}>
                            <div className="input-group">
                                <label>Email của bạn</label>
                                <input type="email" placeholder="your@email.com" value={email}
                                    onChange={e => { setEmail(e.target.value); setError('') }} required autoFocus />
                            </div>
                            <button type="submit" className={styles.loginBtn} disabled={loading}>
                                {loading ? '⏳ Đang gửi...' : '📧 Gửi mã xác nhận'}
                            </button>
                        </form>
                    )}

                    {step === 2 && (
                        <form className={styles.loginForm} onSubmit={(e) => handleVerifyOTP(e)}>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                                {otp.map((digit, idx) => (
                                    <input key={idx} ref={el => inputRefs.current[idx] = el}
                                        type="text" inputMode="numeric" maxLength={1} value={digit}
                                        onChange={e => handleOtpChange(idx, e.target.value)}
                                        onKeyDown={e => handleOtpKeyDown(idx, e)}
                                        onPaste={idx === 0 ? handleOtpPaste : undefined}
                                        autoFocus={idx === 0}
                                        style={{
                                            width: '52px', height: '60px', textAlign: 'center',
                                            fontSize: '1.5rem', fontWeight: 800,
                                            background: 'var(--bg-glass)',
                                            border: digit ? '2px solid var(--accent-green)' : '1px solid var(--border-glass)',
                                            borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
                                            transition: 'all 0.2s ease', caretColor: 'var(--accent-green)'
                                        }}
                                    />
                                ))}
                            </div>
                            <button type="submit" className={styles.loginBtn} disabled={loading || otp.join('').length < 6}>
                                {loading ? '⏳ Đang xác nhận...' : '✅ Xác nhận mã'}
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
                        </form>
                    )}

                    {step === 3 && (
                        <form className={styles.loginForm} onSubmit={handleResetPassword}>
                            <div className="input-group">
                                <label>Mật khẩu mới</label>
                                <input type="password" placeholder="••••••••" value={newPassword}
                                    onChange={e => { setNewPassword(e.target.value); setError('') }} autoFocus />
                            </div>
                            <div className="input-group">
                                <label>Xác nhận mật khẩu mới</label>
                                <input type="password" placeholder="••••••••" value={confirmPassword}
                                    onChange={e => { setConfirmPassword(e.target.value); setError('') }} />
                            </div>
                            <button type="submit" className={styles.loginBtn} disabled={loading}>
                                {loading ? '⏳ Đang xử lý...' : '🔑 Đặt lại mật khẩu'}
                            </button>
                        </form>
                    )}

                    {step === 4 && (
                        <div style={{ textAlign: 'center', padding: '20px 0' }}>
                            <div style={{ fontSize: '4rem', marginBottom: '16px' }}>🎉</div>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '0.95rem' }}>
                                Mật khẩu đã được đặt lại thành công!<br />
                                Bạn có thể đăng nhập với mật khẩu mới.
                            </p>
                            <button className={styles.loginBtn} onClick={() => navigate('/login')}>
                                🚀 Đăng nhập ngay
                            </button>
                        </div>
                    )}
                </div>

                <div className={styles.loginFooter}>
                    <Link to="/login">← Quay lại đăng nhập</Link>
                </div>
            </div>
        </div>
    )
}
