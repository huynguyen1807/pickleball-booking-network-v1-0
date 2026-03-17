import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'
import styles from '../styles/Dashboard.module.css'
import { useAuth } from '../context/AuthContext'
import { formatDateVN, formatDateTimeVN, formatTimeHHmm } from '../utils/dateTime'

type ActiveTab = 'bookings' | 'payments' | 'matches'

const BOOKING_STATUS: Record<string, { label: string; color: string }> = {
    pending:   { label: 'Chờ xác nhận', color: '#f59e0b' },
    confirmed: { label: 'Đã xác nhận',  color: '#10b981' },
    completed: { label: 'Hoàn thành',   color: '#3b82f6' },
    cancelled: { label: 'Đã hủy',       color: '#ef4444' },
}

const PAYMENT_STATUS: Record<string, { label: string; bg: string; color: string }> = {
    pending:   { label: 'Chờ thanh toán', bg: 'rgba(245,158,11,0.15)',  color: '#f59e0b' },
    completed: { label: 'Thành công',     bg: 'rgba(16,185,129,0.15)',  color: '#10b981' },
    failed:    { label: 'Thất bại',       bg: 'rgba(239,68,68,0.15)',   color: '#ef4444' },
    cancelled: { label: 'Đã hủy',         bg: 'rgba(107,114,128,0.15)', color: '#9ca3af' },
    expired:   { label: 'Hết hạn',        bg: 'rgba(249,115,22,0.15)',  color: '#f97316' },
    refunded:  { label: 'Hoàn tiền',      bg: 'rgba(139,92,246,0.15)',  color: '#8b5cf6' },
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

export default function UserDashboard() {
    const { user } = useAuth()
    const navigate = useNavigate()
    const [stats, setStats] = useState<any>(null)
    const [bookings, setBookings] = useState<any[]>([])
    const [payments, setPayments] = useState<any[]>([])
    const [matchHistory, setMatchHistory] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<ActiveTab>('bookings')
    const [showAllBookings, setShowAllBookings] = useState(false)
    const [showAllPayments, setShowAllPayments] = useState(false)
    const [showAllMatches, setShowAllMatches] = useState(false)
    const [redirectingPaymentId, setRedirectingPaymentId] = useState<number | null>(null)

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

            if (!checkoutUrl) {
                throw new Error('Missing checkout URL')
            }

            window.location.href = checkoutUrl
        } catch (err: any) {
            console.error('Failed to redirect payment:', err)
            alert(err?.response?.data?.message || 'Không thể chuyển đến trang thanh toán')
            setRedirectingPaymentId(null)
        }
    }

    useEffect(() => {
        const loadData = async () => {
            const [statsRes, bookingsRes, paymentsRes, matchesRes] = await Promise.allSettled([
                api.get('/stats/user'),
                api.get('/bookings/my'),
                api.get('/payments/history'),
                api.get('/matches/my-history')
            ])
            if (statsRes.status === 'fulfilled') setStats(statsRes.value.data)
            else console.warn('Stats failed:', (statsRes as PromiseRejectedResult).reason)
            if (bookingsRes.status === 'fulfilled') setBookings(bookingsRes.value.data)
            else console.warn('Bookings failed:', (bookingsRes as PromiseRejectedResult).reason)
            if (paymentsRes.status === 'fulfilled') setPayments(paymentsRes.value.data)
            else console.warn('Payments failed:', (paymentsRes as PromiseRejectedResult).reason)
            if (matchesRes.status === 'fulfilled') setMatchHistory(matchesRes.value.data)
            else console.warn('Matches failed:', (matchesRes as PromiseRejectedResult).reason)
            setLoading(false)
        }
        loadData()
    }, [])

    const fmt = (p: number) => new Intl.NumberFormat('vi-VN').format(p || 0) + 'đ'
    const fmtDate = (d: string) => formatDateVN(d)
    const fmtDateTime = (d: string) => formatDateTimeVN(d)
    const fmtMatchDate = (value: any) => formatDateVN(value)
    const fmtMatchTime = (value: any) => formatTimeHHmm(value)

    if (loading) return (
        <div className={styles.dashboardPage} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
            <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>⏳</div>
                <p>Đang tải dữ liệu...</p>
            </div>
        </div>
    )

    const confirmedBookings = bookings.filter(b => b.status === 'confirmed')
    const visiblePaymentHistory = payments.filter(p => VISIBLE_PAYMENT_STATUSES.includes(p.status))
    const completedPayments = visiblePaymentHistory.filter(p => p.status === 'completed').length
    const createdMatches = matchHistory.filter(m => !!m.is_host)
    const joinedMatches = matchHistory.filter(m => !m.is_host && (m.is_joined || m.is_waitlisted))
    const completedMatches = matchHistory.filter(m => ['completed', 'finished'].includes(String(m.status || '').toLowerCase()))
    const cancelledHostMatches = matchHistory.filter(m => !!m.is_host && String(m.status || '').toLowerCase() === 'cancelled')

    const statCards = [
        { icon: '🏟️', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  value: confirmedBookings.length,                 label: 'Lần đặt sân' },
        { icon: '🏓', color: '#10b981', bg: 'rgba(16,185,129,0.12)',  value: stats?.matches_count ?? matchHistory.length, label: 'Tổng trận của bạn' },
        { icon: '💰', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  value: fmt(stats?.total_spent ?? 0),             label: 'Tổng chi tiêu' },
        { icon: '✅', color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)',  value: completedPayments,                        label: 'GD thành công' },
    ]

    const visibleBookings = showAllBookings ? confirmedBookings : confirmedBookings.slice(0, PAGE_SIZE)
    const visiblePayments = showAllPayments ? visiblePaymentHistory : visiblePaymentHistory.slice(0, PAGE_SIZE)
    const visibleMatches = showAllMatches ? matchHistory : matchHistory.slice(0, PAGE_SIZE)

    return (
        <div className={styles.dashboardPage}>
            {/* Header */}
            <div style={{ marginBottom: '28px' }}>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '4px' }}>
                    Xin chào, {user?.full_name?.split(' ').pop() || 'bạn'} 👋
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    Quản lý lịch đặt sân và giao dịch của bạn
                </p>
            </div>

            {/* Stats Cards */}
            <div className={styles.statsGrid} style={{ marginBottom: '28px' }}>
                {statCards.map((s, i) => (
                    <div key={i} className={styles.statCard}>
                        <div style={{ width: 44, height: 44, borderRadius: 12, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', marginBottom: 12 }}>
                            {s.icon}
                        </div>
                        <div style={{ fontSize: '1.6rem', fontWeight: 800, lineHeight: 1.1, marginBottom: 4, color: s.color }}>{s.value}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Tab Bar */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: 'var(--bg-glass)', borderRadius: 12, padding: 4, width: 'fit-content', border: '1px solid var(--border-glass)' }}>
                {(['bookings', 'payments', 'matches'] as ActiveTab[]).map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)} style={{
                        padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
                        fontWeight: 600, fontSize: '0.875rem', transition: 'all 0.2s',
                        background: activeTab === tab ? 'var(--bg-card)' : 'transparent',
                        color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-muted)',
                        boxShadow: activeTab === tab ? '0 1px 4px rgba(0,0,0,0.25)' : 'none',
                    }}>
                        {tab === 'bookings'
                            ? `🏟️ Lịch đặt sân (${confirmedBookings.length})`
                            : tab === 'payments'
                                ? `💰 Thanh toán (${visiblePaymentHistory.length})`
                                : `🏓 Lịch sử trận đấu (${matchHistory.length})`}
                    </button>
                ))}
            </div>

            {/* ── Bookings Tab ── */}
            {activeTab === 'bookings' && (
                <div className="glass-card">
                    <h3 className={styles.sectionTitle}>🏟️ Lịch sử đặt sân</h3>
                    {confirmedBookings.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)' }}>
                            <div style={{ fontSize: '3rem', marginBottom: 12 }}>🏟️</div>
                            <p style={{ fontWeight: 600, marginBottom: 8 }}>Chưa có booking nào đã xác nhận</p>
                            <button onClick={() => navigate('/facilities')} className="btn btn-primary" style={{ marginTop: 8 }}>
                                Đặt sân ngay
                            </button>
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
                                                <tr key={b.id}>
                                                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{i + 1}</td>
                                                    <td style={{ fontWeight: 600 }}>{b.court_name || '—'}</td>
                                                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {b.address || '—'}
                                                    </td>
                                                    <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(b.booking_date)}</td>
                                                    <td style={{ fontSize: '0.82rem', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                                                        {fmtMatchTime(b.start_time)} – {fmtMatchTime(b.end_time)}
                                                    </td>
                                                    <td style={{ fontWeight: 700, color: '#f59e0b', whiteSpace: 'nowrap' }}>
                                                        {fmt(b.total_price)}
                                                    </td>
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

            {/* ── Payments Tab ── */}
            {activeTab === 'payments' && (
                <div className="glass-card">
                    <h3 className={styles.sectionTitle}>💰 Lịch sử giao dịch</h3>
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
                                        {visiblePayments.map((p, i) => {
                                            const st = PAYMENT_STATUS[p.status] || { label: p.status, bg: 'rgba(156,163,175,0.15)', color: '#9ca3af' }
                                            const method = p.payment_method || 'mock'
                                            const orderCode = p.transaction_id?.split('_')[1] || '—'
                                            const description = p.court_name
                                                ? p.court_name
                                                : p.match_date
                                                    ? `Trận ${fmtDate(p.match_date)}`
                                                    : 'Thanh toán'
                                            const amountColor = p.status === 'completed' ? '#10b981'
                                                : p.status === 'pending' ? '#f59e0b'
                                                : 'var(--text-muted)'
                                            return (
                                                <tr key={p.id}>
                                                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{i + 1}</td>
                                                    <td>
                                                        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{description}</div>
                                                        {p.booking_date && (
                                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                                                                Ngày đặt: {fmtDate(p.booking_date)}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                                        #{orderCode}
                                                    </td>
                                                    <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                                                        {fmtDateTime(p.created_at)}
                                                    </td>
                                                    <td>
                                                        <span style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                                                            {METHOD_ICON[method] || '💳'} {method.toUpperCase()}
                                                        </span>
                                                    </td>
                                                    <td style={{ fontWeight: 700, color: amountColor, whiteSpace: 'nowrap' }}>
                                                        {fmt(p.amount)}
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
                                            )
                                        })}
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

            {/* ── Matches Tab ── */}
            {activeTab === 'matches' && (
                <div className="glass-card">
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
                            <button onClick={() => navigate('/matchmaking')} className="btn btn-primary" style={{ marginTop: 8 }}>
                                Tìm trận ngay
                            </button>
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
                                                <tr key={m.id}>
                                                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{i + 1}</td>
                                                    <td>
                                                        <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: '0.75rem', fontWeight: 700, background: roleColor + '22', color: roleColor, whiteSpace: 'nowrap' }}>
                                                            {roleLabel}
                                                        </span>
                                                    </td>
                                                    <td style={{ fontWeight: 600 }}>{m.court_name || '—'}</td>
                                                    <td style={{ fontSize: '0.82rem', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                                                        {fmtMatchDate(m.match_date)} • {fmtMatchTime(m.start_time)} - {fmtMatchTime(m.end_time)}
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
        </div>
    )
}
