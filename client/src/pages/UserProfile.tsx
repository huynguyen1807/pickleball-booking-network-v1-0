import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useDialog } from '../context/DialogContext'
import api from '../api/axios'
import styles from '../styles/UserProfile.module.css'

type AvatarMode = null | 'choose' | 'camera' | 'preview'

export default function UserProfile() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { user: currentUser, updateUser } = useAuth()
    const { showAlert } = useDialog()
    const [profile, setProfile] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    // Avatar states
    const [avatarMode, setAvatarMode] = useState<AvatarMode>(null)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [previewFile, setPreviewFile] = useState<File | null>(null)
    const [uploading, setUploading] = useState(false)

    // Camera refs
    const videoRef = useRef<HTMLVideoElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        loadProfile()
    }, [id])

    // Cleanup camera on unmount or modal close
    useEffect(() => {
        return () => stopCamera()
    }, [])

    const loadProfile = async () => {
        try {
            const res = await api.get(`/users/profile/${id}`)
            setProfile(res.data)
        } catch (err) {
            console.error('Failed to load profile:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleStartChat = async () => {
        try {
            const res = await api.post('/chat/dm', { targetUserId: parseInt(id!) })
            navigate(`/chat?room=${res.data.roomId}`)
        } catch (err: any) {
            await showAlert(err.response?.data?.message || 'Không thể tạo cuộc trò chuyện')
        }
    }

    const getInitials = (name: string) =>
        name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'

    const roleLabels: Record<string, string> = {
        user: '🏓 Người chơi',
        owner: '🏟️ Chủ sân',
        admin: '⚡ Quản trị viên'
    }

    // ── Avatar handlers ──

    const closeModal = useCallback(() => {
        stopCamera()
        setAvatarMode(null)
        setPreviewUrl(null)
        setPreviewFile(null)
    }, [])

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop())
            streamRef.current = null
        }
    }

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
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
        } catch (err) {
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
        setUploading(true)
        try {
            const formData = new FormData()
            formData.append('avatar', previewFile)
            const res = await api.put('/users/avatar', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            })
            // Update profile locally
            setProfile((prev: any) => ({ ...prev, avatar: res.data.avatar }))
            // Update AuthContext so avatar shows everywhere
            updateUser({ avatar: res.data.avatar })
            closeModal()
        } catch (err: any) {
            alert(err.response?.data?.message || 'Lỗi khi cập nhật ảnh')
        } finally {
            setUploading(false)
        }
    }

    // ── Render ──

    if (loading) return (
        <div className={styles.profilePage}>
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>⏳ Đang tải...</div>
        </div>
    )

    if (!profile) return (
        <div className={styles.profilePage}>
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
                Không tìm thấy người dùng
            </div>
        </div>
    )

    const isMe = currentUser?.id === parseInt(id!)
    const memberSince = new Date(profile.created_at).toLocaleDateString('vi-VN', {
        day: '2-digit', month: 'long', year: 'numeric'
    })

    return (
        <div className={styles.profilePage}>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate(-1)}
                style={{ marginBottom: '20px' }}>← Quay lại</button>

            <div className={styles.profileCard}>
                <div className={styles.coverBg} />
                <div className={styles.profileHeader}>
                    <div className={styles.avatarLarge} style={{ position: 'relative' }}>
                        {profile.avatar ? (
                            <img src={profile.avatar} alt={profile.full_name} />
                        ) : (
                            getInitials(profile.full_name)
                        )}
                        {isMe && (
                            <button
                                className={styles.avatarEditBtn}
                                onClick={() => setAvatarMode('choose')}
                                title="Thay đổi ảnh đại diện"
                            >
                                📷
                            </button>
                        )}
                    </div>
                    <div className={styles.headerInfo}>
                        <h1 className={styles.fullName}>{profile.full_name}</h1>
                        <div className={styles.roleBadge}>{roleLabels[profile.role] || profile.role}</div>
                        <div className={styles.memberSince}>📅 Tham gia từ {memberSince}</div>
                    </div>
                    {!isMe && (
                        <div className={styles.headerActions}>
                            <button className="btn btn-primary" onClick={handleStartChat}>
                                💬 Nhắn tin
                            </button>
                        </div>
                    )}
                </div>

                <div className={styles.statsGrid}>
                    <div className={styles.statCard}>
                        <div className={styles.statIcon}>🎯</div>
                        <div className={styles.statNumber}>{profile.total_matches || 0}</div>
                        <div className={styles.statTitle}>Trận đã chơi</div>
                    </div>
                    <div className={styles.statCard}>
                        <div className={styles.statIcon}>📋</div>
                        <div className={styles.statNumber}>{profile.total_bookings || 0}</div>
                        <div className={styles.statTitle}>Lượt đặt sân</div>
                    </div>
                    <div className={styles.statCard}>
                        <div className={styles.statIcon}>📸</div>
                        <div className={styles.statNumber}>{profile.total_posts || 0}</div>
                        <div className={styles.statTitle}>Bài đăng</div>
                    </div>
                </div>

                {profile.phone && (
                    <div className={styles.infoSection}>
                        <h3 className={styles.sectionTitle}>📞 Thông tin liên hệ</h3>
                        <div className={styles.infoRow}>
                            <span className={styles.infoLabel}>Số điện thoại</span>
                            <span className={styles.infoValue}>{profile.phone}</span>
                        </div>
                    </div>
                )}

                {/* Sân đang sở hữu (Owned Facilities) */}
                {profile.role === 'owner' && profile.owned_facilities && profile.owned_facilities.length > 0 && (
                    <div className={styles.infoSection}>
                        <h3 className={styles.sectionTitle}>🏟️ Sân đang sở hữu</h3>
                        <div className={styles.facilitiesGrid}>
                            {profile.owned_facilities.map((fac: any) => (
                                <div key={fac.id} className={styles.facilityCard} onClick={() => navigate(`/facilities/${fac.id}`)}>
                                    <div className={styles.facilityAvatar}>
                                        {fac.avatar ? (
                                            <img src={fac.avatar} alt={fac.name} />
                                        ) : (
                                            <div className={styles.facilityAvatarFallback}>🏟️</div>
                                        )}
                                    </div>
                                    <div className={styles.facilityInfo}>
                                        <div className={styles.facilityName}>{fac.name}</div>
                                        <div className={styles.facilityAddress}>{fac.address}</div>
                                        <div className={styles.facilityPrice}>
                                            Từ {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(fac.min_price)}/h
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className={styles.infoSection}>
                    <h3 className={styles.sectionTitle}>ℹ️ Trạng thái</h3>
                    <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>Tài khoản</span>
                        <span className={`badge ${profile.status === 'active' ? 'badge-green' : 'badge-yellow'}`}>
                            {profile.status === 'active' ? 'Hoạt động' : 'Chờ duyệt'}
                        </span>
                    </div>
                </div>
            </div>

            {/* ── Avatar Modal ── */}
            {avatarMode && (
                <div className={styles.modalOverlay} onClick={closeModal}>
                    <div className={styles.modalContent} onClick={e => e.stopPropagation()}>

                        {/* Choose mode */}
                        {avatarMode === 'choose' && (
                            <>
                                <h3 className={styles.modalTitle}>Thay đổi ảnh đại diện</h3>
                                <div className={styles.chooseGrid}>
                                    <button className={styles.chooseBtn} onClick={() => fileInputRef.current?.click()}>
                                        <span className={styles.chooseBtnIcon}>📁</span>
                                        <span>Tải ảnh lên</span>
                                    </button>
                                    <button className={styles.chooseBtn} onClick={openCamera}>
                                        <span className={styles.chooseBtnIcon}>📷</span>
                                        <span>Chụp ảnh</span>
                                    </button>
                                </div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    style={{ display: 'none' }}
                                    onChange={handleFileSelect}
                                />
                                <button className={styles.modalCancelBtn} onClick={closeModal}>Hủy</button>
                            </>
                        )}

                        {/* Camera mode */}
                        {avatarMode === 'camera' && (
                            <>
                                <h3 className={styles.modalTitle}>📷 Chụp ảnh</h3>
                                <div className={styles.cameraContainer}>
                                    <video
                                        ref={videoRef}
                                        autoPlay
                                        playsInline
                                        muted
                                        className={styles.cameraVideo}
                                    />
                                    <canvas ref={canvasRef} style={{ display: 'none' }} />
                                </div>
                                <div className={styles.cameraActions}>
                                    <button className={styles.modalCancelBtn} onClick={() => { stopCamera(); setAvatarMode('choose') }}>
                                        ← Quay lại
                                    </button>
                                    <button className={styles.captureBtn} onClick={capturePhoto}>
                                        📸 Chụp
                                    </button>
                                </div>
                            </>
                        )}

                        {/* Preview mode */}
                        {avatarMode === 'preview' && previewUrl && (
                            <>
                                <h3 className={styles.modalTitle}>Xác nhận ảnh</h3>
                                <div className={styles.previewContainer}>
                                    <img src={previewUrl} alt="Preview" className={styles.previewImage} />
                                </div>
                                <div className={styles.cameraActions}>
                                    <button className={styles.modalCancelBtn} onClick={() => { setPreviewUrl(null); setPreviewFile(null); setAvatarMode('choose') }}>
                                        ← Chọn lại
                                    </button>
                                    <button className={styles.confirmBtn} onClick={uploadAvatar} disabled={uploading}>
                                        {uploading ? '⏳ Đang lưu...' : '✅ Xác nhận'}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
