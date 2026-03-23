import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import styles from '../styles/AdminLayout.module.css'

const navItems = [
    { label: 'Tổng quan', icon: '📊', path: '/admin', end: true },
    { label: 'Người dùng', icon: '👥', path: '/admin/users' },
    { label: 'Thống kê', icon: '📈', path: '/admin/stats' },
    { label: 'Báo cáo', icon: '📋', path: '/admin/reports' },
    { label: 'Thông báo', icon: '📢', path: '/admin/notifications' },
    { label: 'Chat', icon: '💬', path: '/admin/chat' },
]

export default function AdminLayout() {
    const { user, logout } = useAuth()
    const navigate = useNavigate()
    const [mobileOpen, setMobileOpen] = useState(false)
    const [collapsed, setCollapsed] = useState(false)

    const handleLogout = () => {
        logout()
        navigate('/login')
    }

    const getInitials = (name?: string) => {
        if (!name) return '?'
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    }

    const getPageTitle = () => {
        const path = location.pathname
        const item = navItems.find(n => n.end ? path === n.path : path.startsWith(n.path))
        return item ? `${item.icon} ${item.label}` : '📊 Admin'
    }

    return (
        <div className={styles.adminWrapper}>
            {/* Mobile menu button */}
            <button
                className={styles.mobileMenuBtn}
                onClick={() => setMobileOpen(!mobileOpen)}
            >
                {mobileOpen ? '✕' : '☰'}
            </button>

            {/* Overlay for mobile */}
            {mobileOpen && (
                <div className={styles.overlay} onClick={() => setMobileOpen(false)} />
            )}

            {/* Sidebar */}
            <aside className={`${styles.sidebar} ${mobileOpen ? styles.sidebarOpen : ''} ${collapsed ? styles.sidebarCollapsed : ''}`}>
                {/* Brand */}
                <div className={styles.sidebarHeader}>
                    <div className={styles.sidebarBrand}>
                        <div className={styles.brandIcon}>🏓</div>
                        {!collapsed && (
                            <div>
                                <div className={styles.brandText}>
                                    Pickle<span>Ball</span>
                                </div>
                                <div className={styles.brandSub}>Admin Panel</div>
                            </div>
                        )}
                    </div>
                    <button
                        className={styles.collapseBtn}
                        onClick={() => setCollapsed(!collapsed)}
                        title={collapsed ? 'Mở rộng' : 'Thu gọn'}
                    >
                        ☰
                    </button>
                </div>

                {/* Navigation */}
                <nav className={styles.sidebarNav}>
                    <div className={styles.navSection}>
                        <div className={styles.navSectionLabel}>Menu chính</div>
                        {navItems.map(item => (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                end={item.end}
                                className={({ isActive }) =>
                                    `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
                                }
                                onClick={() => setMobileOpen(false)}
                            >
                                <span className={styles.navIcon}>{item.icon}</span>
                                {!collapsed && item.label}
                            </NavLink>
                        ))}
                    </div>

                    <div className={styles.navSection}>
                        <div className={styles.navSectionLabel}>Hệ thống</div>
                        <NavLink
                            to="/admin/settings"
                            className={({ isActive }) =>
                                `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
                            }
                            onClick={() => setMobileOpen(false)}
                        >
                            <span className={styles.navIcon}>⚙️</span>
                            {!collapsed && 'Cài đặt'}
                        </NavLink>
                    </div>
                </nav>

                {/* User info */}
                <div className={styles.sidebarFooter}>
                    <div className={styles.userCard}>
                        <div className="avatar avatar-sm" style={{ overflow: 'hidden' }}>
                            {user?.avatar ? (
                                <img src={user.avatar} alt={user.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                            ) : getInitials(user?.full_name)}
                        </div>
                        <div className={styles.userInfo}>
                            <div className={styles.userName}>{user?.full_name}</div>
                            <div className={styles.userRole}>Admin</div>
                        </div>
                        <button className={styles.logoutBtn} onClick={handleLogout} title="Đăng xuất">
                            🚪
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main content */}
            <main className={`${styles.mainContent} ${collapsed ? styles.mainContentCollapsed : ''}`}>
                <div className={styles.topBar}>
                    <h1 className={styles.topBarTitle}>{getPageTitle()}</h1>
                    <div className={styles.topBarActions}>
                        <span className="badge badge-green">Admin</span>
                    </div>
                </div>
                <div className={styles.contentArea}>
                    <Outlet />
                </div>
            </main>
        </div>
    )
}
