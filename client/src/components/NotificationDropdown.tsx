import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'
import styles from '../styles/NotificationDropdown.module.css'
import { Bell, X } from 'lucide-react'
import io from 'socket.io-client'

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

export default function NotificationDropdown() {
    const navigate = useNavigate()
    const { user } = useAuth()
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [isOpen, setIsOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)

    // Load notifications on mount
    useEffect(() => {
        if (user) {
            loadNotifications()
            subscribeToSocketEvents()
        }
    }, [user])

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const loadNotifications = async () => {
        try {
            setLoading(true)
            const [notiRes, unreadRes] = await Promise.all([
                api.get('/notifications'),
                api.get('/notifications/unread-count')
            ])
            setNotifications(notiRes.data)
            setUnreadCount(unreadRes.data.count)
        } catch (err) {
            console.error('Load notifications error:', err)
        } finally {
            setLoading(false)
        }
    }

    const subscribeToSocketEvents = () => {
        const socketUrl = window.location.hostname === 'localhost' 
            ? 'http://localhost:5000' 
            : window.location.origin
        const socket = io(socketUrl)
        
        socket.on('connect', () => {
            if (user?.id) {
                socket.emit('join_notifications', user.id)
            }
        })

        // Listen for new notifications
        socket.on('new_notification', () => {
            loadNotifications()
        })

        return () => {
            socket.disconnect()
        }
    }

    const markAsRead = async (notificationId: number) => {
        try {
            await api.put(`/notifications/${notificationId}/read`)
            setNotifications(prev =>
                prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
            )
            setUnreadCount(prev => Math.max(0, prev - 1))
        } catch (err) {
            console.error('Mark as read error:', err)
        }
    }

    const markAllAsRead = async () => {
        try {
            await api.put('/notifications/read-all')
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
            setUnreadCount(0)
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

        // Close dropdown
        setIsOpen(false)

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
        if (diffMins < 60) return `${diffMins}m trước`
        if (diffHours < 24) return `${diffHours}h trước`
        if (diffDays < 7) return `${diffDays}d trước`
        
        return then.toLocaleDateString('vi-VN')
    }

    return (
        <div className={styles.notificationContainer} ref={dropdownRef}>
            <button
                className={styles.bellButton}
                onClick={() => setIsOpen(!isOpen)}
                title="Thông báo"
            >
                <Bell size={20} />
                {unreadCount > 0 && (
                    <span className={styles.badge}>{unreadCount > 99 ? '99+' : unreadCount}</span>
                )}
            </button>

            {isOpen && (
                <div className={styles.dropdown}>
                    <div className={styles.header}>
                        <h4>Thông báo</h4>
                        {unreadCount > 0 && (
                            <button
                                className={styles.markAllRead}
                                onClick={markAllAsRead}
                                title="Đánh dấu tất cả đã đọc"
                            >
                                Đánh dấu tất cả
                            </button>
                        )}
                    </div>

                    <div className={styles.notificationsList}>
                        {loading ? (
                            <div className={styles.empty}>Đang tải...</div>
                        ) : notifications.length === 0 ? (
                            <div className={styles.empty}>Không có thông báo</div>
                        ) : (
                            notifications.map(notif => (
                                <div
                                    key={notif.id}
                                    className={`${styles.notificationItem} ${!notif.is_read ? styles.unread : ''}`}
                                    onClick={() => handleNotificationClick(notif)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <div className={styles.iconContainer}>
                                        <span className={styles.icon}>
                                            {getNotificationIcon(notif.type)}
                                        </span>
                                    </div>

                                    <div className={styles.content}>
                                        <p className={styles.title}>{notif.title}</p>
                                        <p className={styles.message}>{notif.message}</p>
                                        <span className={styles.time}>
                                            {formatTime(notif.created_at)}
                                        </span>
                                    </div>

                                    <button
                                        className={styles.deleteBtn}
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            deleteNotification(notif.id)
                                        }}
                                        title="Xóa"
                                    >
                                        <X size={16} />
                                    </button>

                                    {!notif.is_read && <div className={styles.unreadDot}></div>}
                                </div>
                            ))
                        )}
                    </div>

                    {notifications.length > 0 && (
                        <div className={styles.footer}>
                            <a href="/notifications">Xem tất cả thông báo →</a>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
