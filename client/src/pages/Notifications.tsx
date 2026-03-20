import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'
import styles from '../styles/Notifications.module.css'

interface Notification {
    id: number
    title: string
    message: string
    type: string
    reference_id: number
    is_read: boolean
    created_at: string
    icon?: string
}

export default function NotificationsPage() {
    const navigate = useNavigate()
    const { user } = useAuth()
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<'all' | 'unread'>('all')

    useEffect(() => {
        loadNotifications()
    }, [])

    const loadNotifications = async () => {
        try {
            setLoading(true)
            const res = await api.get('/notifications')
            setNotifications(res.data)
        } catch (err) {
            console.error('Load notifications error:', err)
        } finally {
            setLoading(false)
        }
    }

    const markAsRead = async (notificationId: number) => {
        try {
            await api.put(`/notifications/${notificationId}/read`)
            setNotifications(prev =>
                prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
            )
        } catch (err) {
            console.error('Mark as read error:', err)
        }
    }

    const markAllAsRead = async () => {
        try {
            await api.put('/notifications/read-all')
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
        } catch (err) {
            console.error('Mark all as read error:', err)
        }
    }

    const deleteNotification = (id: number) => {
        setNotifications(prev => prev.filter(n => n.id !== id))
    }

    const handleNotificationClick = async (notification: Notification) => {
        // Mark as read
        if (!notification.is_read) {
            await markAsRead(notification.id)
        }

        // Navigate based on notification type
        const { type, reference_id } = notification
        
        switch (type) {
            case 'like':
            case 'comment':
            case 'share':
                // Navigate directly to post detail page
                navigate(`/post/${reference_id}`)
                break
            case 'match_join':
            case 'match_created':
            case 'match_payment_confirmed':
            case 'match_payment_owner':
                navigate(`/matches/${reference_id}`)
                break
            case 'booking_confirmed':
            case 'booking_payment':
                navigate(`/booking/${reference_id}`)
                break
            default:
                break
        }
    }

    const getNotificationIcon = (type: string) => {
        const iconMap: Record<string, string> = {
            'like': '❤️',
            'comment': '💬',
            'share': '🔗',
            'match_join': '✅',
            'match_payment_confirmed': '💰',
            'booking_confirmed': '🎫',
            'match_full': '🏆',
            'match_cancelled': '❌',
            'match_created': '🎯',
            'booking_payment': '💵',
            'match_payment_owner': '💰'
        }
        return iconMap[type] || '🔔'
    }

    const formatTime = (createdAt: string) => {
        const now = new Date()
        const then = new Date(createdAt)
        const diffMs = now.getTime() - then.getTime()
        const diffMins = Math.floor(diffMs / 60000)
        const diffHours = Math.floor(diffMs / 3600000)
        const diffDays = Math.floor(diffMs / 86400000)

        if (diffMins < 1) return 'Vừa xong'
        if (diffMins < 60) return `${diffMins} phút trước`
        if (diffHours < 24) return `${diffHours} giờ trước`
        if (diffDays < 7) return `${diffDays} ngày trước`
        
        return then.toLocaleDateString('vi-VN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        })
    }

    const filteredNotifications = filter === 'unread'
        ? notifications.filter(n => !n.is_read)
        : notifications

    const unreadCount = notifications.filter(n => !n.is_read).length

    return (
        <div className={styles.container}>
            <div className={styles.pageHeader}>
                <h1>🔔 Thông báo</h1>
                <p className={styles.subtitle}>
                    Tổng {notifications.length} thông báo
                    {unreadCount > 0 && ` • ${unreadCount} chưa đọc`}
                </p>
            </div>

            <div className={styles.controls}>
                <div className={styles.filterTabs}>
                    <button
                        className={`${styles.tab} ${filter === 'all' ? styles.active : ''}`}
                        onClick={() => setFilter('all')}
                    >
                        Tất cả ({notifications.length})
                    </button>
                    <button
                        className={`${styles.tab} ${filter === 'unread' ? styles.active : ''}`}
                        onClick={() => setFilter('unread')}
                    >
                        Chưa đọc ({unreadCount})
                    </button>
                </div>

                {unreadCount > 0 && (
                    <button className={styles.markAllBtn} onClick={markAllAsRead}>
                        ✓ Đánh dấu tất cả đã đọc
                    </button>
                )}
            </div>

            <div className={styles.notificationsList}>
                {loading ? (
                    <div className={styles.loading}>Đang tải...</div>
                ) : filteredNotifications.length === 0 ? (
                    <div className={styles.empty}>
                        <p>😀 Không có thông báo nào</p>
                        <p className={styles.emptySubtext}>
                            {filter === 'unread' ? 'Bạn đã đọc tất cả thông báo!' : 'Quay lại sau nhé!'}
                        </p>
                    </div>
                ) : (
                    filteredNotifications.map(notif => (
                        <div
                            key={notif.id}
                            className={`${styles.notificationCard} ${!notif.is_read ? styles.unread : ''}`}
                            onClick={() => handleNotificationClick(notif)}
                            style={{ cursor: 'pointer' }}
                        >
                            <div className={styles.iconBox}>
                                {getNotificationIcon(notif.type)}
                            </div>

                            <div className={styles.contentBox}>
                                <h3 className={styles.title}>{notif.title}</h3>
                                <p className={styles.message}>{notif.message}</p>
                                <span className={styles.time}>
                                    {formatTime(notif.created_at)}
                                </span>
                            </div>

                            <div className={styles.actions}>
                                {!notif.is_read && (
                                    <button
                                        className={styles.actionBtn}
                                        title="Đánh dấu đã đọc"
                                        onClick={() => markAsRead(notif.id)}
                                    >
                                        ✓
                                    </button>
                                )}
                                <button
                                    className={`${styles.actionBtn} ${styles.deleteBtn}`}
                                    title="Xóa"
                                    onClick={() => deleteNotification(notif.id)}
                                >
                                    ✕
                                </button>
                            </div>

                            {!notif.is_read && <div className={styles.unreadIndicator}></div>}
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
