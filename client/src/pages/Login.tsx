import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'
import styles from '../styles/Login.module.css'

export default function Login() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const { login } = useAuth()
    const navigate = useNavigate()

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            const res = await api.post('/auth/login', { email, password })
            login(res.data.user, res.data.token)
            if (res.data.user.role === 'admin') navigate('/admin')
            else navigate('/')
        } catch (err) {
            const status = err.response?.status
            const data = err.response?.data

            if (status === 423) {
                // Account locked
                setError(data?.message || 'Tài khoản đã bị khóa tạm thời')
            } else if (status === 401 && data?.attemptsLeft !== undefined) {
                // Wrong password with attempts remaining
                setError(data?.message || 'Email hoặc mật khẩu không đúng')
            } else {
                setError(data?.message || 'Email hoặc mật khẩu không đúng')
            }
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className={styles.loginPage}>
            <div className={styles.loginContainer}>
                <div className={styles.loginHeader}>
                    <div className={styles.loginLogo}>
                        <div className={styles.loginLogoIcon}>🏓</div>
                        <div className={styles.loginLogoText}>
                            Pickle<span>Ball</span>
                        </div>
                    </div>
                    <h1 className={styles.loginTitle}>Chào mừng trở lại!</h1>
                    <p className={styles.loginSubtitle}>Đăng nhập để kết nối cộng đồng Pickleball Đà Nẵng</p>
                </div>

                <div className={styles.loginCard}>
                    <form className={styles.loginForm} onSubmit={handleSubmit}>
                        {error && <div className={styles.errorMsg}>{error}</div>}

                        <div className="input-group">
                            <label>Email</label>
                            <input
                                type="email"
                                placeholder="your@email.com"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                            />
                        </div>

                        <div className="input-group">
                            <label>Mật khẩu</label>
                            <input
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                            />
                        </div>

                        <div className={styles.forgotLink}>
                            <Link to="/forgot-password">Quên mật khẩu?</Link>
                        </div>

                        <button type="submit" className={styles.loginBtn} disabled={loading}>
                            {loading ? '⏳ Đang đăng nhập...' : '🚀 Đăng nhập'}
                        </button>
                    </form>
                </div>

                <div className={styles.loginFooter}>
                    Chưa có tài khoản? <Link to="/register">Đăng ký ngay</Link>
                </div>
            </div>
        </div>
    )
}
