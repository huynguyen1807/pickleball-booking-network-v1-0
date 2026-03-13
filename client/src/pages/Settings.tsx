import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'
import styles from '../styles/Dashboard.module.css'

export default function Settings() {
    const { user, updateUser } = useAuth()
    const [form, setForm] = useState<any>({
        full_name: user?.full_name || '',
        email: user?.email || '',
        phone: user?.phone || '',
        latitude: user?.latitude || '',
        longitude: user?.longitude || ''
    })
    const [passwordForm, setPasswordForm] = useState({
        current_password: '', new_password: '', confirm_password: ''
    })
    const [upgradeReason, setUpgradeReason] = useState('')
    const [upgradeSubmitted, setUpgradeSubmitted] = useState(false)
    const [saving, setSaving] = useState(false)
    const [changingPassword, setChangingPassword] = useState(false)
    const [submittingUpgrade, setSubmittingUpgrade] = useState(false)
    const [licenseFile, setLicenseFile] = useState<File | null>(null)

    const handleSaveProfile = async () => {
        setSaving(true)
        try {
            await api.put('/users/profile', {
                full_name: form.full_name,
                phone: form.phone,
                latitude: form.latitude || null,
                longitude: form.longitude || null
            })
            updateUser({ full_name: form.full_name, phone: form.phone })
            alert('✅ Đã lưu thay đổi!')
        } catch (err) {
            alert(err.response?.data?.message || 'Lỗi cập nhật')
        } finally {
            setSaving(false)
        }
    }

    const handleChangePassword = async () => {
        if (passwordForm.new_password !== passwordForm.confirm_password) {
            alert('Mật khẩu xác nhận không khớp!')
            return
        }
        if (passwordForm.new_password.length < 6) {
            alert('Mật khẩu mới phải có ít nhất 6 ký tự!')
            return
        }
        setChangingPassword(true)
        try {
            await api.put('/auth/change-password', {
                current_password: passwordForm.current_password,
                new_password: passwordForm.new_password
            })
            setPasswordForm({ current_password: '', new_password: '', confirm_password: '' })
            alert('✅ Đổi mật khẩu thành công!')
        } catch (err: any) {
            alert(err.response?.data?.message || 'Lỗi đổi mật khẩu')
        } finally {
            setChangingPassword(false)
        }
    }

    const handleUpgradeRequest = async () => {
        if (!upgradeReason.trim()) {
            alert('Vui lòng nhập lý do!');
            return;
        }
        if (!licenseFile) {
            alert('Vui lòng tải lên giấy phép kinh doanh!');
            return;
        }

        setSubmittingUpgrade(true)
        try {
            const formData = new FormData();
            formData.append('reason', upgradeReason);
            formData.append('license', licenseFile);

            await api.post('/users/upgrade-request', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            })
            setUpgradeSubmitted(true)
        } catch (err: any) {
            alert(err.response?.data?.message || 'Lỗi gửi yêu cầu')
        } finally {
            setSubmittingUpgrade(false)
        }
    }

    return (
        <div className={styles.dashboardPage}>
            <div style={{ maxWidth: '700px', margin: '0 auto' }}>
                <h1 className="page-title" style={{ marginBottom: '8px' }}>⚙️ Cài đặt</h1>
                <p className="page-subtitle" style={{ marginBottom: '28px' }}>Quản lý tài khoản của bạn</p>

                {/* Profile */}
                <div className="glass-card" style={{ marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '18px' }}>👤 Thông tin cá nhân</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        <div className="input-group">
                            <label>Họ và tên</label>
                            <input className="input-field" value={form.full_name}
                                onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div className="input-group">
                                <label>Email</label>
                                <input className="input-field" type="email" value={form.email} disabled
                                    style={{ opacity: 0.6 }} />
                            </div>
                            <div className="input-group">
                                <label>Số điện thoại</label>
                                <input className="input-field" type="tel" value={form.phone}
                                    onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
                            </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div className="input-group">
                                <label>Vĩ độ (Latitude)</label>
                                <input className="input-field" value={form.latitude}
                                    onChange={e => setForm(p => ({ ...p, latitude: e.target.value }))} />
                            </div>
                            <div className="input-group">
                                <label>Kinh độ (Longitude)</label>
                                <input className="input-field" value={form.longitude}
                                    onChange={e => setForm(p => ({ ...p, longitude: e.target.value }))} />
                            </div>
                        </div>
                        <button className="btn btn-primary" style={{ alignSelf: 'flex-end' }}
                            onClick={handleSaveProfile} disabled={saving}>
                            {saving ? '⏳...' : '💾 Lưu thay đổi'}
                        </button>
                    </div>
                </div>

                {/* Upgrade to Owner */}
                {user?.role === 'user' && (
                    <div className="glass-card" style={{ marginBottom: '16px', borderColor: 'rgba(255, 214, 0, 0.2)' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '8px' }}>🏟️ Nâng cấp lên Owner</h3>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                            Bạn muốn đăng ký sân và cho thuê? Gửi yêu cầu nâng cấp để trở thành chủ sân.
                        </p>
                        {upgradeSubmitted ? (
                            <div style={{
                                background: 'var(--accent-green-dim)', color: 'var(--accent-green)',
                                padding: '14px 16px', borderRadius: 'var(--radius-md)', fontSize: '0.875rem'
                            }}>
                                ✅ Yêu cầu đã được gửi! Vui lòng chờ Admin phê duyệt.
                            </div>
                        ) : (
                            <>
                                <div className="input-group" style={{ marginBottom: '14px' }}>
                                    <label>Lý do muốn trở thành Owner <span style={{ color: 'red' }}>*</span></label>
                                    <textarea className="input-field" rows={3}
                                        placeholder="VD: Tôi có 2 sân pickleball tại Hòa Xuân và muốn cho thuê qua nền tảng..."
                                        value={upgradeReason}
                                        onChange={e => setUpgradeReason(e.target.value)}
                                        style={{ resize: 'vertical' }} />
                                </div>
                                <div className="input-group" style={{ marginBottom: '14px' }}>
                                    <label>Giấy phép kinh doanh (Hình ảnh / PDF) <span style={{ color: 'red' }}>*</span></label>
                                    <input type="file" className="input-field"
                                        accept="image/jpeg, image/png, image/webp, application/pdf"
                                        onChange={e => setLicenseFile(e.target.files ? e.target.files[0] : null)} />
                                </div>
                                <button className="btn btn-primary" disabled={!upgradeReason.trim() || !licenseFile || submittingUpgrade}
                                    onClick={handleUpgradeRequest}>
                                    {submittingUpgrade ? '⏳...' : '📤 Gửi yêu cầu nâng cấp'}
                                </button>
                            </>
                        )}
                    </div>
                )}

                {/* Change Password */}
                <div className="glass-card" style={{ marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '18px' }}>🔒 Đổi mật khẩu</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        <div className="input-group">
                            <label>Mật khẩu hiện tại</label>
                            <input className="input-field" type="password" placeholder="••••••••"
                                value={passwordForm.current_password}
                                onChange={e => setPasswordForm(p => ({ ...p, current_password: e.target.value }))} />
                        </div>
                        <div className="input-group">
                            <label>Mật khẩu mới</label>
                            <input className="input-field" type="password" placeholder="••••••••"
                                value={passwordForm.new_password}
                                onChange={e => setPasswordForm(p => ({ ...p, new_password: e.target.value }))} />
                        </div>
                        <div className="input-group">
                            <label>Xác nhận mật khẩu mới</label>
                            <input className="input-field" type="password" placeholder="••••••••"
                                value={passwordForm.confirm_password}
                                onChange={e => setPasswordForm(p => ({ ...p, confirm_password: e.target.value }))} />
                        </div>
                        <button className="btn btn-secondary" style={{ alignSelf: 'flex-end' }}
                            onClick={handleChangePassword} disabled={changingPassword}>
                            {changingPassword ? '⏳...' : 'Đổi mật khẩu'}
                        </button>
                    </div>
                </div>

                {/* Account Info */}
                <div className="glass-card">
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '12px' }}>📋 Thông tin tài khoản</h3>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Vai trò</span>
                            <span className={`badge ${user?.role === 'owner' ? 'badge-yellow' : user?.role === 'admin' ? 'badge-red' : 'badge-green'}`}>
                                {user?.role === 'owner' ? 'Chủ sân' : user?.role === 'admin' ? 'Admin' : 'Người chơi'}
                            </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Trạng thái</span>
                            <span className="badge badge-green">Hoạt động</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
