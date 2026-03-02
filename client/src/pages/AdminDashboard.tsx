import { useState, useEffect } from 'react'
import api from '../api/axios'
import styles from '../styles/Dashboard.module.css'

export default function AdminDashboard() {
    const [requestTab, setRequestTab] = useState('pending')
    const [stats, setStats] = useState(null)
    const [requests, setRequests] = useState([])
    const [loading, setLoading] = useState(true)
    const [showRejectModal, setShowRejectModal] = useState(false)
    const [rejectData, setRejectData] = useState({ reqId: null, isRevoke: false, userInfo: null })
    const [rejectReason, setRejectReason] = useState('')

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

    const handleApprove = async (reqId, isReApproval = false) => {
        const confirmMsg = isReApproval 
            ? 'Xác nhận DUYỆT LẠI yêu cầu Owner đã từ chối?'
            : 'Xác nhận duyệt yêu cầu nâng cấp Owner?'
        if (!confirm(confirmMsg)) return
        try {
            await api.put(`/admin/upgrade-requests/${reqId}/approve`)
            alert('✅ Đã duyệt thành công!')
            loadData()
        } catch (err) {
            alert(err.response?.data?.message || 'Lỗi duyệt')
        }
    }

    const openRejectModal = (reqId, isRevoke = false) => {
        const request = requests.find(r => r.id === reqId)
        setRejectData({ reqId, isRevoke, userInfo: request })
        setRejectReason('')
        setShowRejectModal(true)
    }

    const handleReject = async () => {
        try {
            await api.put(`/admin/upgrade-requests/${rejectData.reqId}/reject`, { 
                admin_note: rejectReason.trim() || null 
            })
            alert(rejectData.isRevoke ? '✅ Đã thu hồi quyền Owner!' : '✅ Đã từ chối yêu cầu!')
            setShowRejectModal(false)
            setRejectReason('')
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
                                <div className={styles.requestEmail}>
                                    📧 {req.email}
                                    {req.phone && <span style={{ marginLeft: '12px' }}>📱 {req.phone}</span>}
                                </div>
                                <div className={styles.requestDate}>
                                    📅 {formatDate(req.created_at)}
                                </div>
                                {req.reason && (
                                    <div style={{ 
                                        marginTop: '8px', 
                                        padding: '8px 12px', 
                                        background: 'var(--bg-glass)', 
                                        borderRadius: 'var(--radius-sm)',
                                        fontSize: '0.85rem',
                                        color: 'var(--text-secondary)',
                                        lineHeight: '1.4'
                                    }}>
                                        <strong style={{ color: 'var(--text-primary)' }}>Lý do:</strong> {req.reason}
                                    </div>
                                )}
                                {req.admin_note && requestTab !== 'pending' && (
                                    <div style={{ 
                                        marginTop: '8px', 
                                        padding: '8px 12px', 
                                        background: 'rgba(255, 82, 82, 0.1)', 
                                        borderRadius: 'var(--radius-sm)',
                                        fontSize: '0.85rem',
                                        color: 'var(--text-secondary)',
                                        lineHeight: '1.4'
                                    }}>
                                        <strong style={{ color: '#FF5252' }}>Ghi chú Admin:</strong> {req.admin_note}
                                    </div>
                                )}
                            </div>
                            {requestTab === 'pending' && (
                                <div className={styles.requestActions}>
                                    <button className="btn btn-primary btn-sm" onClick={() => handleApprove(req.id)}>
                                        ✅ Duyệt
                                    </button>
                                    <button className="btn btn-danger btn-sm" onClick={() => openRejectModal(req.id)}>
                                        ❌ Từ chối
                                    </button>
                                </div>
                            )}
                            {requestTab === 'approved' && (
                                <div className={styles.requestActions}>
                                    <span className="badge badge-green" style={{ marginRight: '8px' }}>Đã duyệt</span>
                                    <button className="btn btn-danger btn-sm" onClick={() => openRejectModal(req.id, true)}>
                                        🔒 Thu hồi
                                    </button>
                                </div>
                            )}
                            {requestTab === 'rejected' && (
                                <div className={styles.requestActions}>
                                    <span className="badge badge-red" style={{ marginRight: '8px' }}>Đã từ chối</span>
                                    <button className="btn btn-primary btn-sm" onClick={() => handleApprove(req.id, true)}>
                                        ✅ Duyệt lại
                                    </button>
                                </div>
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

            {/* Reject Modal */}
            {showRejectModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    backdropFilter: 'blur(4px)'
                }}>
                    <div className="glass-card" style={{
                        maxWidth: '500px',
                        width: '90%',
                        padding: '32px',
                        position: 'relative',
                        animation: 'slideUp 0.3s ease'
                    }}>
                        <h3 style={{ 
                            fontSize: '1.25rem', 
                            fontWeight: 700, 
                            marginBottom: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}>
                            {rejectData.isRevoke ? '🔒 Thu hồi quyền Owner' : '❌ Từ chối yêu cầu'}
                        </h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '20px' }}>
                            {rejectData.isRevoke 
                                ? `Thu hồi quyền Owner của ${rejectData.userInfo?.full_name}?`
                                : `Từ chối yêu cầu nâng cấp Owner của ${rejectData.userInfo?.full_name}?`
                            }
                        </p>

                        {/* User Info */}
                        {rejectData.userInfo && (
                            <div style={{
                                background: 'var(--bg-glass)',
                                padding: '12px 16px',
                                borderRadius: 'var(--radius-md)',
                                marginBottom: '20px',
                                fontSize: '0.875rem'
                            }}>
                                <div style={{ marginBottom: '6px' }}>
                                    <strong style={{ color: 'var(--text-primary)' }}>👤 {rejectData.userInfo.full_name}</strong>
                                </div>
                                <div style={{ color: 'var(--text-secondary)' }}>
                                    📧 {rejectData.userInfo.email}
                                </div>
                                {rejectData.userInfo.phone && (
                                    <div style={{ color: 'var(--text-secondary)' }}>
                                        📱 {rejectData.userInfo.phone}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="input-group" style={{ marginBottom: '24px' }}>
                            <label style={{ fontWeight: 600, marginBottom: '8px', display: 'block' }}>
                                Lý do {rejectData.isRevoke ? 'thu hồi' : 'từ chối'} (tùy chọn)
                            </label>
                            <textarea
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder={rejectData.isRevoke 
                                    ? "VD: Vi phạm chính sách nền tảng, không hoạt động..." 
                                    : "VD: Thiếu giấy tờ hợp lệ, thông tin chưa rõ ràng..."}
                                rows={4}
                                style={{
                                    width: '100%',
                                    padding: '12px 16px',
                                    background: 'var(--bg-glass)',
                                    border: '1px solid var(--border-glass)',
                                    borderRadius: 'var(--radius-md)',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.9rem',
                                    resize: 'vertical',
                                    minHeight: '100px',
                                    fontFamily: 'inherit'
                                }}
                            />
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                                ⚠️ Lý do này sẽ được gửi đến email của người dùng
                            </p>
                        </div>

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button 
                                className="btn btn-secondary"
                                onClick={() => {
                                    setShowRejectModal(false)
                                    setRejectReason('')
                                }}
                                style={{ minWidth: '100px' }}
                            >
                                Hủy
                            </button>
                            <button 
                                className="btn btn-danger"
                                onClick={handleReject}
                                style={{ minWidth: '100px' }}
                            >
                                {rejectData.isRevoke ? '🔒 Thu hồi' : '❌ Xác nhận từ chối'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
