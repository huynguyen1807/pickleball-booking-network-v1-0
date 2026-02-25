import { useState, useEffect } from 'react'
import api from '../api/axios'
import styles from '../styles/Dashboard.module.css'

export default function UserDashboard() {
    const [stats, setStats] = useState(null)
    const [bookings, setBookings] = useState([])
    const [payments, setPayments] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const loadData = async () => {
            try {
                const [statsRes, bookingsRes, paymentsRes] = await Promise.all([
                    api.get('/stats/user'),
                    api.get('/bookings/my'),
                    api.get('/payments/history')
                ])
                setStats(statsRes.data)
                setBookings(bookingsRes.data)
                setPayments(paymentsRes.data)
            } catch (err) {
                console.error('Failed to load dashboard:', err)
            } finally {
                setLoading(false)
            }
        }
        loadData()
    }, [])

    const formatPrice = (p) => new Intl.NumberFormat('vi-VN').format(p) + 'đ'
    const formatDate = (d) => new Date(d).toLocaleDateString('vi-VN')

    if (loading) return <div className={styles.dashboardPage} style={{ textAlign: 'center', padding: '60px 20px' }}>⏳ Đang tải...</div>

    const statCards = [
        { icon: '🏓', iconClass: styles.statIconGreen, value: stats?.matches_count || 0, label: 'Trận đã tham gia' },
        { icon: '🏟️', iconClass: styles.statIconBlue, value: stats?.bookings_count || 0, label: 'Lượt đặt sân' },
        { icon: '💰', iconClass: styles.statIconYellow, value: formatPrice(stats?.total_spent || 0), label: 'Tổng chi tiêu' },
        { icon: '⭐', iconClass: styles.statIconPurple, value: stats?.avg_rating || '0.0', label: 'Đánh giá trung bình' }
    ]

    const statusLabels = { pending: 'Chờ xác nhận', confirmed: 'Đã xác nhận', completed: 'Hoàn thành', cancelled: 'Đã hủy' }
    const statusColors = { pending: 'yellow', confirmed: 'green', completed: 'blue', cancelled: 'red' }

    return (
        <div className={styles.dashboardPage}>
            <h1 className="page-title" style={{ marginBottom: '8px' }}>📊 Dashboard</h1>
            <p className="page-subtitle" style={{ marginBottom: '28px' }}>Thống kê hoạt động của bạn</p>

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
                {/* Recent Bookings */}
                <div className="glass-card">
                    <h3 className={styles.sectionTitle}>🏟️ Booking gần đây</h3>
                    {bookings.length > 0 ? (
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Sân</th>
                                    <th>Ngày</th>
                                    <th>Giờ</th>
                                    <th>Trạng thái</th>
                                </tr>
                            </thead>
                            <tbody>
                                {bookings.slice(0, 5).map((b, i) => (
                                    <tr key={i}>
                                        <td style={{ fontWeight: 600 }}>{b.court_name}</td>
                                        <td>{formatDate(b.booking_date)}</td>
                                        <td>{b.start_time} - {b.end_time}</td>
                                        <td><span className={`badge badge-${statusColors[b.status] || 'yellow'}`}>{statusLabels[b.status]}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Chưa có booking nào</p>
                    )}
                </div>

                {/* Chart placeholder */}
                <div className="glass-card">
                    <h3 className={styles.sectionTitle}>📈 Hoạt động gần đây</h3>
                    <div className={styles.chartPlaceholder}>
                        📊 {stats?.matches_count || 0} trận • {stats?.bookings_count || 0} booking
                    </div>
                </div>

                {/* Payment History */}
                <div className={`glass-card ${styles.contentFullWidth}`}>
                    <h3 className={styles.sectionTitle}>💰 Lịch sử thanh toán</h3>
                    {payments.length > 0 ? payments.slice(0, 5).map((h, i) => (
                        <div key={i} className={styles.historyItem}>
                            <div className={styles.historyInfo}>
                                <div className={styles.historyTitle}>{h.court_name || 'Thanh toán'}</div>
                                <div className={styles.historyMeta}>{formatDate(h.created_at)}</div>
                            </div>
                            <div className={styles.historyAmount}>-{formatPrice(h.amount)}</div>
                        </div>
                    )) : (
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Chưa có thanh toán nào</p>
                    )}
                </div>
            </div>
        </div>
    )
}
