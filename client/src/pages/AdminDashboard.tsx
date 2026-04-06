import { useState, useEffect } from 'react'
import api from '../api/axios'
import { useDialog } from '../context/DialogContext'
import styles from '../styles/Dashboard.module.css'
import pageStyles from '../styles/AdminDashboardPage.module.css'

export default function AdminDashboard() {
    const { showAlert, showConfirm } = useDialog()
    const [requestTab, setRequestTab] = useState('pending')
    const [stats, setStats] = useState(null)
    const [requests, setRequests] = useState([])
    const [loading, setLoading] = useState(true)
    const [showRejectModal, setShowRejectModal] = useState(false)
    const [rejectData, setRejectData] = useState({ reqId: null, isRevoke: false, userInfo: null })
    const [rejectReason, setRejectReason] = useState('')
    const [showLicenseModal, setShowLicenseModal] = useState(false)
    const [selectedLicense, setSelectedLicense] = useState<{ url: string; name: string } | null>(null)

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
        const isConfirm = await showConfirm('Xác nhận', confirmMsg)
        if (!isConfirm) return
        try {
            await api.put(`/admin/upgrade-requests/${reqId}/approve`)
            await showAlert('Thành công', '✅ Đã duyệt thành công!')
            loadData()
        } catch (err: any) {
            await showAlert('Lỗi', err.response?.data?.message || 'Lỗi duyệt')
        }
    }

    const openRejectModal = (reqId, isRevoke = false) => {
        const request = requests.find(r => r.id === reqId)
        setRejectData({ reqId, isRevoke, userInfo: request })
        setRejectReason('')
        setShowRejectModal(true)
    }

    const openLicenseViewer = async (reqId: number, ownerName: string) => {
        try {
            setSelectedLicense(null); // Reset
            setShowLicenseModal(true);

            // Xử lý loading và fetch Base64 từ API
            const res = await api.get(`/admin/upgrade-requests/${reqId}/license`);

            // Hiển thị modal với Base64 Image
            setSelectedLicense({ url: res.data.dataUrl, name: ownerName });
            console.log(res.data.dataUrl);
        } catch (error) {
            console.error("Lỗi khi tải file:", error);
            await showAlert('Lỗi', "Không thể tải file giấy phép từ server (File không tồn tại hoặc lỗi server).");
            setShowLicenseModal(false);
        }
    }

    const handleReject = async () => {
        try {
            await api.put(`/admin/upgrade-requests/${rejectData.reqId}/reject`, {
                admin_note: rejectReason.trim() || null
            })
            await showAlert('Thành công', rejectData.isRevoke ? '✅ Đã thu hồi quyền Owner!' : '✅ Đã từ chối yêu cầu!')
            setShowRejectModal(false)
            setRejectReason('')
            loadData()
        } catch (err: any) {
            await showAlert('Lỗi', err.response?.data?.message || 'Lỗi từ chối')
        }
    }

    const formatPrice = (p) => new Intl.NumberFormat('vi-VN').format(p) + 'đ'
    const formatDate = (d) => new Date(d).toLocaleDateString('vi-VN')

    if (loading) return <div className={`${styles.dashboardPage} ${pageStyles.loadingState}`}>⏳ Đang tải...</div>

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
            <div className={styles.dashboardContainer}>
                <div className={styles.dashboardHeader}>
                    <h1 className={styles.dashboardTitle}>⚡ Admin Dashboard</h1>
                    <p className={styles.dashboardSubtitle}>Quản trị hệ thống PickleBall Đà Nẵng</p>
                </div>

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
                    {/* Owner Requests */}
                    <div className={`glass-card ${styles.contentFullWidth}`}>
                        <h3 className={styles.sectionTitle}>📋 Yêu cầu Owner</h3>

                        <div className={`${styles.tabBar} ${pageStyles.adminTabBar}`}>
                            {[
                                { key: 'pending', label: `⏳ Chờ duyệt (${requests.filter(r => r.status === 'pending').length})` },
                                { key: 'approved', label: `✅ Đã duyệt (${requests.filter(r => r.status === 'approved').length})` },
                                { key: 'rejected', label: `❌ Từ chối (${requests.filter(r => r.status === 'rejected').length})` }
                            ].map(t => (
                                <button
                                    key={t.key}
                                    className={`${styles.tabButton} ${requestTab === t.key ? styles.tabButtonActive : ''}`}
                                    onClick={() => setRequestTab(t.key)}
                                >
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
                                        {req.phone && <span className={pageStyles.phoneInline}>📱 {req.phone}</span>}
                                    </div>
                                    <div className={styles.requestDate}>
                                        📅 {formatDate(req.created_at)}
                                    </div>
                                    {req.reason && (
                                        <div className={pageStyles.requestReasonBox}>
                                            <strong className={pageStyles.requestReasonLabel}>Lý do:</strong> {req.reason}
                                        </div>
                                    )}
                                    {req.admin_note && requestTab !== 'pending' && (
                                        <div className={pageStyles.requestAdminNoteBox}>
                                            <strong className={pageStyles.requestAdminNoteLabel}>Ghi chú Admin:</strong> {req.admin_note}
                                        </div>
                                    )}
                                </div>
                                {requestTab === 'pending' && (
                                    <div className={styles.requestActions}>
                                        {req.has_license === 1 && (
                                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => openLicenseViewer(req.id, req.full_name)}>
                                                👁️ Xem giấy phép
                                            </button>
                                        )}
                                        <button type="button" className="btn btn-primary btn-sm" onClick={() => handleApprove(req.id)}>
                                            ✅ Duyệt
                                        </button>
                                        <button type="button" className="btn btn-danger btn-sm" onClick={() => openRejectModal(req.id)}>
                                            ❌ Từ chối
                                        </button>
                                    </div>
                                )}
                                {requestTab === 'approved' && (
                                    <div className={styles.requestActions}>
                                        {req.has_license === 1 && (
                                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => openLicenseViewer(req.id, req.full_name)}>
                                                👁️ Xem giấy phép
                                            </button>
                                        )}
                                        <span className={`badge badge-green ${pageStyles.statusBadgeMargin}`}>Đã duyệt</span>
                                        <button type="button" className="btn btn-danger btn-sm" onClick={() => openRejectModal(req.id, true)}>
                                            🔒 Thu hồi
                                        </button>
                                    </div>
                                )}
                                {requestTab === 'rejected' && (
                                    <div className={styles.requestActions}>
                                        {req.has_license === 1 && (
                                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => openLicenseViewer(req.id, req.full_name)}>
                                                👁️ Xem giấy phép
                                            </button>
                                        )}
                                        <span className={`badge badge-red ${pageStyles.statusBadgeMargin}`}>Đã từ chối</span>
                                        <button type="button" className="btn btn-primary btn-sm" onClick={() => handleApprove(req.id, true)}>
                                            ✅ Duyệt lại
                                        </button>
                                    </div>
                                )}
                            </div>
                        )) : (
                            <p className={pageStyles.emptyRequestsText}>
                                Không có yêu cầu nào
                            </p>
                        )}
                    </div>

                    {/* Platform Activity */}
                    <div className="glass-card">
                        <h3 className={styles.sectionTitle}>📈 Tổng quan hệ thống</h3>
                        <div className={pageStyles.overviewList}>
                            <div className={pageStyles.overviewRow}>
                                <span className={pageStyles.overviewLabel}>Booking hôm nay</span>
                                <span className={pageStyles.overviewValue}>{stats?.today_bookings || 0}</span>
                            </div>
                            <div className={pageStyles.overviewRow}>
                                <span className={pageStyles.overviewLabel}>Trận ghép hôm nay</span>
                                <span className={pageStyles.overviewValue}>{stats?.today_matches || 0}</span>
                            </div>
                            <div className={pageStyles.overviewRow}>
                                <span className={pageStyles.overviewLabel}>Tổng người dùng</span>
                                <span className={pageStyles.overviewValue}>{stats?.total_users || 0}</span>
                            </div>
                            <div className={pageStyles.overviewRow}>
                                <span className={pageStyles.overviewLabel}>Tổng hoa hồng</span>
                                <span className={pageStyles.overviewValueRevenue}>{formatPrice(stats?.total_revenue || 0)}</span>
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

            {/* Reject Modal */}
            {showRejectModal && (
                <div className={pageStyles.overlay}>
                    <div className={`glass-card ${pageStyles.modalCard}`}>
                        <h3 className={pageStyles.modalTitle}>
                            {rejectData.isRevoke ? '🔒 Thu hồi quyền Owner' : '❌ Từ chối yêu cầu'}
                        </h3>
                        <p className={pageStyles.modalDesc}>
                            {rejectData.isRevoke
                                ? `Thu hồi quyền Owner của ${rejectData.userInfo?.full_name}?`
                                : `Từ chối yêu cầu nâng cấp Owner của ${rejectData.userInfo?.full_name}?`
                            }
                        </p>

                        {/* User Info */}
                        {rejectData.userInfo && (
                            <div className={pageStyles.userInfoBox}>
                                <div className={pageStyles.userInfoNameRow}>
                                    <strong className={pageStyles.userInfoName}>👤 {rejectData.userInfo.full_name}</strong>
                                </div>
                                <div className={pageStyles.userInfoText}>
                                    📧 {rejectData.userInfo.email}
                                </div>
                                {rejectData.userInfo.phone && (
                                    <div className={pageStyles.userInfoText}>
                                        📱 {rejectData.userInfo.phone}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className={`input-group ${pageStyles.inputGroup}`}>
                            <label className={pageStyles.inputLabel}>
                                Lý do {rejectData.isRevoke ? 'thu hồi' : 'từ chối'} (tùy chọn)
                            </label>
                            <textarea
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder={rejectData.isRevoke
                                    ? "VD: Vi phạm chính sách nền tảng, không hoạt động..."
                                    : "VD: Thiếu giấy tờ hợp lệ, thông tin chưa rõ ràng..."}
                                rows={4}
                                className={pageStyles.noteTextarea}
                            />
                            <p className={pageStyles.inputHint}>
                                ⚠️ Lý do này sẽ được gửi đến email của người dùng
                            </p>
                        </div>

                        <div className={pageStyles.modalActions}>
                            <button
                                className={`btn btn-secondary ${pageStyles.minButton}`}
                                onClick={() => {
                                    setShowRejectModal(false)
                                    setRejectReason('')
                                }}
                            >
                                Hủy
                            </button>
                            <button
                                className={`btn btn-danger ${pageStyles.minButton}`}
                                onClick={handleReject}
                            >
                                {rejectData.isRevoke ? '🔒 Thu hồi' : '❌ Xác nhận từ chối'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* License Viewer Modal */}
            {showLicenseModal && (
                <div className={pageStyles.licenseOverlay}>
                    {!selectedLicense ? (
                        <div className={pageStyles.licenseLoading}>
                            <div className={pageStyles.spinner}></div>
                            <p>Đang tải tệp tin...</p>
                        </div>
                    ) : (
                        <div className={pageStyles.licensePanel}>
                            {/* Header */}
                            <div className={pageStyles.licensePanelHeader}>
                                <h3 className={pageStyles.licensePanelTitle}>
                                    📄 Giấy phép kinh doanh - {selectedLicense.name}
                                </h3>
                                <button
                                    onClick={() => setShowLicenseModal(false)}
                                    className={pageStyles.closeButton}
                                >
                                    ×
                                </button>
                            </div>

                            {/* Content */}
                            <div className={pageStyles.licensePanelContent}>
                                {selectedLicense.url.startsWith('data:application/pdf') ? (
                                    <iframe
                                        src={selectedLicense.url}
                                        className={pageStyles.licenseFrame}
                                        title="Business License"
                                    />
                                ) : (
                                    <img
                                        src={selectedLicense.url}
                                        alt="Business License"
                                        className={pageStyles.licenseImage}
                                    />
                                )}

                                {/* Download hint */}
                                <div className={pageStyles.downloadHint}>
                                    <span>🔗</span>
                                    <span>Bạn có thể <a download={`license-${selectedLicense.name}`} href={selectedLicense.url} className={pageStyles.downloadLink}>tải xuống</a> để xem chi tiết hơn.</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
