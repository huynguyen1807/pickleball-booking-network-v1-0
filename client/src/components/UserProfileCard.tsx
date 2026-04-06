import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useDialog } from '../context/DialogContext'
import api from '../api/axios'
import ReportModal from './ReportModal'
import styles from '../styles/UserProfileCard.module.css'

interface UserProfileCardProps {
    userId: number
    children: React.ReactNode
    onStartChat?: (userId: number) => void
}

export default function UserProfileCard({ userId, children, onStartChat }: UserProfileCardProps) {
    const { user: currentUser } = useAuth()
    const { showAlert } = useDialog()
    const navigate = useNavigate()
    const [show, setShow] = useState(false)
    const [userInfo, setUserInfo] = useState<any>(null)
    const [loading, setLoading] = useState(false)
    const [showReportModal, setShowReportModal] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const cardRef = useRef<HTMLDivElement>(null)
    const timeoutRef = useRef<any>(null)
    const [cardStyle, setCardStyle] = useState<React.CSSProperties>({})

    const calculatePosition = useCallback(() => {
        if (!containerRef.current) return
        const rect = containerRef.current.getBoundingClientRect()
        const cardWidth = 280
        const cardHeight = 220
        const gap = 8

        const spaceBelow = window.innerHeight - rect.bottom
        const showAbove = spaceBelow < cardHeight + gap

        let top: number
        if (showAbove) {
            top = rect.top - cardHeight - gap + window.scrollY
        } else {
            top = rect.bottom + gap + window.scrollY
        }

        let left = rect.left + rect.width / 2 - cardWidth / 2
        // Keep within viewport
        if (left < 8) left = 8
        if (left + cardWidth > window.innerWidth - 8) left = window.innerWidth - cardWidth - 8

        setCardStyle({
            position: 'fixed' as const,
            top: showAbove ? rect.top - cardHeight - gap : rect.bottom + gap,
            left,
            width: cardWidth,
            zIndex: 9999,
        })
    }, [])

    const handleMouseEnter = () => {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = setTimeout(() => {
            setShow(true)
            if (!userInfo && !loading) loadUser()
            calculatePosition()
        }, 400)
    }

    const handleMouseLeave = () => {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = setTimeout(() => setShow(false), 300)
    }

    const handleCardMouseEnter = () => {
        clearTimeout(timeoutRef.current)
    }

    const handleCardMouseLeave = () => {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = setTimeout(() => setShow(false), 300)
    }

    const loadUser = async () => {
        setLoading(true)
        try {
            const res = await api.get(`/users/brief/${userId}`)
            setUserInfo(res.data)
        } catch { }
        finally { setLoading(false) }
    }

    const handleStartChat = async () => {
        if (onStartChat) {
            onStartChat(userId)
        } else {
            try {
                const res = await api.post('/chat/dm', { targetUserId: userId })
                navigate(`/chat?room=${res.data.roomId}`)
            } catch (err: any) {
                await showAlert(err.response?.data?.message || 'Không thể tạo cuộc trò chuyện')
            }
        }
        setShow(false)
    }

    const handleViewProfile = () => {
        navigate(`/profile/${userId}`)
        setShow(false)
    }

    useEffect(() => {
        return () => clearTimeout(timeoutRef.current)
    }, [])

    const getInitials = (name: string) =>
        name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'

    const roleLabels: Record<string, string> = {
        user: '🏓 Người chơi',
        owner: '🏟️ Chủ sân',
        admin: '⚡ Quản trị viên'
    }

    const isMe = currentUser?.id === userId

    return (
        <div
            ref={containerRef}
            className={styles.container}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {children}
            {show && createPortal(
                <div
                    ref={cardRef}
                    className={styles.card}
                    style={cardStyle}
                    onMouseEnter={handleCardMouseEnter}
                    onMouseLeave={handleCardMouseLeave}
                >
                    {loading ? (
                        <div className={styles.loading}>⏳</div>
                    ) : userInfo ? (
                        <>
                            <div className={styles.header}>
                                <div className={styles.avatar}>
                                    {userInfo.avatar ? (
                                        <img src={userInfo.avatar} alt={userInfo.full_name} />
                                    ) : (
                                        getInitials(userInfo.full_name)
                                    )}
                                    <span className={`${styles.statusDot} ${styles.online}`} />
                                </div>
                                <div className={styles.info}>
                                    <div className={styles.name}>{userInfo.full_name}</div>
                                    <div className={styles.role}>{roleLabels[userInfo.role] || userInfo.role}</div>
                                </div>
                            </div>
                            <div className={styles.stats}>
                                <div className={styles.stat}>
                                    <span className={styles.statValue}>{userInfo.total_matches || 0}</span>
                                    <span className={styles.statLabel}>Trận</span>
                                </div>
                                <div className={styles.stat}>
                                    <span className={styles.statValue}>
                                        {userInfo.created_at ? new Date(userInfo.created_at).toLocaleDateString('vi-VN', { month: 'short', year: 'numeric' }) : '---'}
                                    </span>
                                    <span className={styles.statLabel}>Tham gia</span>
                                </div>
                            </div>
                            <div className={styles.actions}>
                                <button className={styles.btnProfile} onClick={handleViewProfile}>
                                    👤 Xem hồ sơ
                                </button>
                                {!isMe && (
                                    <>
                                        <button className={styles.btnChat} onClick={handleStartChat}>
                                            💬 Nhắn tin
                                        </button>
                                        <button
                                            style={{
                                                flex: 1,
                                                padding: '6px',
                                                background: 'var(--accent-red-dim)',
                                                color: 'var(--accent-red)',
                                                border: 'none',
                                                borderRadius: 'var(--radius-sm)',
                                                fontSize: '0.85rem',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                transition: 'all 0.2s'
                                            }}
                                            onClick={() => { setShowReportModal(true); setShow(false) }}
                                        >
                                            🚩 Báo cáo
                                        </button>
                                    </>
                                )}
                            </div>
                        </>
                    ) : null}
                </div>,
                document.body
            )}
            <ReportModal
                isOpen={showReportModal}
                targetId={userId}
                targetType="user"
                targetName={userInfo?.full_name}
                onClose={() => setShowReportModal(false)}
            />
        </div>
    )
}
