import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'
import BackButton from '../components/BackButton'
import styles from '../styles/Dashboard.module.css'
import pageStyles from '../styles/OwnerDashboardPage.module.css'
import { useDialog } from '../context/DialogContext'
import { formatDateVN, formatDateTimeVN, formatTimeHHmm } from '../utils/dateTime'

type ActiveTab = 'bookings' | 'payments' | 'matches' | 'owner'

type BadgeConfig = { label: string; className: string }

const BOOKING_STATUS: Record<string, BadgeConfig> = {
    pending: { label: 'Chờ xác nhận', className: pageStyles.bookingPending },
    confirmed: { label: 'Đã xác nhận', className: pageStyles.bookingConfirmed },
    completed: { label: 'Hoàn thành', className: pageStyles.bookingCompleted },
    cancelled: { label: 'Đã hủy', className: pageStyles.bookingCancelled },
    transferred: { label: 'Chuyển nhượng', className: pageStyles.bookingTransferred || pageStyles.bookingCompleted },
}

const PAYMENT_STATUS: Record<string, BadgeConfig> = {
    pending: { label: 'Chờ thanh toán', className: pageStyles.paymentPending },
    completed: { label: 'Thành công', className: pageStyles.paymentCompleted },
    failed: { label: 'Thất bại', className: pageStyles.paymentFailed },
    cancelled: { label: 'Đã hủy', className: pageStyles.paymentCancelled },
    expired: { label: 'Hết hạn', className: pageStyles.paymentExpired },
    refunded: { label: 'Hoàn tiền', className: pageStyles.paymentRefunded },
}

const MATCH_STATUS: Record<string, BadgeConfig> = {
    waiting: { label: 'Đang tìm người', className: pageStyles.matchWaiting },
    open: { label: 'Đang mở', className: pageStyles.matchOpen },
    full: { label: 'Đã đủ người', className: pageStyles.matchFull },
    confirmed: { label: 'Đã xác nhận', className: pageStyles.matchConfirmed },
    completed: { label: 'Hoàn thành', className: pageStyles.matchCompleted },
    finished: { label: 'Hoàn thành', className: pageStyles.matchFinished },
    cancelled: { label: 'Đã hủy', className: pageStyles.matchCancelled }
}

const METHOD_ICON: Record<string, string> = { payos: '💳', mock: '🧪', cash: '💵' }
const PAGE_SIZE = 8
const VISIBLE_PAYMENT_STATUSES = ['completed', 'cancelled', 'expired', 'pending']
const roundMoney = (value: any) => Math.round(Number(value) || 0)

function StatusBadge({ status, map }: { status: string; map: Record<string, BadgeConfig> }) {
    const cfg = map[status] || { label: status, className: pageStyles.statusNeutral }
    return (
        <span className={`${pageStyles.statusBadge} ${cfg.className}`}>
            {cfg.label}
        </span>
    )
}

export default function OwnerDashboard() {
    const navigate = useNavigate()
    const { showAlert } = useDialog()
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

    // New states for Booking Actions
    const [cancelModal, setCancelModal] = useState<{ open: boolean; booking: any | null; hoursLeft: number }>({ open: false, booking: null, hoursLeft: 0 })
    
    // Enhanced Transfer Modal State
    const [transferModal, setTransferModal] = useState<{
        open: boolean;
        booking: any | null;
        step: 1 | 2;
        email: string;
        targetUser: any | null;
        checking: boolean;
    }>({ open: false, booking: null, step: 1, email: '', targetUser: null, checking: false })

    const [transferRequests, setTransferRequests] = useState<{ sent: any[], received: any[] }>({ sent: [], received: [] })

    useEffect(() => {
        const loadData = async () => {
            const [ownerStatsRes, ownerBookingsRes, userStatsRes, myBookingsRes, paymentsRes, matchesRes, balanceRes, transfersRes] = await Promise.allSettled([
                    api.get('/stats/owner'),
                    api.get('/bookings/owner'),
                    api.get('/stats/user'),
                    api.get('/bookings/my'),
                    api.get('/payments/history'),
                    api.get('/matches/my-history'),
                    api.get('/users/me/balance'),
                    api.get('/transfers/my-requests')
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
            if (transfersRes.status === 'fulfilled') setTransferRequests(transfersRes.value.data || { sent: [], received: [] })
            else console.warn('Transfers failed:', (transfersRes as PromiseRejectedResult).reason)

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

    const handleOpenCancel = (booking: any) => {
        const matchDate = new Date(booking.booking_date);
        const [h, m] = booking.start_time.split(':').map(Number);
        matchDate.setHours(h, m, 0, 0);
        const diffHours = (matchDate.getTime() - new Date().getTime()) / (1000 * 60 * 60);
        setCancelModal({ open: true, booking, hoursLeft: diffHours });
    }

    const confirmCancel = async () => {
        if (!cancelModal.booking) return;
        try {
            const res = await api.put(`/bookings/${cancelModal.booking.id}/cancel`);
            alert(res.data.message || 'Hủy thành công');
            setCancelModal({ open: false, booking: null, hoursLeft: 0 });
            window.location.reload();
        } catch (err: any) {
            await showAlert(err?.response?.data?.message || 'Lỗi khi hủy');
        }
    }

    const handleCheckEmail = async () => {
        if (!transferModal.email.trim()) {
            await showAlert('Vui lòng nhập email');
            return;
        }
        setTransferModal(p => ({ ...p, checking: true }));
        try {
            const res = await api.get(`/users/by-email/${transferModal.email.trim()}`);
            setTransferModal(p => ({ ...p, step: 2, targetUser: res.data, checking: false }));
        } catch (err: any) {
            setTransferModal(p => ({ ...p, checking: false }));
            await showAlert(err?.response?.data?.message || 'Không tìm thấy người dùng');
        }
    }

    const confirmTransfer = async () => {
        if (!transferModal.booking || !transferModal.targetUser) return;
        try {
            const res = await api.post(`/transfers/request`, { 
                bookingId: transferModal.booking.id, 
                receiverEmail: transferModal.targetUser.email 
            });
            await showAlert(res.data.message || 'Đã gửi lời mời chuyển nhượng');
            setTransferModal({ open: false, booking: null, step: 1, email: '', targetUser: null, checking: false });
            window.location.reload();
        } catch (err: any) {
            await showAlert(err?.response?.data?.message || 'Lỗi khi yêu cầu chuyển nhượng');
        }
    }

    const handleAcceptTransfer = async (id: number) => {
        try {
            const res = await api.post(`/transfers/${id}/accept`);
            await showAlert(res.data.message || 'Chấp nhận thành công');
            window.location.reload();
        } catch (err: any) {
            await showAlert(err?.response?.data?.message || 'Lỗi xử lý');
        }
    }

    const handleRejectTransfer = async (id: number) => {
        try {
            const res = await api.post(`/transfers/${id}/reject`);
            await showAlert(res.data.message || 'Đã từ chối lời mời');
            window.location.reload();
        } catch (err: any) {
            await showAlert(err?.response?.data?.message || 'Lỗi xử lý');
        }
    }

    const handleCancelTransfer = async (id: number) => {
        try {
            const res = await api.patch(`/transfers/${id}/cancel`);
            await showAlert(res.data.message || 'Đã thu hồi lời mời');
            window.location.reload();
        } catch (err: any) {
            await showAlert(err?.response?.data?.message || 'Lỗi xử lý');
        }
    }

    const formatPrice = (p) => new Intl.NumberFormat('vi-VN').format(roundMoney(p)) + 'đ'
    const formatDate = (d) => formatDateVN(d)
    const formatDateTime = (d) => formatDateTimeVN(d)
    const formatTime = (t) => formatTimeHHmm(t)
    const isReceivedStatus = (status) => status === 'confirmed' || status === 'completed'
    const getNetReceived = (booking) => {
        const total = roundMoney(booking?.total_price)
        const commission = roundMoney(booking?.commission_amount)
        return Math.max(roundMoney(total - commission), 0)
    }

    if (loading) return <div className={`${styles.dashboardPage} ${pageStyles.loadingState}`}>⏳ Đang tải...</div>

    const confirmedBookings = myBookings.filter(b => b.status === 'confirmed')
    const visiblePaymentHistory = payments.filter(p => VISIBLE_PAYMENT_STATUSES.includes(p.status))
    const completedPayments = visiblePaymentHistory.filter(p => p.status === 'completed').length
    const createdMatches = matchHistory.filter(m => !!m.is_host)
    const joinedMatches = matchHistory.filter(m => !m.is_host && (m.is_joined || m.is_waitlisted))
    const completedMatches = matchHistory.filter(m => ['completed', 'finished'].includes(String(m.status || '').toLowerCase()))
    const cancelledHostMatches = matchHistory.filter(m => !!m.is_host && String(m.status || '').toLowerCase() === 'cancelled')

    const statCards = [
        { icon: '🏟️', iconClass: pageStyles.primaryStatIconBlue, valueClass: pageStyles.primaryStatValueBlue, value: confirmedBookings.length, label: 'Lần đặt sân' },
        { icon: '🏓', iconClass: pageStyles.primaryStatIconGreen, valueClass: pageStyles.primaryStatValueGreen, value: userStats?.matches_count ?? matchHistory.length, label: 'Tổng trận của bạn' },
        { icon: '💰', iconClass: pageStyles.primaryStatIconYellow, valueClass: pageStyles.primaryStatValueYellow, value: formatPrice(userStats?.total_spent ?? 0), label: 'Tổng chi tiêu' },
        { icon: '✅', iconClass: pageStyles.primaryStatIconPurple, valueClass: pageStyles.primaryStatValuePurple, value: completedPayments, label: 'GD thành công' },
        { icon: '👛', iconClass: pageStyles.primaryStatIconGreen, valueClass: pageStyles.primaryStatValueGreen, value: formatPrice(walletBalance), label: 'Số dư ví' },
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
                        <div key={i} className={styles.statCard}>
                            <div className={`${pageStyles.primaryStatIcon} ${s.iconClass}`}>
                                {s.icon}
                            </div>
                            <div className={`${pageStyles.primaryStatValue} ${s.valueClass}`}>{s.value}</div>
                            <div className={pageStyles.primaryStatLabel}>{s.label}</div>
                        </div>
                    ))}
                </div>

                <div className={pageStyles.ownerMetricsSection}>
                    <h3 className={styles.sectionTitle}>🏟️ Chỉ số vận hành Owner</h3>
                    <div className={`${styles.statsGrid} ${pageStyles.ownerMetricsGrid}`}>
                        {ownerStatCards.map((s, i) => (
                            <div key={i} className={styles.statCard}>
                                <div className={`${styles.statIcon} ${s.iconClass}`}>{s.icon}</div>
                                <div className={styles.statValue}>{s.value}</div>
                                <div className={styles.statLabel}>{s.label}</div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className={`${styles.tabBar} ${pageStyles.wideTabBar}`}>
                    {([
                        { key: 'bookings', label: `🏟️ Lịch đặt sân (${confirmedBookings.length})` },
                        { key: 'payments', label: `💰 Thanh toán (${visiblePaymentHistory.length})` },
                        { key: 'matches', label: `🏓 Lịch sử trận đấu (${matchHistory.length})` },
                        { key: 'owner', label: `🏟️ Quản lý Owner (${ownerBookings.length})` }
                    ] as { key: ActiveTab; label: string }[]).map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`${styles.tabButton} ${pageStyles.ownerTabButton} ${activeTab === tab.key ? styles.tabButtonActive : ''}`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {activeTab === 'bookings' && (
                    <div className={`glass-card ${styles.tabPanel}`}>
                        <h3 className={styles.sectionTitle}>🏟️ Lịch đặt sân</h3>
                        
                        {/* Chính sách hoàn vé */}
                        <div style={{ padding: '12px 16px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '8px', marginBottom: '16px' }}>
                            <h4 style={{ margin: '0 0 8px 0', fontSize: '0.95rem', color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '1.2rem' }}>📜</span> Chính sách hoàn vé & Chuyển nhượng
                            </h4>
                            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>
                                <li style={{ marginBottom: '4px' }}>🟢 <b>Hủy trước 4 giờ</b> → Hoàn tiền 100%</li>
                                <li style={{ marginBottom: '4px' }}>🔴 <b>Hủy trong vòng 4 giờ</b> trước trận → Không hoàn tiền</li>
                                <li>🔄 <b>Chuyển nhượng</b> → Dành cho các lịch Đã xác nhận, trước trận ít nhất 2h.</li>
                            </ul>
                        </div>
                        {/* Rendering Pending Transfers Section */}
                        {(transferRequests.received.filter(t => t.status === 'pending').length > 0 || transferRequests.sent.filter(t => t.status === 'pending').length > 0) && (
                            <div style={{ marginBottom: 24 }}>
                                {transferRequests.received.filter(t => t.status === 'pending').length > 0 && (
                                    <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                                        <h4 style={{ margin: '0 0 12px 0', color: '#f59e0b', fontSize: '1rem' }}>📥 Lời mời nhận sân đang chờ</h4>
                                        {transferRequests.received.filter(t => t.status === 'pending').map(t => (
                                            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: 12, borderRadius: 8, marginBottom: 8 }}>
                                                <div>
                                                    <div style={{ fontWeight: 600 }}>{t.court_name}</div>
                                                    <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>
                                                        Ngày: {formatDate(t.booking_date)} • {formatTime(t.start_time)} - {formatTime(t.end_time)}
                                                    </div>
                                                    <div style={{ fontSize: '0.8rem', color: '#3b82f6', marginTop: 4 }}>
                                                        Từ: {t.sender_name} ({t.sender_email})
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', gap: 8 }}>
                                                    <button className="btn btn-primary btn-sm" onClick={() => handleAcceptTransfer(t.id)}>✅ Nhận</button>
                                                    <button className="btn btn-secondary btn-sm" style={{ color: '#ef4444', borderColor: '#ef4444' }} onClick={() => handleRejectTransfer(t.id)}>Từ chối</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {transferRequests.sent.filter(t => t.status === 'pending').length > 0 && (
                                    <div style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 12, padding: 16 }}>
                                        <h4 style={{ margin: '0 0 12px 0', color: '#3b82f6', fontSize: '1rem' }}>📤 Lời mời chuyển sân đã gửi</h4>
                                        {transferRequests.sent.filter(t => t.status === 'pending').map(t => (
                                            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: 12, borderRadius: 8, marginBottom: 8 }}>
                                                <div>
                                                    <div style={{ fontWeight: 600 }}>{t.court_name}</div>
                                                    <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>
                                                        Ngày: {formatDate(t.booking_date)} • {formatTime(t.start_time)} - {formatTime(t.end_time)}
                                                    </div>
                                                    <div style={{ fontSize: '0.8rem', color: '#10b981', marginTop: 4 }}>
                                                        Gửi tới: {t.receiver_name} ({t.receiver_email})
                                                    </div>
                                                </div>
                                                <div>
                                                    <button className="btn btn-secondary btn-sm" onClick={() => handleCancelTransfer(t.id)}>Thu hồi (Cancel)</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {confirmedBookings.length === 0 ? (
                            <div className={pageStyles.emptyState}>
                                <div className={pageStyles.emptyIcon}>🏟️</div>
                                <p className={pageStyles.emptyTitle}>Chưa có booking nào đã xác nhận</p>
                            </div>
                        ) : (
                            <>
                                <div className={pageStyles.tableWrap}>
                                    <table className={`${styles.table} ${pageStyles.dataTable}`}>
                                        <thead>
                                            <tr>
                                                <th>#</th>
                                                <th>Sân</th>
                                                <th>Địa chỉ</th>
                                                <th>Ngày đặt</th>
                                                <th>Khung giờ</th>
                                                <th>Tổng tiền</th>
                                                <th>Trạng thái</th>
                                                <th>Thao tác</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {visibleBookings.map((b, i) => {
                                                const st = BOOKING_STATUS[b.status] || { label: b.status, className: pageStyles.statusNeutral }
                                                return (
                                                    <tr key={b.id || i}>
                                                        <td className={pageStyles.tableIndexCell}>{i + 1}</td>
                                                        <td className={pageStyles.tableStrongCell}>{b.court_name || '—'}</td>
                                                        <td className={pageStyles.tableMutedEllipsisCell}>
                                                            {b.address || '—'}
                                                        </td>
                                                        <td className={pageStyles.tableNowrapCell}>{formatDate(b.booking_date)}</td>
                                                        <td className={pageStyles.tableTimeCell}>
                                                            {formatTime(b.start_time)} - {formatTime(b.end_time)}
                                                        </td>
                                                        <td className={pageStyles.tableAmountCell}>{formatPrice(b.total_price)}</td>
                                                        <td>
                                                            <span className={`${pageStyles.statusBadge} ${st.className}`}>
                                                                {st.label}
                                                            </span>
                                                        </td>
                                                        <td style={{ display: 'flex', gap: '8px' }}>
                                                            {b.status === 'confirmed' && (
                                                                <>
                                                                    <button className="btn btn-primary btn-sm" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => setTransferModal({ open: true, booking: b, step: 1, email: '', targetUser: null, checking: false })}>🔄 Nhượng</button>
                                                                    <button className="btn btn-secondary btn-sm" style={{ padding: '4px 8px', fontSize: '0.75rem', borderColor: '#ef4444', color: '#ef4444', background: 'transparent' }} onClick={() => handleOpenCancel(b)}>❌ Hủy</button>
                                                                </>
                                                            )}
                                                            {b.status === 'pending' && (
                                                                <button className="btn btn-secondary btn-sm" style={{ padding: '4px 8px', fontSize: '0.75rem', borderColor: '#ef4444', color: '#ef4444', background: 'transparent' }} onClick={() => handleOpenCancel(b)}>❌ Hủy</button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                {confirmedBookings.length > PAGE_SIZE && (
                                    <div className={pageStyles.showMoreWrap}>
                                        <button onClick={() => setShowAllBookings(v => !v)} className={pageStyles.showMoreBtn}>
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
                            <div className={pageStyles.emptyState}>
                                <div className={pageStyles.emptyIcon}>💳</div>
                                <p className={pageStyles.emptyTitle}>Chưa có giao dịch nào</p>
                            </div>
                        ) : (
                            <>
                                <div className={pageStyles.tableWrap}>
                                    <table className={`${styles.table} ${pageStyles.dataTable}`}>
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
                                                    <td className={pageStyles.tableIndexCell}>{i + 1}</td>
                                                    <td>
                                                        <div className={pageStyles.tableContentTitle}>
                                                            {p.court_name || (p.match_date ? `Trận ${formatDate(p.match_date)}` : 'Thanh toán')}
                                                        </div>
                                                    </td>
                                                    <td className={pageStyles.tableOrderCodeCell}>
                                                        #{p.transaction_id?.split('_')[1] || '—'}
                                                    </td>
                                                    <td className={pageStyles.tableDateTimeCell}>
                                                        {formatDateTime(p.created_at)}
                                                    </td>
                                                    <td className={pageStyles.tableMethodCell}>
                                                        {(METHOD_ICON[p.payment_method] || '💳')} {String(p.payment_method || 'mock').toUpperCase()}
                                                    </td>
                                                    <td className={p.status === 'completed' ? pageStyles.tableAmountCell : pageStyles.tableAmountMutedCell}>
                                                        -{formatPrice(p.amount)}
                                                    </td>
                                                    <td>
                                                        {p.status === 'pending' && p.payment_method === 'payos' ? (
                                                            <button
                                                                onClick={() => handlePayNow(p)}
                                                                disabled={redirectingPaymentId === p.id}
                                                                className={pageStyles.payNowButton}
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
                                    <div className={pageStyles.showMoreWrap}>
                                        <button onClick={() => setShowAllPayments(v => !v)} className={pageStyles.showMoreBtn}>
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

                        <div className={pageStyles.matchSummaryGrid}>
                            <div className={`${pageStyles.matchSummaryCard} ${pageStyles.matchSummaryCreate}`}>
                                <div className={pageStyles.matchSummaryLabel}>Đã tạo</div>
                                <div className={pageStyles.matchSummaryValue}>{createdMatches.length}</div>
                            </div>
                            <div className={`${pageStyles.matchSummaryCard} ${pageStyles.matchSummaryJoin}`}>
                                <div className={pageStyles.matchSummaryLabel}>Đã tham gia</div>
                                <div className={pageStyles.matchSummaryValue}>{joinedMatches.length}</div>
                            </div>
                            <div className={`${pageStyles.matchSummaryCard} ${pageStyles.matchSummaryCompleted}`}>
                                <div className={pageStyles.matchSummaryLabel}>Đã hoàn thành</div>
                                <div className={pageStyles.matchSummaryValue}>{completedMatches.length}</div>
                            </div>
                            <div className={`${pageStyles.matchSummaryCard} ${pageStyles.matchSummaryCancelled}`}>
                                <div className={pageStyles.matchSummaryLabel}>Đã hủy (host)</div>
                                <div className={pageStyles.matchSummaryValue}>{cancelledHostMatches.length}</div>
                            </div>
                        </div>

                        {matchHistory.length === 0 ? (
                            <div className={pageStyles.emptyState}>
                                <div className={pageStyles.emptyIcon}>🏓</div>
                                <p className={pageStyles.emptyTitle}>Chưa có lịch sử trận đấu</p>
                            </div>
                        ) : (
                            <>
                                <div className={pageStyles.tableWrap}>
                                    <table className={`${styles.table} ${pageStyles.dataTable}`}>
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
                                                const roleClass = isHost ? pageStyles.roleBadgeHost : (m.is_waitlisted ? pageStyles.roleBadgeWaitlist : pageStyles.roleBadgePlayer)
                                                return (
                                                    <tr key={m.id || i}>
                                                        <td className={pageStyles.tableIndexCell}>{i + 1}</td>
                                                        <td>
                                                            <span className={`${pageStyles.statusBadge} ${roleClass}`}>
                                                                {roleLabel}
                                                            </span>
                                                        </td>
                                                        <td className={pageStyles.tableStrongCell}>{m.court_name || '—'}</td>
                                                        <td className={pageStyles.tableTimeCell}>
                                                            {formatDate(m.match_date)} • {formatTime(m.start_time)} - {formatTime(m.end_time)}
                                                        </td>
                                                        <td className={pageStyles.tableTimeCell}>
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
                                    <div className={pageStyles.showMoreWrap}>
                                        <button onClick={() => setShowAllMatches(v => !v)} className={pageStyles.showMoreBtn}>
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

                        <div className={pageStyles.ownerSummaryGrid}>
                            <div className={`${pageStyles.ownerSummaryCard} ${pageStyles.ownerSummaryCardRevenue}`}>
                                <div className={pageStyles.ownerSummaryLabel}>Doanh thu thực nhận</div>
                                <div className={`${pageStyles.ownerSummaryValue} ${pageStyles.ownerSummaryValueRevenue}`}>{formatPrice(netRevenue)}</div>
                                <div className={pageStyles.ownerSummaryDesc}>{receivedBookings.length} booking đã xác nhận/hoàn thành</div>
                            </div>
                            <div className={`${pageStyles.ownerSummaryCard} ${pageStyles.ownerSummaryCardPending}`}>
                                <div className={pageStyles.ownerSummaryLabel}>Booking chờ xử lý</div>
                                <div className={`${pageStyles.ownerSummaryValue} ${pageStyles.ownerSummaryValuePending}`}>{pendingBookings.length}</div>
                                <div className={pageStyles.ownerSummaryDesc}>Cần xác nhận từ chủ sân</div>
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

                        <div className={pageStyles.ownerSectionSpacing}>
                            <h3 className={styles.sectionTitle}>📋 Booking của owner</h3>
                        </div>
                        {ownerBookings.length > 0 ? (
                            <>
                                <div className={pageStyles.tableWrap}>
                                    <table className={`${styles.table} ${pageStyles.dataTable}`}>
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
                                                    <td className={pageStyles.tableIndexCell}>{i + 1}</td>
                                                    <td className={pageStyles.tableStrongCell}>{b.user_name}</td>
                                                    <td>{b.court_name}</td>
                                                    <td>{formatDate(b.booking_date)}</td>
                                                    <td>{b.start_time} - {b.end_time}</td>
                                                    <td className={isReceivedStatus(b.status) ? pageStyles.tableStrongCell : pageStyles.tableIndexCell}>
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
                                    <div className={pageStyles.showMoreWrap}>
                                        <button onClick={() => setShowAllOwnerBookings(v => !v)} className={pageStyles.showMoreBtn}>
                                            {showAllOwnerBookings ? '▲ Thu gọn' : `▼ Xem thêm ${ownerBookings.length - PAGE_SIZE} booking`}
                                        </button>
                                    </div>
                                )}
                            </>
                        ) : (
                            <p className={pageStyles.ownerEmptyText}>Chưa có booking nào</p>
                        )}
                    </div>
                )}
            </div>

            {/* Cancel Modal */}
            {cancelModal.open && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="glass-card" style={{ width: '100%', maxWidth: 450, padding: 24, border: '1px solid rgba(255,255,255,0.1)' }}>
                        <h3 style={{ marginTop: 0, marginBottom: 16, color: '#fff' }}>Xác nhận hủy đặt sân</h3>
                        {cancelModal.booking?.status === 'confirmed' && (
                            <div style={{ padding: 16, borderRadius: 8, background: cancelModal.hoursLeft > 4 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: cancelModal.hoursLeft > 4 ? '#10b981' : '#ef4444', marginBottom: 16, fontSize: '0.9rem' }}>
                                <strong>Lưu ý quan trọng:</strong><br />
                                {cancelModal.hoursLeft > 4 
                                    ? "Bạn đang hủy sân trước 4 giờ. Bạn sẽ ĐƯỢC HOÀN TIỀN 100% về ví/tài khoản." 
                                    : "Bạn đang hủy sân TRONG VÒNG 4 GIỜ trước khi diễn ra trận đấu. Theo chính sách, bạn KHÔNG ĐƯỢC HOÀN TIỀN."}
                            </div>
                        )}
                        {cancelModal.booking?.status === 'pending' && (
                            <div style={{ padding: 16, borderRadius: 8, background: 'rgba(245,158,11,0.15)', color: '#f59e0b', marginBottom: 16, fontSize: '0.9rem' }}>
                                Booking chưa thanh toán. Bạn có thể an tâm hủy mà không mất phí.
                            </div>
                        )}
                        <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>Bạn có chắc chắn muốn hủy đặt sân <strong>{cancelModal.booking?.court_name}</strong> lúc {formatTime(cancelModal.booking?.start_time)} ngày {formatDate(cancelModal.booking?.booking_date)} không?</p>
                        
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
                            <BackButton onClick={() => setCancelModal({ open: false, booking: null, hoursLeft: 0 })} />
                            <button className="btn btn-primary" style={{ background: '#ef4444', border: 'none' }} onClick={confirmCancel}>Xác nhận hủy</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Enhanced Transfer Modal */}
            {transferModal.open && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="glass-card" style={{ width: '100%', maxWidth: 450, padding: 24, border: '1px solid rgba(255,255,255,0.1)' }}>
                        <h3 style={{ marginTop: 0, marginBottom: 16, color: '#fff' }}>🔄 Chuyển nhượng lịch đặt</h3>
                        <div style={{ padding: 16, borderRadius: 8, background: 'rgba(59,130,246,0.15)', color: '#3b82f6', marginBottom: 16, fontSize: '0.85rem' }}>
                            Email người nhận phải là tài khoản hợp lệ trong hệ thống. Lời mời sẽ có hiệu lực trong 15 phút.
                        </div>
                        
                        {transferModal.step === 1 ? (
                            <>
                                <div style={{ marginBottom: 16 }}>
                                    <label style={{ display: 'block', marginBottom: 8, fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>Email người nhận</label>
                                    <input 
                                        type="email" 
                                        className="input-field" 
                                        style={{ width: '100%', padding: '10px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
                                        placeholder="nguyenvana@gmail.com" 
                                        value={transferModal.email}
                                        onChange={e => setTransferModal(p => ({ ...p, email: e.target.value }))}
                                        disabled={transferModal.checking}
                                    />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
                                    <button className="btn btn-secondary" disabled={transferModal.checking} onClick={() => setTransferModal({ open: false, booking: null, step: 1, email: '', targetUser: null, checking: false })}>Hủy thao tác</button>
                                    <button className="btn btn-primary" disabled={transferModal.checking} onClick={handleCheckEmail}>
                                        {transferModal.checking ? 'Đang kiểm tra...' : 'Tiếp tục ➔'}
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <div style={{ background: 'rgba(255,255,255,0.05)', padding: 16, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0' }}>
                                    <img 
                                        src={transferModal.targetUser?.avatar || `https://ui-avatars.com/api/?name=${transferModal.targetUser?.full_name || 'User'}`} 
                                        alt="avatar" 
                                        style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }}
                                    />
                                    <div>
                                        <div style={{ fontWeight: 700, color: '#fff' }}>{transferModal.targetUser?.full_name}</div>
                                        <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>{transferModal.targetUser?.email}</div>
                                    </div>
                                </div>
                                <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)' }}>Bạn sẽ gửi lời mời nhượng sân <strong>{transferModal.booking?.court_name}</strong> cho người này?</p>
                                
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
                                    <BackButton onClick={() => setTransferModal(p => ({ ...p, step: 1, targetUser: null }))} />
                                    <button className="btn btn-primary" onClick={confirmTransfer}>Gửi lời mời</button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
