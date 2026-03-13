import { useState, useEffect } from 'react'
import api from '../api/axios'
import styles from '../styles/Dashboard.module.css'

export default function OwnerDashboard() {
    const [stats, setStats] = useState(null)
    const [bookings, setBookings] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const loadData = async () => {
            try {
                const [statsRes, bookingsRes] = await Promise.all([
                    api.get('/stats/owner'),
                    api.get('/bookings/owner')
                ])
                setStats(statsRes.data)
                setBookings(bookingsRes.data)
            } catch (err) {
                console.error('Failed to load owner dashboard:', err)
            } finally {
                setLoading(false)
            }
        }
        loadData()
    }, [])

    const formatPrice = (p) => new Intl.NumberFormat('vi-VN').format(p) + 'đ'
    const formatDate = (d) => new Date(d).toLocaleDateString('vi-VN')
    const isReceivedStatus = (status) => status === 'confirmed' || status === 'completed'
    const getNetReceived = (booking) => {
        const total = Number(booking?.total_price || 0)
        const commission = Number(booking?.commission_amount || 0)
        return Math.max(total - commission, 0)
    }

    if (loading) return <div className={styles.dashboardPage} style={{ textAlign: 'center', padding: '60px 20px' }}>⏳ Đang tải...</div>

    const statCards = [
        { icon: '📋', iconClass: styles.statIconGreen, value: stats?.total_bookings || 0, label: 'Tổng lượt booking' },
        { icon: '💰', iconClass: styles.statIconYellow, value: formatPrice(stats?.revenue || 0), label: 'Doanh thu' },
        { icon: '📊', iconClass: styles.statIconBlue, value: (stats?.occupancy || 0) + '%', label: 'Tỷ lệ lấp đầy' },
        { icon: '🎯', iconClass: styles.statIconPurple, value: stats?.match_count || 0, label: 'Trận được ghép' }
    ]

    const statusLabels = { pending: 'Chờ xác nhận', confirmed: 'Đã xác nhận', completed: 'Hoàn thành', cancelled: 'Đã hủy' }

    return (
        <div className={styles.dashboardPage}>
            <h1 className="page-title" style={{ marginBottom: '8px' }}>🏟️ Dashboard Owner</h1>
            <p className="page-subtitle" style={{ marginBottom: '28px' }}>Quản lý sân và theo dõi doanh thu</p>

            {/* Stats */}
            <div className={styles.statsGrid}>
                {statCards.map((s, i) => (
                    <div key={i} className={styles.statCard} style={{ animationDelay: `${i * 0.1}s` }}>
                        <div className={`${styles.statIcon} ${s.iconClass}`}>{s.icon}</div>
                        <div className={styles.statValue}>{s.value}</div>
                        <div className={styles.statLabel}>{s.label}</div>
                    </div>
                ))}
            </div>

            <div className={styles.contentGrid}>
                {/* Revenue Chart */}
                <div className="glass-card">
                    <h3 className={styles.sectionTitle}>📈 Doanh thu</h3>
                    <div className={styles.chartPlaceholder}>
                        💰 Tổng doanh thu: {formatPrice(stats?.revenue || 0)}<br />
                        📋 {stats?.total_bookings || 0} booking • 🏟️ {stats?.court_count || 0} sân
                    </div>
                </div>

                {/* Court Occupancy */}
                <div className="glass-card">
                    <h3 className={styles.sectionTitle}>⏰ Tỷ lệ lấp đầy</h3>
                    <div className={styles.chartPlaceholder}>
                        📊 {stats?.occupancy || 0}% lấp đầy<br />
                        🎯 {stats?.match_count || 0} trận ghép
                    </div>
                </div>

                {/* Recent Bookings */}
                <div className={`glass-card ${styles.contentFullWidth}`}>
                    <h3 className={styles.sectionTitle}>📋 Booking gần đây</h3>
                    {bookings.length > 0 ? (
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Khách hàng</th>
                                    <th>Sân</th>
                                    <th>Ngày</th>
                                    <th>Giờ</th>
                                    <th>Thực nhận</th>
                                    <th>Trạng thái</th>
                                </tr>
                            </thead>
                            <tbody>
                                {bookings.slice(0, 10).map((b, i) => (
                                    <tr key={i}>
                                        <td style={{ fontWeight: 600 }}>{b.user_name}</td>
                                        <td>{b.court_name}</td>
                                        <td>{formatDate(b.booking_date)}</td>
                                        <td>{b.start_time} - {b.end_time}</td>
                                        <td style={{ color: isReceivedStatus(b.status) ? 'var(--accent-green)' : 'var(--text-muted)', fontWeight: 600 }}>
                                            {isReceivedStatus(b.status) ? formatPrice(getNetReceived(b)) : '—'}
                                        </td>
                                        <td>
                                            <span className={`badge ${b.status === 'confirmed' ? 'badge-green' : b.status === 'completed' ? 'badge-blue' : 'badge-yellow'}`}>
                                                {statusLabels[b.status] || b.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Chưa có booking nào</p>
                    )}
                </div>
            </div>
        </div>
    )
}
