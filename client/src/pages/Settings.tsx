import { useState, useRef, useCallback, useEffect } from 'react'
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

    // Avatar states
    type AvatarMode = null | 'choose' | 'camera' | 'preview'
    const [avatarMode, setAvatarMode] = useState<AvatarMode>(null)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [previewFile, setPreviewFile] = useState<File | null>(null)
    const [uploadingAvatar, setUploadingAvatar] = useState(false)
    const videoRef = useRef<HTMLVideoElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        return () => stopCamera()
    }, [])

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop())
            streamRef.current = null
        }
    }

    const closeAvatarModal = useCallback(() => {
        stopCamera()
        setAvatarMode(null)
        setPreviewUrl(null)
        setPreviewFile(null)
    }, [])

    const handleAvatarFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            alert('Chỉ chấp nhận file ảnh JPG, PNG hoặc WEBP')
            return
        }
        if (file.size > 3 * 1024 * 1024) {
            alert('File ảnh không được vượt quá 3MB')
            return
        }
        setPreviewFile(file)
        setPreviewUrl(URL.createObjectURL(file))
        setAvatarMode('preview')
    }

    const openCamera = async () => {
        setAvatarMode('camera')
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: 480, height: 480 }
            })
            streamRef.current = stream
            if (videoRef.current) {
                videoRef.current.srcObject = stream
            }
        } catch {
            alert('Không thể truy cập camera. Vui lòng cho phép truy cập camera.')
            setAvatarMode('choose')
        }
    }

    const capturePhoto = () => {
        if (!videoRef.current || !canvasRef.current) return
        const video = videoRef.current
        const canvas = canvasRef.current
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(video, 0, 0)
        canvas.toBlob((blob) => {
            if (!blob) return
            const file = new File([blob], 'camera-photo.jpg', { type: 'image/jpeg' })
            setPreviewFile(file)
            setPreviewUrl(URL.createObjectURL(blob))
            stopCamera()
            setAvatarMode('preview')
        }, 'image/jpeg', 0.9)
    }

    const uploadAvatar = async () => {
        if (!previewFile) return
        setUploadingAvatar(true)
        try {
            const formData = new FormData()
            formData.append('avatar', previewFile)
            const res = await api.put('/users/avatar', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            })
            updateUser({ avatar: res.data.avatar })
            closeAvatarModal()
            alert('✅ Cập nhật ảnh đại diện thành công!')
        } catch (err: any) {
            alert(err.response?.data?.message || 'Lỗi khi cập nhật ảnh')
        } finally {
            setUploadingAvatar(false)
        }
    }

    const getInitials = (name: string) =>
        name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'

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


                {/* Avatar */}
                <div className="glass-card" style={{ marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '18px' }}>📷 Ảnh đại diện</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <div style={{
                            width: 72, height: 72, borderRadius: '50%',
                            background: 'var(--accent-green-dim)', color: 'var(--accent-green)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 800, fontSize: '1.4rem', overflow: 'hidden', flexShrink: 0,
                            border: '3px solid var(--border-glass)'
                        }}>
                            {user?.avatar ? (
                                <img src={user.avatar} alt={user.full_name}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                            ) : getInitials(user?.full_name || '')}
                        </div>
                        <div style={{ flex: 1 }}>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                                Ảnh đại diện sẽ hiển thị trên profile, bài đăng và bình luận của bạn.
                            </p>
                            <button className="btn btn-secondary btn-sm" onClick={() => setAvatarMode('choose')}>
                                📷 Thay đổi ảnh
                            </button>
                        </div>
                    </div>
                </div>

                {/* Profile */}
                <div className="glass-card" style={{ marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '18px' }}>👤 Thông tin cá nhân</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

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

            {/* Avatar Modal */}
            {avatarMode && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
                    backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', zIndex: 9999, padding: '20px'
                }} onClick={closeAvatarModal}>
                    <div style={{
                        background: 'var(--bg-card)', border: '1px solid var(--border-glass)',
                        borderRadius: 'var(--radius-xl)', padding: '28px', maxWidth: '400px',
                        width: '100%', animation: 'fadeIn 0.25s ease'
                    }} onClick={e => e.stopPropagation()}>

                        {avatarMode === 'choose' && (
                            <>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, textAlign: 'center', marginBottom: '20px' }}>
                                    Thay đổi ảnh đại diện
                                </h3>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                                    <button onClick={() => fileInputRef.current?.click()} style={{
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                                        padding: '24px 16px', background: 'var(--bg-glass)', border: '1px solid var(--border-glass)',
                                        borderRadius: 'var(--radius-md)', cursor: 'pointer', color: 'var(--text-primary)',
                                        fontSize: '0.85rem', fontWeight: 600, transition: 'all 0.2s'
                                    }}>
                                        <span style={{ fontSize: '2rem' }}>📁</span>
                                        <span>Tải ảnh lên</span>
                                    </button>
                                    <button onClick={openCamera} style={{
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                                        padding: '24px 16px', background: 'var(--bg-glass)', border: '1px solid var(--border-glass)',
                                        borderRadius: 'var(--radius-md)', cursor: 'pointer', color: 'var(--text-primary)',
                                        fontSize: '0.85rem', fontWeight: 600, transition: 'all 0.2s'
                                    }}>
                                        <span style={{ fontSize: '2rem' }}>📷</span>
                                        <span>Chụp ảnh</span>
                                    </button>
                                </div>
                                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp"
                                    style={{ display: 'none' }} onChange={handleAvatarFileSelect} />
                                <button onClick={closeAvatarModal} style={{
                                    width: '100%', padding: '10px', background: 'var(--bg-glass)',
                                    border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-md)',
                                    color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer'
                                }}>Hủy</button>
                            </>
                        )}

                        {avatarMode === 'camera' && (
                            <>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, textAlign: 'center', marginBottom: '16px' }}>
                                    📷 Chụp ảnh
                                </h3>
                                <div style={{
                                    width: '100%', aspectRatio: '1', borderRadius: 'var(--radius-md)',
                                    overflow: 'hidden', marginBottom: '16px', background: '#000'
                                }}>
                                    <video ref={videoRef} autoPlay playsInline muted
                                        style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
                                    <canvas ref={canvasRef} style={{ display: 'none' }} />
                                </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button onClick={() => { stopCamera(); setAvatarMode('choose') }} style={{
                                        flex: 1, padding: '10px', background: 'var(--bg-glass)',
                                        border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-md)',
                                        color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer'
                                    }}>← Quay lại</button>
                                    <button onClick={capturePhoto} style={{
                                        flex: 1, padding: '10px', background: 'linear-gradient(135deg, #00E676, #00C853)',
                                        color: '#000', border: 'none', borderRadius: 'var(--radius-md)',
                                        fontWeight: 700, cursor: 'pointer'
                                    }}>📸 Chụp</button>
                                </div>
                            </>
                        )}

                        {avatarMode === 'preview' && previewUrl && (
                            <>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, textAlign: 'center', marginBottom: '16px' }}>
                                    Xác nhận ảnh
                                </h3>
                                <div style={{
                                    width: '100%', aspectRatio: '1', borderRadius: 'var(--radius-md)',
                                    overflow: 'hidden', marginBottom: '16px', background: '#000'
                                }}>
                                    <img src={previewUrl} alt="Preview"
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button onClick={() => { setPreviewUrl(null); setPreviewFile(null); setAvatarMode('choose') }} style={{
                                        flex: 1, padding: '10px', background: 'var(--bg-glass)',
                                        border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-md)',
                                        color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer'
                                    }}>← Chọn lại</button>
                                    <button onClick={uploadAvatar} disabled={uploadingAvatar} style={{
                                        flex: 1, padding: '10px', background: 'linear-gradient(135deg, #00E676, #00C853)',
                                        color: '#000', border: 'none', borderRadius: 'var(--radius-md)',
                                        fontWeight: 700, cursor: 'pointer', opacity: uploadingAvatar ? 0.6 : 1
                                    }}>{uploadingAvatar ? '⏳ Đang lưu...' : '✅ Xác nhận'}</button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
