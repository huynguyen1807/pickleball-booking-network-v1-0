import { useState, useEffect } from 'react'
import api from '../api/axios'
import styles from '../styles/Dashboard.module.css'

export default function AdminReports() {
    const [stats, setStats] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        try {
            const res = await api.get('/stats/admin')
            setStats(res.data)
        } catch (err) {
            console.error('Failed to load report data:', err)
        } finally {
            setLoading(false)
        }
    }

    const formatPrice = (p: number) => new Intl.NumberFormat('vi-VN').format(p) + 'đ'

    if (loading) {
        return <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>⏳ Đang tải...</div>
    }

    const reportItems = [
        {
            icon: '👥',
            title: 'Báo cáo người dùng',
            desc: `Tổng ${stats?.total_users || 0} người dùng đã đăng ký trên hệ thống.`,
            color: 'var(--accent-blue)',
            bg: 'var(--accent-blue-dim)'
        },
        {
            icon: '🏟️',
            title: 'Báo cáo cơ sở & sân',
            desc: `Tổng ${stats?.total_courts || 0} sân đang hoạt động.`,
            color: 'var(--accent-yellow)',
            bg: 'var(--accent-yellow-dim)'
        },
        {
            icon: '💰',
            title: 'Báo cáo doanh thu',
            desc: `Tổng hoa hồng: ${formatPrice(stats?.total_revenue || 0)}.`,
            color: 'var(--accent-green)',
            bg: 'var(--accent-green-dim)'
        },
        {
            icon: '🎯',
            title: 'Báo cáo trận đấu',
            desc: `${stats?.today_matches || 0} trận đấu hôm nay, ${stats?.today_bookings || 0} booking.`,
            color: 'var(--accent-purple)',
            bg: 'var(--accent-purple-dim)'
        },
        {
            icon: '📋',
            title: 'Yêu cầu chờ xử lý',
            desc: `${stats?.pending_requests || 0} yêu cầu nâng cấp Owner đang chờ duyệt.`,
            color: 'var(--accent-red)',
            bg: 'var(--accent-red-dim)'
        },
    ]

    return (
        <div>
            <h2 className="page-title" style={{ marginBottom: '8px' }}>📋 Báo cáo hệ thống</h2>
            <p className="page-subtitle" style={{ marginBottom: '28px' }}>Tổng hợp báo cáo nền tảng PickleBall Đà Nẵng</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {reportItems.map((item, idx) => (
                    <div
                        key={idx}
                        className="glass-card"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '20px',
                            animation: `fadeInUp 0.4s ease ${idx * 0.08}s both`
                        }}
                    >
                        <div style={{
                            width: '56px',
                            height: '56px',
                            borderRadius: 'var(--radius-md)',
                            background: item.bg,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.6rem',
                            flexShrink: 0
                        }}>
                            {item.icon}
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '4px' }}>
                                {item.title}
                            </div>
                            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                {item.desc}
                            </div>
                        </div>
                        <div style={{
                            padding: '6px 14px',
                            borderRadius: 'var(--radius-full)',
                            background: item.bg,
                            color: item.color,
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            flexShrink: 0
                        }}>
                            Xem chi tiết →
                        </div>
                    </div>
                ))}
            </div>

            {/* Summary */}
            <div className="glass-card" style={{ marginTop: '24px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                    📌 Báo cáo được cập nhật realtime từ hệ thống
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Liên hệ đội ngũ phát triển để thêm báo cáo chi tiết
                </div>
            </div>
        </div>
    )
}
