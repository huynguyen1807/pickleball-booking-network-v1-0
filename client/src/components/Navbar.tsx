import { useState, useEffect, useRef } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'
import { io } from 'socket.io-client'
import NotificationDropdown from './NotificationDropdown'
import styles from '../styles/Navbar.module.css'

const socket = io('http://localhost:5000')

export default function Navbar() {
    const { user, logout } = useAuth()
    const navigate = useNavigate()
    const [scrolled, setScrolled] = useState(false)
    const [dropdownOpen, setDropdownOpen] = useState(false)
    const [mobileOpen, setMobileOpen] = useState(false)
    const [unreadCount, setUnreadCount] = useState(0)
    const [chatUnread, setChatUnread] = useState(0)
    const dropdownRef = useRef(null)

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20)
        window.addEventListener('scroll', handleScroll)
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    useEffect(() => {
        const handleClick = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setDropdownOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [])

    useEffect(() => {
        if (!user) return
        const loadNotifications = async () => {
            try {
                const res = await api.get('/notifications')
                const unread = res.data.filter(n => !n.is_read).length
                setUnreadCount(unread)
            } catch {
                // silently fail
            }
        }
        loadNotifications()
        const interval = setInterval(loadNotifications, 30000) // refresh every 30s
        return () => clearInterval(interval)
    }, [user])

    useEffect(() => {
        if (!user) return

        // Register online
        socket.emit('user_online', user.id)
        socket.emit('join_notifications', user.id)

        // Load chat unread
        const loadChatUnread = async () => {
            try {
                const res = await api.get('/chat/unread-count')
                setChatUnread(res.data.count)
            } catch { }
        }
        loadChatUnread()

        // Listen for DM notifications
        const handleDM = () => {
            loadChatUnread()
        }
        socket.on('dm_notification', handleDM)

        const chatInterval = setInterval(loadChatUnread, 30000)
        return () => {
            socket.off('dm_notification', handleDM)
            clearInterval(chatInterval)
        }
    }, [user])

    const handleLogout = () => {
        logout()
        navigate('/login')
    }

    const getInitials = (name) => {
        if (!name) return '?'
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
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
                <div className={styles.logoText}>
                    Pickle<span>Ball</span>
                </div>
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
                        {chatUnread > 0 && <span className={styles.chatBadge}>{chatUnread}</span>}
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
                <NotificationDropdown />

                <div style={{ position: 'relative' }} ref={dropdownRef}>
                    <button className={styles.profileBtn} onClick={() => setDropdownOpen(!dropdownOpen)}>
                        <div className="avatar avatar-sm">{getInitials(user.full_name)}</div> 
                        <div className={styles.profileMeta}>    
                        <div className={styles.profileName}>{user.full_name}</div>       
                        <div className={styles.profileRole}>{user.role}</div>       
                        </div>                   
                        </button>

                    

                    {dropdownOpen && (
                        <div className={styles.dropdown}>
                            <Link to={getDashboardLink()} className={styles.dropdownItem}
                                onClick={() => setDropdownOpen(false)}>
                                📊 Dashboard
                            </Link>
                            <Link to="/settings" className={styles.dropdownItem}
                                onClick={() => setDropdownOpen(false)}>
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
