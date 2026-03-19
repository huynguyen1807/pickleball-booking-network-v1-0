import { useState, useEffect } from 'react'
import api from '../api/axios'
import styles from '../styles/Dashboard.module.css'

export default function AdminStats() {
    const [stats, setStats] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadStats()
    }, [])

    const loadStats = async () => {
        try {
            const res = await api.get('/stats/admin')
            setStats(res.data)
        } catch (err) {
            console.error('Failed to load stats:', err)
        } finally {
            setLoading(false)
        }
    }

    const formatPrice = (p: number) => new Intl.NumberFormat('vi-VN').format(p) + 'đ'

    if (loading) {
        return <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>⏳ Đang tải...</div>
    }

    const statCards = [
        { icon: '💰', iconClass: styles.statIconGreen, value: formatPrice(stats?.total_revenue || 0), label: 'Tổng hoa hồng', desc: 'Tổng doanh thu nền tảng' },
        { icon: '👥', iconClass: styles.statIconBlue, value: stats?.total_users || 0, label: 'Tổng người dùng', desc: 'Tài khoản đã đăng ký' },
        { icon: '🏟️', iconClass: styles.statIconYellow, value: stats?.total_courts || 0, label: 'Tổng sân', desc: 'Sân đã được tạo' },
        { icon: '🎯', iconClass: styles.statIconPurple, value: stats?.today_matches || 0, label: 'Trận hôm nay', desc: 'Trận đấu trong ngày' },
        { icon: '📅', iconClass: styles.statIconGreen, value: stats?.today_bookings || 0, label: 'Booking hôm nay', desc: 'Đặt sân trong ngày' },
        { icon: '📋', iconClass: styles.statIconRed, value: stats?.pending_requests || 0, label: 'Yêu cầu chờ duyệt', desc: 'Yêu cầu nâng cấp Owner' },
    ]

    return (
        <div>
            <h2 className="page-title" style={{ marginBottom: '8px' }}>📈 Thống kê hệ thống</h2>
            <p className="page-subtitle" style={{ marginBottom: '28px' }}>Dữ liệu tổng quan nền tảng PickleBall Đà Nẵng</p>

            {/* Stat Cards */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '16px',
                marginBottom: '32px'
            }}>
                {statCards.map((s, i) => (
                    <div key={i} className={styles.statCard} style={{ animationDelay: `${i * 0.08}s` }}>
                        <div className={`${styles.statIcon} ${s.iconClass}`}>{s.icon}</div>
                        <div className={styles.statValue}>{s.value}</div>
                        <div className={styles.statLabel}>{s.label}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>{s.desc}</div>
                    </div>
                ))}
            </div>

            {/* System Overview cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="glass-card">
                    <h3 className={styles.sectionTitle}>📊 Tổng quan hôm nay</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        {[
                            { label: 'Booking hôm nay', value: stats?.today_bookings || 0 },
                            { label: 'Trận ghép hôm nay', value: stats?.today_matches || 0 },
                            { label: 'Tổng người dùng', value: stats?.total_users || 0 },
                            { label: 'Tổng sân', value: stats?.total_courts || 0 },
                        ].map((item, idx) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                                <span style={{ fontWeight: 700 }}>{item.value}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="glass-card">
                    <h3 className={styles.sectionTitle}>💰 Doanh thu</h3>
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '24px 0'
                    }}>
                        <div style={{
                            fontSize: '2.2rem',
                            fontWeight: 800,
                            background: 'var(--gradient-hero)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            marginBottom: '8px'
                        }}>
                            {formatPrice(stats?.total_revenue || 0)}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            Tổng hoa hồng nền tảng
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
