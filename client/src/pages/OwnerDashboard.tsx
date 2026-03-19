import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'
import styles from '../styles/Dashboard.module.css'
import { formatDateVN, formatDateTimeVN, formatTimeHHmm } from '../utils/dateTime'

type ActiveTab = 'bookings' | 'payments' | 'matches' | 'owner'

const BOOKING_STATUS: Record<string, { label: string; color: string }> = {
    pending: { label: 'Chờ xác nhận', color: '#f59e0b' },
    confirmed: { label: 'Đã xác nhận', color: '#10b981' },
    completed: { label: 'Hoàn thành', color: '#3b82f6' },
    cancelled: { label: 'Đã hủy', color: '#ef4444' },
}

const PAYMENT_STATUS: Record<string, { label: string; bg: string; color: string }> = {
    pending: { label: 'Chờ thanh toán', bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
    completed: { label: 'Thành công', bg: 'rgba(16,185,129,0.15)', color: '#10b981' },
    failed: { label: 'Thất bại', bg: 'rgba(239,68,68,0.15)', color: '#ef4444' },
    cancelled: { label: 'Đã hủy', bg: 'rgba(107,114,128,0.15)', color: '#9ca3af' },
    expired: { label: 'Hết hạn', bg: 'rgba(249,115,22,0.15)', color: '#f97316' },
    refunded: { label: 'Hoàn tiền', bg: 'rgba(139,92,246,0.15)', color: '#8b5cf6' },
}

const MATCH_STATUS: Record<string, { label: string; bg: string; color: string }> = {
    waiting: { label: 'Đang tìm người', bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
    open: { label: 'Đang mở', bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
    full: { label: 'Đã đủ người', bg: 'rgba(59,130,246,0.15)', color: '#60a5fa' },
    confirmed: { label: 'Đã xác nhận', bg: 'rgba(16,185,129,0.15)', color: '#10b981' },
    completed: { label: 'Hoàn thành', bg: 'rgba(34,197,94,0.15)', color: '#22c55e' },
    finished: { label: 'Hoàn thành', bg: 'rgba(34,197,94,0.15)', color: '#22c55e' },
    cancelled: { label: 'Đã hủy', bg: 'rgba(239,68,68,0.15)', color: '#ef4444' }
}

const METHOD_ICON: Record<string, string> = { payos: '💳', mock: '🧪', cash: '💵' }
const PAGE_SIZE = 8
const VISIBLE_PAYMENT_STATUSES = ['completed', 'cancelled', 'expired', 'pending']

function StatusBadge({ status, map }: { status: string; map: Record<string, { label: string; bg: string; color: string }> }) {
    const cfg = map[status] || { label: status, bg: 'rgba(156,163,175,0.15)', color: '#9ca3af' }
    return (
        <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: '0.75rem', fontWeight: 600, background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap' }}>
            {cfg.label}
        </span>
    )
}

export default function OwnerDashboard() {
    const navigate = useNavigate()
    const [ownerStats, setOwnerStats] = useState<any>(null)
    const [ownerBookings, setOwnerBookings] = useState<any[]>([])
    const [userStats, setUserStats] = useState<any>(null)
    const [myBookings, setMyBookings] = useState<any[]>([])
    const [payments, setPayments] = useState<any[]>([])
    const [matchHistory, setMatchHistory] = useState<any[]>([])
    const [walletBalance, setWalletBalance] = useState<number>(0)
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<ActiveTab>('bookings')
    const [showAllBookings, setShowAllBookings] = useState(false)
    const [showAllPayments, setShowAllPayments] = useState(false)
    const [showAllMatches, setShowAllMatches] = useState(false)
    const [showAllOwnerBookings, setShowAllOwnerBookings] = useState(false)
    const [redirectingPaymentId, setRedirectingPaymentId] = useState<number | null>(null)

    useEffect(() => {
        const loadData = async () => {
            const [ownerStatsRes, ownerBookingsRes, userStatsRes, myBookingsRes, paymentsRes, matchesRes, balanceRes] = await Promise.allSettled([
                    api.get('/stats/owner'),
                    api.get('/bookings/owner'),
                    api.get('/stats/user'),
                    api.get('/bookings/my'),
                    api.get('/payments/history'),
                    api.get('/matches/my-history'),
                    api.get('/users/me/balance')
            ])

            if (ownerStatsRes.status === 'fulfilled') setOwnerStats(ownerStatsRes.value.data)
            else console.warn('Owner stats failed:', (ownerStatsRes as PromiseRejectedResult).reason)
            if (ownerBookingsRes.status === 'fulfilled') setOwnerBookings(ownerBookingsRes.value.data)
            else console.warn('Owner bookings failed:', (ownerBookingsRes as PromiseRejectedResult).reason)
            if (userStatsRes.status === 'fulfilled') setUserStats(userStatsRes.value.data)
            else console.warn('User stats failed:', (userStatsRes as PromiseRejectedResult).reason)
            if (myBookingsRes.status === 'fulfilled') setMyBookings(myBookingsRes.value.data)
            else console.warn('My bookings failed:', (myBookingsRes as PromiseRejectedResult).reason)
            if (paymentsRes.status === 'fulfilled') setPayments(paymentsRes.value.data)
            else console.warn('Payments failed:', (paymentsRes as PromiseRejectedResult).reason)
            if (matchesRes.status === 'fulfilled') setMatchHistory(matchesRes.value.data)
            else console.warn('Match history failed:', (matchesRes as PromiseRejectedResult).reason)
            if (balanceRes.status === 'fulfilled') setWalletBalance(Number(balanceRes.value.data?.balance || 0))
            else console.warn('Balance failed:', (balanceRes as PromiseRejectedResult).reason)

            setLoading(false)
        }
        loadData()
    }, [])

    const handlePayNow = async (payment: any) => {
        if (redirectingPaymentId) return

        const parts = String(payment.transaction_id || '').split('_')
        const paymentLinkId = parts.length >= 3 ? parts.slice(2).join('_') : ''

        if (!paymentLinkId) {
            alert('Không tìm thấy thông tin link thanh toán cho giao dịch này')
            return
        }

        try {
            setRedirectingPaymentId(payment.id)
            const res = await api.get(`/payments/payos-info/${paymentLinkId}`)
            const checkoutUrl =
                res.data?.checkoutUrl ||
                res.data?.data?.checkoutUrl ||
                res.data?.data?.data?.checkoutUrl ||
                `https://pay.payos.vn/web/${paymentLinkId}`

            if (!checkoutUrl) throw new Error('Missing checkout URL')
            window.location.href = checkoutUrl
        } catch (err: any) {
            console.error('Failed to redirect payment:', err)
            alert(err?.response?.data?.message || 'Không thể chuyển đến trang thanh toán')
            setRedirectingPaymentId(null)
        }
    }

    const formatPrice = (p) => new Intl.NumberFormat('vi-VN').format(Number(p) || 0) + 'đ'
    const formatDate = (d) => formatDateVN(d)
    const formatDateTime = (d) => formatDateTimeVN(d)
    const formatTime = (t) => formatTimeHHmm(t)
    const isReceivedStatus = (status) => status === 'confirmed' || status === 'completed'
    const getNetReceived = (booking) => {
        const total = Number(booking?.total_price || 0)
        const commission = Number(booking?.commission_amount || 0)
        return Math.max(total - commission, 0)
    }

    if (loading) return <div className={styles.dashboardPage} style={{ textAlign: 'center', padding: '60px 20px' }}>⏳ Đang tải...</div>

    const confirmedBookings = myBookings.filter(b => b.status === 'confirmed')
    const visiblePaymentHistory = payments.filter(p => VISIBLE_PAYMENT_STATUSES.includes(p.status))
    const completedPayments = visiblePaymentHistory.filter(p => p.status === 'completed').length
    const createdMatches = matchHistory.filter(m => !!m.is_host)
    const joinedMatches = matchHistory.filter(m => !m.is_host && (m.is_joined || m.is_waitlisted))
    const completedMatches = matchHistory.filter(m => ['completed', 'finished'].includes(String(m.status || '').toLowerCase()))
    const cancelledHostMatches = matchHistory.filter(m => !!m.is_host && String(m.status || '').toLowerCase() === 'cancelled')

    const statCards = [
        { icon: '🏟️', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', value: confirmedBookings.length, label: 'Lần đặt sân' },
        { icon: '🏓', color: '#10b981', bg: 'rgba(16,185,129,0.12)', value: userStats?.matches_count ?? matchHistory.length, label: 'Tổng trận của bạn' },
        { icon: '💰', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', value: formatPrice(userStats?.total_spent ?? 0), label: 'Tổng chi tiêu' },
        { icon: '✅', color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)', value: completedPayments, label: 'GD thành công' },
        { icon: '👛', color: '#10b981', bg: 'rgba(16,185,129,0.12)', value: formatPrice(walletBalance), label: 'Số dư ví' },
    ]

    const ownerStatCards = [
        { icon: '📋', iconClass: styles.statIconGreen, value: ownerStats?.total_bookings || 0, label: 'Tổng lượt booking' },
        { icon: '💰', iconClass: styles.statIconYellow, value: formatPrice(ownerStats?.revenue || 0), label: 'Doanh thu' },
        { icon: '📊', iconClass: styles.statIconBlue, value: (ownerStats?.occupancy || 0) + '%', label: 'Tỷ lệ lấp đầy' },
        { icon: '🎯', iconClass: styles.statIconPurple, value: ownerStats?.match_count || 0, label: 'Trận được ghép' }
    ]

    const statusLabels = { pending: 'Chờ xác nhận', confirmed: 'Đã xác nhận', completed: 'Hoàn thành', cancelled: 'Đã hủy' }
    const visibleBookings = showAllBookings ? confirmedBookings : confirmedBookings.slice(0, PAGE_SIZE)
    const visiblePayments = showAllPayments ? visiblePaymentHistory : visiblePaymentHistory.slice(0, PAGE_SIZE)
    const visibleMatches = showAllMatches ? matchHistory : matchHistory.slice(0, PAGE_SIZE)
    const ownerVisibleBookings = showAllOwnerBookings ? ownerBookings : ownerBookings.slice(0, PAGE_SIZE)
    const pendingBookings = ownerBookings.filter(b => b.status === 'pending')
    const receivedBookings = ownerBookings.filter(b => isReceivedStatus(b.status))
    const netRevenue = receivedBookings.reduce((sum, b) => sum + getNetReceived(b), 0)

    return (
        <div className={styles.dashboardPage}>
            <div className={styles.dashboardContainer}>
                <div className={styles.dashboardHeader}>
                    <h1 className={styles.dashboardTitle}>🏟️ Dashboard Owner</h1>
                    <p className={styles.dashboardSubtitle}>Bảng điều khiển owner: theo dõi hoạt động cá nhân và quản lý sân</p>
                </div>

                <div className={styles.statsGrid}>
                    {statCards.map((s, i) => (
                        <div key={i} className={styles.statCard} style={{ animationDelay: `${i * 0.1}s` }}>
                            <div style={{ width: 44, height: 44, borderRadius: 12, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', marginBottom: 12 }}>
                                {s.icon}
                            </div>
                            <div style={{ fontSize: '1.6rem', fontWeight: 800, lineHeight: 1.1, marginBottom: 4, color: s.color }}>{s.value}</div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{s.label}</div>
                        </div>
                    ))}
                </div>

                <div style={{ marginTop: -6, marginBottom: 22 }}>
                    <h3 className={styles.sectionTitle}>🏟️ Chỉ số vận hành Owner</h3>
                    <div className={styles.statsGrid} style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', marginBottom: 0 }}>
                        {ownerStatCards.map((s, i) => (
                            <div key={i} className={styles.statCard} style={{ animationDelay: `${i * 0.1}s` }}>
                                <div className={`${styles.statIcon} ${s.iconClass}`}>{s.icon}</div>
                                <div className={styles.statValue}>{s.value}</div>
                                <div className={styles.statLabel}>{s.label}</div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className={styles.tabBar} style={{ maxWidth: 920 }}>
                    {([
                        { key: 'bookings', label: `🏟️ Lịch đặt sân (${confirmedBookings.length})` },
                        { key: 'payments', label: `💰 Thanh toán (${visiblePaymentHistory.length})` },
                        { key: 'matches', label: `🏓 Lịch sử trận đấu (${matchHistory.length})` },
                        { key: 'owner', label: `🏟️ Quản lý Owner (${ownerBookings.length})` }
                    ] as { key: ActiveTab; label: string }[]).map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`${styles.tabButton} ${activeTab === tab.key ? styles.tabButtonActive : ''}`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {activeTab === 'bookings' && (
                    <div className={`glass-card ${styles.tabPanel}`}>
                        <h3 className={styles.sectionTitle}>🏟️ Lịch đặt sân</h3>
                        {confirmedBookings.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)' }}>
                                <div style={{ fontSize: '3rem', marginBottom: 12 }}>🏟️</div>
                                <p style={{ fontWeight: 600, marginBottom: 8 }}>Chưa có booking nào đã xác nhận</p>
                            </div>
                        ) : (
                            <>
                                <div style={{ overflowX: 'auto' }}>
                                    <table className={styles.table}>
                                        <thead>
                                            <tr>
                                                <th>#</th>
                                                <th>Sân</th>
                                                <th>Địa chỉ</th>
                                                <th>Ngày đặt</th>
                                                <th>Khung giờ</th>
                                                <th>Tổng tiền</th>
                                                <th>Trạng thái</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {visibleBookings.map((b, i) => {
                                                const st = BOOKING_STATUS[b.status] || { label: b.status, color: '#9ca3af' }
                                                return (
                                                    <tr key={b.id || i}>
                                                        <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{i + 1}</td>
                                                        <td style={{ fontWeight: 600 }}>{b.court_name || '—'}</td>
                                                        <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {b.address || '—'}
                                                        </td>
                                                        <td style={{ whiteSpace: 'nowrap' }}>{formatDate(b.booking_date)}</td>
                                                        <td style={{ fontSize: '0.82rem', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                                                            {formatTime(b.start_time)} - {formatTime(b.end_time)}
                                                        </td>
                                                        <td style={{ fontWeight: 700, color: '#f59e0b', whiteSpace: 'nowrap' }}>{formatPrice(b.total_price)}</td>
                                                        <td>
                                                            <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: '0.75rem', fontWeight: 600, background: st.color + '22', color: st.color, whiteSpace: 'nowrap' }}>
                                                                {st.label}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                {confirmedBookings.length > PAGE_SIZE && (
                                    <div style={{ textAlign: 'center', marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-glass)' }}>
                                        <button onClick={() => setShowAllBookings(v => !v)} style={{ background: 'none', border: '1px solid var(--border-glass)', borderRadius: 8, padding: '6px 20px', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>
                                            {showAllBookings ? '▲ Thu gọn' : `▼ Xem thêm ${confirmedBookings.length - PAGE_SIZE} booking`}
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {activeTab === 'payments' && (
                    <div className={`glass-card ${styles.tabPanel}`}>
                        <h3 className={styles.sectionTitle}>💰 Thanh toán</h3>
                        {visiblePaymentHistory.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)' }}>
                                <div style={{ fontSize: '3rem', marginBottom: 12 }}>💳</div>
                                <p style={{ fontWeight: 600 }}>Chưa có giao dịch nào</p>
                            </div>
                        ) : (
                            <>
                                <div style={{ overflowX: 'auto' }}>
                                    <table className={styles.table}>
                                        <thead>
                                            <tr>
                                                <th>#</th>
                                                <th>Nội dung</th>
                                                <th>Mã đơn</th>
                                                <th>Thời gian</th>
                                                <th>Phương thức</th>
                                                <th>Số tiền</th>
                                                <th>Trạng thái</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {visiblePayments.map((p, i) => (
                                                <tr key={p.id || i}>
                                                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{i + 1}</td>
                                                    <td>
                                                        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                                                            {p.court_name || (p.match_date ? `Trận ${formatDate(p.match_date)}` : 'Thanh toán')}
                                                        </div>
                                                    </td>
                                                    <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                                        #{p.transaction_id?.split('_')[1] || '—'}
                                                    </td>
                                                    <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                                                        {formatDateTime(p.created_at)}
                                                    </td>
                                                    <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                                                        {(METHOD_ICON[p.payment_method] || '💳')} {String(p.payment_method || 'mock').toUpperCase()}
                                                    </td>
                                                    <td style={{ fontWeight: 700, color: p.status === 'completed' ? '#f59e0b' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                                        -{formatPrice(p.amount)}
                                                    </td>
                                                    <td>
                                                        {p.status === 'pending' && p.payment_method === 'payos' ? (
                                                            <button
                                                                onClick={() => handlePayNow(p)}
                                                                disabled={redirectingPaymentId === p.id}
                                                                style={{
                                                                    whiteSpace: 'nowrap',
                                                                    padding: '3px 10px',
                                                                    borderRadius: 999,
                                                                    fontSize: '0.75rem',
                                                                    fontWeight: 600,
                                                                    background: 'rgba(245,158,11,0.15)',
                                                                    color: '#f59e0b',
                                                                    cursor: redirectingPaymentId === p.id ? 'not-allowed' : 'pointer',
                                                                    opacity: redirectingPaymentId === p.id ? 0.8 : 1
                                                                }}
                                                            >
                                                                {redirectingPaymentId === p.id ? 'Đang chuyển...' : '-> Thanh toán ngay'}
                                                            </button>
                                                        ) : (
                                                            <StatusBadge status={p.status} map={PAYMENT_STATUS} />
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {visiblePaymentHistory.length > PAGE_SIZE && (
                                    <div style={{ textAlign: 'center', marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-glass)' }}>
                                        <button onClick={() => setShowAllPayments(v => !v)} style={{ background: 'none', border: '1px solid var(--border-glass)', borderRadius: 8, padding: '6px 20px', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>
                                            {showAllPayments ? '▲ Thu gọn' : `▼ Xem thêm ${visiblePaymentHistory.length - PAGE_SIZE} giao dịch`}
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {activeTab === 'matches' && (
                    <div className={`glass-card ${styles.tabPanel}`}>
                        <h3 className={styles.sectionTitle}>🏓 Lịch sử trận đấu</h3>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px,1fr))', gap: 10, marginBottom: 14 }}>
                            <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Đã tạo</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{createdMatches.length}</div>
                            </div>
                            <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Đã tham gia</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{joinedMatches.length}</div>
                            </div>
                            <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Đã hoàn thành</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{completedMatches.length}</div>
                            </div>
                            <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Đã hủy (host)</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{cancelledHostMatches.length}</div>
                            </div>
                        </div>

                        {matchHistory.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)' }}>
                                <div style={{ fontSize: '3rem', marginBottom: 12 }}>🏓</div>
                                <p style={{ fontWeight: 600, marginBottom: 8 }}>Chưa có lịch sử trận đấu</p>
                            </div>
                        ) : (
                            <>
                                <div style={{ overflowX: 'auto' }}>
                                    <table className={styles.table}>
                                        <thead>
                                            <tr>
                                                <th>#</th>
                                                <th>Vai trò</th>
                                                <th>Sân</th>
                                                <th>Ngày giờ</th>
                                                <th>Người chơi</th>
                                                <th>Trạng thái</th>
                                                <th></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {visibleMatches.map((m, i) => {
                                                const status = String(m.status || '').toLowerCase()
                                                const isHost = !!m.is_host
                                                const roleLabel = isHost ? 'Host' : (m.is_waitlisted ? 'Waitlist' : 'Player')
                                                const roleColor = isHost ? '#60a5fa' : (m.is_waitlisted ? '#f59e0b' : '#10b981')
                                                return (
                                                    <tr key={m.id || i}>
                                                        <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{i + 1}</td>
                                                        <td>
                                                            <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: '0.75rem', fontWeight: 700, background: roleColor + '22', color: roleColor, whiteSpace: 'nowrap' }}>
                                                                {roleLabel}
                                                            </span>
                                                        </td>
                                                        <td style={{ fontWeight: 600 }}>{m.court_name || '—'}</td>
                                                        <td style={{ fontSize: '0.82rem', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                                                            {formatDate(m.match_date)} • {formatTime(m.start_time)} - {formatTime(m.end_time)}
                                                        </td>
                                                        <td style={{ fontSize: '0.82rem', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                                                            {m.current_players ?? m.active_players ?? 0}/{m.max_players ?? '--'}
                                                        </td>
                                                        <td>
                                                            <StatusBadge status={status} map={MATCH_STATUS} />
                                                        </td>
                                                        <td>
                                                            <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/matches/${m.id}`)}>
                                                                Xem
                                                            </button>
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                {matchHistory.length > PAGE_SIZE && (
                                    <div style={{ textAlign: 'center', marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-glass)' }}>
                                        <button onClick={() => setShowAllMatches(v => !v)} style={{ background: 'none', border: '1px solid var(--border-glass)', borderRadius: 8, padding: '6px 20px', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>
                                            {showAllMatches ? '▲ Thu gọn' : `▼ Xem thêm ${matchHistory.length - PAGE_SIZE} trận`}
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {activeTab === 'owner' && (
                    <div className={`glass-card ${styles.tabPanel}`}>
                        <h3 className={styles.sectionTitle}>🏟️ Chức năng Owner</h3>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginBottom: 16 }}>
                            <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>Doanh thu thực nhận</div>
                                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#10b981', marginBottom: 4 }}>{formatPrice(netRevenue)}</div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{receivedBookings.length} booking đã xác nhận/hoàn thành</div>
                            </div>
                            <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>Booking chờ xử lý</div>
                                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#f59e0b', marginBottom: 4 }}>{pendingBookings.length}</div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Cần xác nhận từ chủ sân</div>
                            </div>
                        </div>

                        <div className={styles.contentGrid}>
                            <div className="glass-card">
                                <h3 className={styles.sectionTitle}>📈 Doanh thu</h3>
                                <div className={styles.chartPlaceholder}>
                                    💰 Tổng doanh thu: {formatPrice(ownerStats?.revenue || 0)}<br />
                                    📋 {ownerStats?.total_bookings || 0} booking • 🏟️ {ownerStats?.court_count || 0} sân
                                </div>
                            </div>

                            <div className="glass-card">
                                <h3 className={styles.sectionTitle}>⏰ Tỷ lệ lấp đầy</h3>
                                <div className={styles.chartPlaceholder}>
                                    📊 {ownerStats?.occupancy || 0}% lấp đầy<br />
                                    🎯 {ownerStats?.match_count || 0} trận ghép
                                </div>
                            </div>
                        </div>

                        <div style={{ marginTop: 16 }}>
                            <h3 className={styles.sectionTitle}>📋 Booking của owner</h3>
                        </div>
                        {ownerBookings.length > 0 ? (
                            <>
                                <div style={{ overflowX: 'auto' }}>
                                    <table className={styles.table}>
                                        <thead>
                                            <tr>
                                                <th>#</th>
                                                <th>Khách hàng</th>
                                                <th>Sân</th>
                                                <th>Ngày</th>
                                                <th>Giờ</th>
                                                <th>Thực nhận</th>
                                                <th>Trạng thái</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {ownerVisibleBookings.map((b, i) => (
                                                <tr key={`${b.id || i}-owner`}>
                                                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{i + 1}</td>
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
                                </div>
                                {ownerBookings.length > PAGE_SIZE && (
                                    <div style={{ textAlign: 'center', marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-glass)' }}>
                                        <button onClick={() => setShowAllOwnerBookings(v => !v)} style={{ background: 'none', border: '1px solid var(--border-glass)', borderRadius: 8, padding: '6px 20px', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>
                                            {showAllOwnerBookings ? '▲ Thu gọn' : `▼ Xem thêm ${ownerBookings.length - PAGE_SIZE} booking`}
                                        </button>
                                    </div>
                                )}
                            </>
                        ) : (
                            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Chưa có booking nào</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
