import { useState, useEffect } from 'react'
import api from '../api/axios'
import styles from '../styles/Dashboard.module.css'

export default function AdminDashboard() {
    const [requestTab, setRequestTab] = useState('pending')
    const [stats, setStats] = useState(null)
    const [requests, setRequests] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        try {
            const [statsRes, requestsRes] = await Promise.all([
                api.get('/stats/admin'),
                api.get('/admin/upgrade-requests')
            ])
            setStats(statsRes.data)
            setRequests(requestsRes.data)
        } catch (err) {
            console.error('Failed to load admin data:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleApprove = async (reqId) => {
        try {
            await api.put(`/admin/upgrade-requests/${reqId}/approve`)
            loadData()
        } catch (err) {
            alert(err.response?.data?.message || 'Lỗi duyệt')
        }
    }

    const handleReject = async (reqId) => {
        const note = prompt('Lý do từ chối (tùy chọn):')
        try {
            await api.put(`/admin/upgrade-requests/${reqId}/reject`, { admin_note: note })
            loadData()
        } catch (err) {
            alert(err.response?.data?.message || 'Lỗi từ chối')
        }
    }

    const formatPrice = (p) => new Intl.NumberFormat('vi-VN').format(p) + 'đ'
    const formatDate = (d) => new Date(d).toLocaleDateString('vi-VN')

    if (loading) return <div className={styles.dashboardPage} style={{ textAlign: 'center', padding: '60px 20px' }}>⏳ Đang tải...</div>

    const statCards = [
        { icon: '💰', iconClass: styles.statIconGreen, value: formatPrice(stats?.total_revenue || 0), label: 'Tổng hoa hồng' },
        { icon: '👥', iconClass: styles.statIconBlue, value: stats?.total_users || 0, label: 'Tổng người dùng' },
        { icon: '🏟️', iconClass: styles.statIconYellow, value: stats?.total_courts || 0, label: 'Tổng số sân' },
        { icon: '🎯', iconClass: styles.statIconPurple, value: stats?.today_matches || 0, label: 'Trận hôm nay' },
        { icon: '📋', iconClass: styles.statIconRed || styles.statIconPurple, value: stats?.pending_requests || 0, label: 'Yêu cầu chờ duyệt' }
    ]

    const filteredRequests = requests.filter(r => r.status === requestTab)

    return (
        <div className={styles.dashboardPage}>
            <h1 className="page-title" style={{ marginBottom: '8px' }}>⚡ Admin Dashboard</h1>
            <p className="page-subtitle" style={{ marginBottom: '28px' }}>Quản trị hệ thống PickleBall Đà Nẵng</p>

            {/* Stats */}
            <div className={styles.statsGrid} style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
                {statCards.map((s, i) => (
                    <div key={i} className={styles.statCard} style={{ animationDelay: `${i * 0.1}s` }}>
                        <div className={`${styles.statIcon} ${s.iconClass}`}>{s.icon}</div>
                        <div className={styles.statValue}>{s.value}</div>
                        <div className={styles.statLabel}>{s.label}</div>
                    </div>
                ))}
            </div>

            <div className={styles.contentGrid}>
                {/* Owner Requests */}
                <div className={`glass-card ${styles.contentFullWidth}`}>
                    <h3 className={styles.sectionTitle}>📋 Yêu cầu Owner</h3>

                    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                        {[
                            { key: 'pending', label: `⏳ Chờ duyệt (${requests.filter(r => r.status === 'pending').length})` },
                            { key: 'approved', label: `✅ Đã duyệt (${requests.filter(r => r.status === 'approved').length})` },
                            { key: 'rejected', label: `❌ Từ chối (${requests.filter(r => r.status === 'rejected').length})` }
                        ].map(t => (
                            <button key={t.key}
                                className={`btn ${requestTab === t.key ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                                onClick={() => setRequestTab(t.key)}>
                                {t.label}
                            </button>
                        ))}
                    </div>

                    {filteredRequests.length > 0 ? filteredRequests.map(req => (
                        <div key={req.id} className={styles.requestCard}>
                            <div className="avatar">{req.full_name?.charAt(0) || '?'}</div>
                            <div className={styles.requestInfo}>
                                <div className={styles.requestName}>{req.full_name}</div>
                                <div className={styles.requestEmail}>{req.email}</div>
                                <div className={styles.requestDate}>📅 {formatDate(req.created_at)} — {req.reason || 'Không có lý do'}</div>
                            </div>
                            {requestTab === 'pending' && (
                                <div className={styles.requestActions}>
                                    <button className="btn btn-primary btn-sm" onClick={() => handleApprove(req.id)}>
                                        ✅ Duyệt
                                    </button>
                                    <button className="btn btn-danger btn-sm" onClick={() => handleReject(req.id)}>
                                        ❌ Từ chối
                                    </button>
                                </div>
                            )}
                            {requestTab === 'approved' && (
                                <span className="badge badge-green">Đã duyệt</span>
                            )}
                            {requestTab === 'rejected' && (
                                <span className="badge badge-red">Đã từ chối</span>
                            )}
                        </div>
                    )) : (
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', padding: '20px 0', textAlign: 'center' }}>
                            Không có yêu cầu nào
                        </p>
                    )}
                </div>

                {/* Platform Activity */}
                <div className="glass-card">
                    <h3 className={styles.sectionTitle}>📈 Tổng quan hệ thống</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Booking hôm nay</span>
                            <span style={{ fontWeight: 700 }}>{stats?.today_bookings || 0}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Trận ghép hôm nay</span>
                            <span style={{ fontWeight: 700 }}>{stats?.today_matches || 0}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Tổng người dùng</span>
                            <span style={{ fontWeight: 700 }}>{stats?.total_users || 0}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Tổng hoa hồng</span>
                            <span style={{ fontWeight: 700, color: 'var(--accent-green)' }}>{formatPrice(stats?.total_revenue || 0)}</span>
                        </div>
                    </div>
                </div>

                {/* Revenue Chart */}
                <div className="glass-card">
                    <h3 className={styles.sectionTitle}>🔥 Thống kê nền tảng</h3>
                    <div className={styles.chartPlaceholder}>
                        📊 {stats?.total_users || 0} người dùng • {stats?.total_courts || 0} sân<br />
                        🎯 {stats?.today_matches || 0} trận hôm nay • 📋 {stats?.today_bookings || 0} booking
                    </div>
                </div>
            </div>
        </div>
    )
}
