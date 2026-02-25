import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api/axios'
import styles from '../styles/Register.module.css'

export default function Register() {
    const navigate = useNavigate()
    const [form, setForm] = useState({
        full_name: '', email: '', phone: '', password: '', confirmPassword: '', role: 'user'
    })
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [loading, setLoading] = useState(false)

    const handleChange = (e) => {
        setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setSuccess('')

        if (form.password !== form.confirmPassword) {
            return setError('Mật khẩu xác nhận không khớp!')
        }

        if (form.password.length < 6) {
            return setError('Mật khẩu phải có ít nhất 6 ký tự!')
        }

        setLoading(true)
        try {
            await api.post('/auth/register', {
                full_name: form.full_name,
                email: form.email,
                phone: form.phone,
                password: form.password,
                role: form.role
            })

            if (form.role === 'owner') {
                setSuccess('Đăng ký thành công! Tài khoản Owner đang chờ Admin duyệt.')
            } else {
                setSuccess('Đăng ký thành công! Đang chuyển đến trang đăng nhập...')
                setTimeout(() => navigate('/login'), 2000)
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Có lỗi xảy ra. Vui lòng thử lại!')
        } finally {
            setLoading(false)
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
                    <h1 className={styles.title}>Tạo tài khoản mới</h1>
                    <p className={styles.subtitle}>Tham gia cộng đồng Pickleball sôi động nhất Đà Nẵng</p>
                </div>

                <div className={styles.card}>
                    <form className={styles.form} onSubmit={handleSubmit}>
                        {error && <div className={styles.errorMsg}>{error}</div>}
                        {success && <div className={styles.successMsg}>{success}</div>}

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

                        <button type="submit" className={styles.submitBtn} disabled={loading}>
                            {loading ? '⏳ Đang xử lý...' : '🚀 Đăng ký'}
                        </button>
                    </form>
                </div>

                <div className={styles.footer}>
                    Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
                </div>
            </div>
        </div>
    )
}
