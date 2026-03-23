import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useDialog } from '../context/DialogContext'
import api from '../api/axios'
import styles from '../styles/UserProfile.module.css'

export default function UserProfile() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { user: currentUser } = useAuth()
    const { showAlert } = useDialog()
    const [profile, setProfile] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadProfile()
    }, [id])

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
                    <div className={styles.avatarLarge}>
                        {profile.avatar ? (
                            <img src={profile.avatar} alt={profile.full_name} />
                        ) : (
                            getInitials(profile.full_name)
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
        </div>
    )
}
