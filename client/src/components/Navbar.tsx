import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'
import { io as socketIO } from 'socket.io-client'
import styles from '../styles/Navbar.module.css'

export default function Navbar() {
    const { user, logout } = useAuth()
    const navigate = useNavigate()
    const [scrolled, setScrolled] = useState(false)
    const [dropdownOpen, setDropdownOpen] = useState(false)
    const [mobileOpen, setMobileOpen] = useState(false)
    const [notifOpen, setNotifOpen] = useState(false)
    const [notifications, setNotifications] = useState<any[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [loadingNotif, setLoadingNotif] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)
    const notifRef = useRef<HTMLDivElement>(null)

    // Scroll effect
    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20)
        window.addEventListener('scroll', handleScroll)
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    // Close dropdowns on outside click
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
                setDropdownOpen(false)
            if (notifRef.current && !notifRef.current.contains(e.target as Node))
                setNotifOpen(false)
        }
        document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [])

    // Fetch unread count
    const fetchUnreadCount = useCallback(async () => {
        if (!user) return
        try {
            const res = await api.get('/notifications/unread-count')
            setUnreadCount(res.data.count || 0)
        } catch { }
    }, [user])

    useEffect(() => {
        fetchUnreadCount()
        const interval = setInterval(fetchUnreadCount, 30000)
        return () => clearInterval(interval)
    }, [fetchUnreadCount])

    // Socket real-time notifications
    useEffect(() => {
        if (!user) return
        const socket = socketIO('http://localhost:5000', { transports: ['websocket'] })
        socket.emit('join_notifications', user.id)
        socket.on('new_notification', () => {
            // Increment badge immediately
            setUnreadCount(prev => prev + 1)
            // If panel is open, refresh list
            if (notifOpen) loadNotifications()
        })
        return () => socket.disconnect()
    }, [user, notifOpen])

    // Load full notification list
    const loadNotifications = async () => {
        setLoadingNotif(true)
        try {
            const res = await api.get('/notifications')
            setNotifications(res.data || [])
            const unread = (res.data || []).filter((n: any) => !n.is_read).length
            setUnreadCount(unread)
        } catch { }
        setLoadingNotif(false)
    }

    const handleOpenNotif = () => {
        setNotifOpen(v => !v)
        setDropdownOpen(false)
        if (!notifOpen) loadNotifications()
    }

    const handleMarkRead = async (notif: any) => {
        // Always navigate if there's a reference post
        if (notif.reference_id && (notif.type === 'like' || notif.type === 'comment' || notif.type === 'share')) {
            navigate(`/post/${notif.reference_id}/photo`)
            setNotifOpen(false)
        }
        // Only call API to mark read if not already read
        if (!notif.is_read) {
            try {
                await api.put(`/notifications/${notif.id}/read`)
                setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n))
                setUnreadCount(prev => Math.max(0, prev - 1))
            } catch { }
        }
    }


    const handleMarkAllRead = async () => {
        try {
            await api.put('/notifications/read-all')
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
            setUnreadCount(0)
        } catch { }
    }

    const timeAgo = (date?: string | null) => {
        if (!date) return ''
        const diff = Date.now() - new Date(date).getTime()
        const m = Math.floor(diff / 60000)
        if (m < 1) return 'Vừa xong'
        if (m < 60) return `${m} phút trước`
        const h = Math.floor(m / 60)
        if (h < 24) return `${h} giờ trước`
        return `${Math.floor(h / 24)} ngày trước`
    }

    const handleLogout = () => { logout(); navigate('/login') }
    const getInitials = (name: string) => {
        if (!name) return '?'
        const parts = name.trim().split(' ')
        return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase()
    }
    const getDashboardLink = () => {
        if (!user) return '/login'
        if (user.role === 'admin') return '/admin'
        if (user.role === 'owner') return '/owner/dashboard'
        return '/dashboard'
    }

    if (!user) return null

    return (
        <nav className={`${styles.navbar} ${scrolled ? styles.scrolled : ''}`}>
            <Link to="/" className={styles.logo}>
                <div className={styles.logoIcon}>🏓</div>
                <div className={styles.logoText}>Pickle<span>Ball</span></div>
            </Link>

            <button className={styles.mobileMenuBtn} onClick={() => setMobileOpen(!mobileOpen)}>
                {mobileOpen ? '✕' : '☰'}
            </button>

            <ul className={`${styles.navLinks} ${mobileOpen ? styles.mobileOpen : ''}`}>
                <li>
                    <NavLink to="/" className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
                        onClick={() => setMobileOpen(false)}>
                        🏠 Trang chủ
                    </NavLink>
                </li>
                <li>
                    <NavLink to="/facilities" className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
                        onClick={() => setMobileOpen(false)}>
                        🏟️ Cơ sở
                    </NavLink>
                </li>
                <li>
                    <NavLink to="/matchmaking" className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
                        onClick={() => setMobileOpen(false)}>
                        🎯 Ghép trận
                    </NavLink>
                </li>
                <li>
                    <NavLink to="/chat" className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
                        onClick={() => setMobileOpen(false)}>
                        💬 Chat
                    </NavLink>
                </li>
                {user.role === 'owner' && (
                    <li>
                        <NavLink to="/owner/courts" className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
                            onClick={() => setMobileOpen(false)}>
                            ⚙️ Quản lý sân
                        </NavLink>
                    </li>
                )}
            </ul>

            <div className={styles.navRight}>
                {/* Notification Bell */}
                <div className={styles.notifWrapper} ref={notifRef}>
                    <button className={`${styles.notifBtn} ${notifOpen ? styles.notifBtnActive : ''}`} onClick={handleOpenNotif}>
                        🔔
                        {unreadCount > 0 && (
                            <span className={styles.notifBadge}>{unreadCount > 99 ? '99+' : unreadCount}</span>
                        )}
                    </button>

                    {notifOpen && (
                        <div className={styles.notifPanel}>
                            {/* Panel header */}
                            <div className={styles.notifPanelHeader}>
                                <span className={styles.notifPanelTitle}>
                                    🔔 Thông báo
                                    {unreadCount > 0 && <span className={styles.notifHeaderBadge}>{unreadCount} mới</span>}
                                </span>
                                {unreadCount > 0 && (
                                    <button className={styles.markAllBtn} onClick={handleMarkAllRead}>
                                        ✓ Đọc tất cả
                                    </button>
                                )}
                            </div>

                            {/* List */}
                            <div className={styles.notifList}>
                                {loadingNotif ? (
                                    <div className={styles.notifEmpty}>
                                        <div className={styles.notifSpinner} />
                                        <span>Đang tải...</span>
                                    </div>
                                ) : notifications.length === 0 ? (
                                    <div className={styles.notifEmpty}>
                                        <span style={{ fontSize: '2rem' }}>🔕</span>
                                        <span>Chưa có thông báo nào</span>
                                    </div>
                                ) : notifications.map((n) => (
                                    <div
                                        key={n.id}
                                        className={`${styles.notifItem} ${!n.is_read ? styles.notifUnread : ''}`}
                                        onClick={() => handleMarkRead(n)}
                                    >
                                        <div className={styles.notifIcon}>{n.icon || '🔔'}</div>
                                        <div className={styles.notifContent}>
                                            <div className={styles.notifTitle}>{n.title}</div>
                                            <div className={styles.notifMsg}>{n.message}</div>
                                            <div className={styles.notifTime}>{timeAgo(n.created_at)}</div>
                                        </div>
                                        {!n.is_read && <div className={styles.notifDot} />}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Profile dropdown */}
                <div style={{ position: 'relative' }} ref={dropdownRef}>
                    <button className={styles.profileBtn} onClick={() => { setDropdownOpen(!dropdownOpen); setNotifOpen(false) }}>
                        <div className="avatar avatar-sm">{getInitials(user.full_name)}</div>
                        <div>
                            <div className={styles.profileName}>{user.full_name}</div>
                            <div className={styles.profileRole}>{user.role}</div>
                        </div>
                    </button>

                    {dropdownOpen && (
                        <div className={styles.dropdown}>
                            <Link to={getDashboardLink()} className={styles.dropdownItem} onClick={() => setDropdownOpen(false)}>
                                📊 Dashboard
                            </Link>
                            <Link to="/settings" className={styles.dropdownItem} onClick={() => setDropdownOpen(false)}>
                                ⚙️ Cài đặt
                            </Link>
                            <div className={styles.dropdownDivider} />
                            <button className={`${styles.dropdownItem} ${styles.logoutItem}`} onClick={handleLogout}>
                                🚪 Đăng xuất
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </nav>
    )
}
