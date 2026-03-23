import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useDialog } from '../context/DialogContext'
import api from '../api/axios'
import styles from '../styles/Dashboard.module.css'
import settingStyles from '../styles/Settings.module.css'

export default function Settings() {
    const { user, updateUser } = useAuth()
    const { showAlert } = useDialog()
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
            await showAlert('✅ Đã lưu thay đổi!')
        } catch (err: any) {
            await showAlert(err.response?.data?.message || 'Lỗi cập nhật')
        } finally {
            setSaving(false)
        }
    }

    const handleChangePassword = async () => {
        if (passwordForm.new_password !== passwordForm.confirm_password) {
            await showAlert('Mật khẩu xác nhận không khớp!')
            return
        }
        if (passwordForm.new_password.length < 6) {
            await showAlert('Mật khẩu mới phải có ít nhất 6 ký tự!')
            return
        }
        setChangingPassword(true)
        try {
            await api.put('/auth/change-password', {
                current_password: passwordForm.current_password,
                new_password: passwordForm.new_password
            })
            setPasswordForm({ current_password: '', new_password: '', confirm_password: '' })
            await showAlert('✅ Đổi mật khẩu thành công!')
        } catch (err: any) {
            await showAlert(err.response?.data?.message || 'Lỗi đổi mật khẩu')
        } finally {
            setChangingPassword(false)
        }
    }

    const handleUpgradeRequest = async () => {
        if (!upgradeReason.trim()) {
            await showAlert('Vui lòng nhập lý do!')
            return;
        }
        if (!licenseFile) {
            await showAlert('Vui lòng tải lên giấy phép kinh doanh!')
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
            await showAlert(err.response?.data?.message || 'Lỗi gửi yêu cầu')
        } finally {
            setSubmittingUpgrade(false)
        }
    }

    return (
        <div className={styles.dashboardPage}>
            <div className={styles.dashboardContainer}>
                <div className={settingStyles.settingsContainer}>
                    <div className={settingStyles.pageHeader}>
                        <h1 className={`page-title ${settingStyles.pageTitle}`}>⚙️ Cài đặt</h1>
                        <p className="page-subtitle">Quản lý tài khoản của bạn</p>
                    </div>

                    {/* Profile */}
                    <div className={`glass-card ${settingStyles.sectionCard}`}>
                        <h3 className={settingStyles.sectionTitle}>👤 Thông tin cá nhân</h3>
                        <div className={settingStyles.formStack}>
                        <div className="input-group">
                            <label>Họ và tên</label>
                            <input className="input-field" value={form.full_name}
                                onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} />
                        </div>
                        <div className={settingStyles.twoCol}>
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
                        <div className={settingStyles.twoCol}>
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
                        <div className={settingStyles.actionRow}>
                            <button className="btn btn-primary"
                                onClick={handleSaveProfile} disabled={saving}>
                                {saving ? '⏳...' : '💾 Lưu thay đổi'}
                            </button>
                        </div>
                    </div>
                    </div>

                    {/* Upgrade to Owner */}
                    {user?.role === 'user' && (
                        <div className={`glass-card ${settingStyles.sectionCard}`} style={{ borderColor: 'rgba(255, 214, 0, 0.2)' }}>
                            <h3 className={settingStyles.sectionTitle} style={{ marginBottom: 8 }}>🏟️ Nâng cấp lên Owner</h3>
                            <p className={settingStyles.upgradeHint}>
                                Bạn muốn đăng ký sân và cho thuê? Gửi yêu cầu nâng cấp để trở thành chủ sân.
                            </p>
                            {upgradeSubmitted ? (
                                <div className={settingStyles.successBox}>
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
                                    <div className={settingStyles.actionRow}>
                                        <button className="btn btn-primary" disabled={!upgradeReason.trim() || !licenseFile || submittingUpgrade}
                                            onClick={handleUpgradeRequest}>
                                            {submittingUpgrade ? '⏳...' : '📤 Gửi yêu cầu nâng cấp'}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* Change Password */}
                    <div className={`glass-card ${settingStyles.sectionCard}`}>
                        <h3 className={settingStyles.sectionTitle}>🔒 Đổi mật khẩu</h3>
                        <div className={settingStyles.formStack}>
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
                        <div className={settingStyles.actionRow}>
                            <button className="btn btn-secondary"
                                onClick={handleChangePassword} disabled={changingPassword}>
                                {changingPassword ? '⏳...' : 'Đổi mật khẩu'}
                            </button>
                        </div>
                    </div>
                    </div>

                    {/* Account Info */}
                    <div className="glass-card">
                        <h3 className={settingStyles.sectionTitle} style={{ marginBottom: 12 }}>📋 Thông tin tài khoản</h3>
                        <div className={settingStyles.accountInfo}>
                            <div className={settingStyles.accountRow}>
                                <span>Vai trò</span>
                                <span className={`badge ${user?.role === 'owner' ? 'badge-yellow' : user?.role === 'admin' ? 'badge-red' : 'badge-green'}`}>
                                    {user?.role === 'owner' ? 'Chủ sân' : user?.role === 'admin' ? 'Admin' : 'Người chơi'}
                                </span>
                            </div>
                            <div className={settingStyles.accountRow}>
                                <span>Trạng thái</span>
                                <span className="badge badge-green">Hoạt động</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
