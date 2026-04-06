import { useState, useEffect } from 'react'
import api from '../api/axios'
import styles from '../styles/Dashboard.module.css'

interface Report {
    id: number
    reporter_id: number
    reporter_name: string
    reporter_email: string
    report_type: string
    report_target_id: number | null
    report_target_type: string | null
    description: string
    evidence_urls: string | null
    status: 'pending' | 'investigating' | 'resolved' | 'rejected'
    admin_note: string | null
    resolved_by_name: string | null
    created_at: string
    updated_at: string
}

export default function AdminReports() {
    const [reports, setReports] = useState<Report[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedStatus, setSelectedStatus] = useState<string>('all')
    const [selectedType, setSelectedType] = useState<string>('all')
    const [page, setPage] = useState(1)
    const [total, setTotal] = useState(0)
    const [selectedReport, setSelectedReport] = useState<Report | null>(null)
    const [updateNote, setUpdateNote] = useState('')
    const [updateStatus, setUpdateStatus] = useState<string>('pending')
    const [updating, setUpdating] = useState(false)

    useEffect(() => {
        loadReports()
    }, [page, selectedStatus, selectedType])

    // Auto-refresh reports every 10 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            loadReports()
        }, 10000)
        return () => clearInterval(interval)
    }, [])

    const loadReports = async () => {
        try {
            setLoading(true)
            const params = new URLSearchParams()
            params.append('page', page.toString())
            if (selectedStatus !== 'all') params.append('status', selectedStatus)
            if (selectedType !== 'all') params.append('report_type', selectedType)

            const res = await api.get(`/reports?${params}`)
            setReports(res.data.data || [])
            setTotal(res.data.total || 0)
        } catch (err) {
            console.error('Failed to load reports:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleUpdateReport = async (reportId: number) => {
        try {
            setUpdating(true)
            await api.put(`/reports/${reportId}`, {
                status: updateStatus,
                admin_note: updateNote
            })
            setSelectedReport(null)
            setUpdateNote('')
            setUpdateStatus('pending')
            await loadReports()
        } catch (err) {
            console.error('Failed to update report:', err)
        } finally {
            setUpdating(false)
        }
    }

    const handleDeleteReport = async (reportId: number) => {
        if (!confirm('Bạn có chắc muốn xóa báo cáo này?')) return
        try {
            await api.delete(`/reports/${reportId}`)
            await loadReports()
        } catch (err) {
            console.error('Failed to delete report:', err)
        }
    }

    const handleReportSubmitted = () => {
        setPage(1)
        loadReports()
    }

    const getReportTypeIcon = (type: string) => {
        const icons: { [key: string]: string } = {
            account: '👤',
            post: '📝',
            impostor: '🎭',
            court: '🏟️',
            other: '❓'
        }
        return icons[type] || '❔'
    }

    const getReportTypeLabel = (type: string) => {
        const labels: { [key: string]: string } = {
            account: 'Tài khoản vi phạm',
            post: 'Bài viết vi phạm',
            impostor: 'Tài khoản giả mạo',
            court: 'Sân không đạt chuẩn',
            other: 'Khác'
        }
        return labels[type] || type
    }

    const getStatusColor = (status: string) => {
        const colors: { [key: string]: string } = {
            pending: 'var(--accent-yellow)',
            investigating: 'var(--accent-blue)',
            resolved: 'var(--accent-green)',
            rejected: 'var(--accent-red)'
        }
        return colors[status] || 'var(--text-secondary)'
    }

    const getStatusLabel = (status: string) => {
        const labels: { [key: string]: string } = {
            pending: '⏳ Chờ xử lý',
            investigating: '🔍 Đang xem xét',
            resolved: '✅ Đã giải quyết',
            rejected: '❌ Từ chối'
        }
        return labels[status] || status
    }

    if (loading && reports.length === 0) {
        return <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>⏳ Đang tải...</div>
    }

    const totalPages = Math.ceil(total / 20)
    const statusOptions = ['all', 'pending', 'investigating', 'resolved', 'rejected']
    const typeOptions = ['all', 'account', 'post', 'impostor', 'court', 'other']

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                    <h2 className="page-title" style={{ marginBottom: '8px' }}>Quản lý báo cáo người dùng</h2>
                    <p className="page-subtitle" style={{ marginBottom: 0 }}>Tổng {total} báo cáo</p>
                </div>
                <button
                    onClick={loadReports}
                    disabled={loading}
                    style={{
                        padding: '8px 16px',
                        background: 'var(--accent-blue)',
                        color: 'white',
                        border: 'none',
                        borderRadius: 'var(--radius-md)',
                        fontWeight: 600,
                        cursor: loading ? 'not-allowed' : 'pointer',
                        opacity: loading ? 0.6 : 1,
                        fontSize: '0.9rem'
                    }}
                >
                    {loading ? 'Đang tải...' : 'Tải lại'}
                </button>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
                <select
                    value={selectedStatus}
                    onChange={(e) => { setSelectedStatus(e.target.value); setPage(1) }}
                    style={{
                        padding: '8px 12px',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        fontSize: '0.9rem',
                        cursor: 'pointer'
                    }}
                >
                    {statusOptions.map(opt => (
                        <option key={opt} value={opt}>
                            {opt === 'all' ? 'Toàn bộ trạng thái' : getStatusLabel(opt)}
                        </option>
                    ))}
                </select>

                <select
                    value={selectedType}
                    onChange={(e) => { setSelectedType(e.target.value); setPage(1) }}
                    style={{
                        padding: '8px 12px',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        fontSize: '0.9rem',
                        cursor: 'pointer'
                    }}
                >
                    {typeOptions.map(opt => (
                        <option key={opt} value={opt}>
                            {opt === 'all' ? 'Toàn bộ loại báo cáo' : `${getReportTypeIcon(opt)} ${getReportTypeLabel(opt)}`}
                        </option>
                    ))}
                </select>
            </div>

            {/* Reports List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {reports.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
                        Không có báo cáo nào
                    </div>
                ) : (
                    reports.map((report, idx) => (
                        <div
                            key={report.id}
                            className="glass-card"
                            style={{
                                padding: '16px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                borderLeft: `4px solid ${getStatusColor(report.status)}`,
                                animation: `fadeInUp 0.3s ease ${idx * 0.05}s both`
                            }}
                            onClick={() => {
                                setSelectedReport(report)
                                setUpdateStatus(report.status)
                                setUpdateNote(report.admin_note || '')
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                        <span style={{ fontSize: '1.1rem' }}>{getReportTypeIcon(report.report_type)}</span>
                                        <span style={{ fontWeight: 600 }}>{getReportTypeLabel(report.report_type)}</span>
                                        <span style={{
                                            fontSize: '0.75rem',
                                            background: getStatusColor(report.status),
                                            color: 'white',
                                            padding: '2px 8px',
                                            borderRadius: 'var(--radius-sm)',
                                            opacity: 0.8
                                        }}>
                                            {getStatusLabel(report.status)}
                                        </span>
                                    </div>
                                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '8px' }}>
                                        Người báo cáo: <strong>{report.reporter_name}</strong> ({report.reporter_email})
                                    </div>
                                    <div style={{ color: 'var(--text-primary)', lineHeight: '1.4', marginBottom: '8px' }}>
                                        {report.description}
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
                                        {new Date(report.created_at).toLocaleString('vi-VN')}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '20px' }}>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                        <button
                            key={p}
                            onClick={() => setPage(p)}
                            style={{
                                padding: '8px 12px',
                                background: page === p ? 'var(--accent-blue)' : 'var(--bg-secondary)',
                                color: page === p ? 'white' : 'var(--text-primary)',
                                border: 'none',
                                borderRadius: 'var(--radius-md)',
                                cursor: 'pointer',
                                fontWeight: page === p ? 600 : 400
                            }}
                        >
                            {p}
                        </button>
                    ))}
                </div>
            )}

            {/* Detail Modal */}
            {selectedReport && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0,0,0,0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000
                    }}
                    onClick={() => setSelectedReport(null)}
                >
                    <div
                        className="glass-card"
                        style={{
                            maxWidth: '600px',
                            width: '90%',
                            maxHeight: '80vh',
                            overflow: 'auto',
                            padding: '24px'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Chi tiết báo cáo #{selectedReport.id}</h3>
                            <button
                                onClick={() => setSelectedReport(null)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    fontSize: '1.5rem',
                                    cursor: 'pointer',
                                    color: 'var(--text-secondary)'
                                }}
                            >
                                ✕
                            </button>
                        </div>

                        {/* Report Info */}
                        <div style={{ marginBottom: '20px' }}>
                            <div style={{ marginBottom: '12px' }}>
                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Loại báo cáo:</div>
                                <div style={{ fontWeight: 600 }}>
                                    {getReportTypeIcon(selectedReport.report_type)} {getReportTypeLabel(selectedReport.report_type)}
                                </div>
                            </div>
                            <div style={{ marginBottom: '12px' }}>
                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Người báo cáo:</div>
                                <div style={{ fontWeight: 600 }}>{selectedReport.reporter_name} ({selectedReport.reporter_email})</div>
                            </div>
                            <div style={{ marginBottom: '12px' }}>
                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Mô tả:</div>
                                <div style={{ whiteSpace: 'pre-wrap' }}>{selectedReport.description}</div>
                            </div>
                            {selectedReport.evidence_urls && (
                                <div style={{ marginBottom: '12px' }}>
                                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Chứng cứ:</div>
                                    <a href={selectedReport.evidence_urls} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-blue)' }}>
                                        View Evidence
                                    </a>
                                </div>
                            )}
                        </div>

                        {/* Update Form */}
                        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                            <div style={{ marginBottom: '12px' }}>
                                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600 }}>Trạng thái</label>
                                <select
                                    value={updateStatus}
                                    onChange={(e) => setUpdateStatus(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '8px',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: 'var(--radius-md)',
                                        background: 'var(--bg-secondary)',
                                        color: 'var(--text-primary)'
                                    }}
                                >
                                    <option value="pending">⏳ Chờ xử lý</option>
                                    <option value="investigating">🔍 Đang xem xét</option>
                                    <option value="resolved">✅ Đã giải quyết</option>
                                    <option value="rejected">❌ Từ chối</option>
                                </select>
                            </div>

                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600 }}>Ghi chú của admin</label>
                                <textarea
                                    value={updateNote}
                                    onChange={(e) => setUpdateNote(e.target.value)}
                                    placeholder="Nhập ghi chú..."
                                    style={{
                                        width: '100%',
                                        padding: '8px',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: 'var(--radius-md)',
                                        background: 'var(--bg-secondary)',
                                        color: 'var(--text-primary)',
                                        minHeight: '80px',
                                        fontFamily: 'inherit',
                                        boxSizing: 'border-box'
                                    }}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    onClick={() => handleUpdateReport(selectedReport.id)}
                                    disabled={updating}
                                    style={{
                                        flex: 1,
                                        padding: '10px',
                                        background: 'var(--accent-blue)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: 'var(--radius-md)',
                                        fontWeight: 600,
                                        cursor: updating ? 'not-allowed' : 'pointer',
                                        opacity: updating ? 0.6 : 1
                                    }}
                                >
                                    {updating ? '⏳ Cập nhật...' : '💾 Cập nhật'}
                                </button>
                                <button
                                    onClick={() => handleDeleteReport(selectedReport.id)}
                                    style={{
                                        padding: '10px 16px',
                                        background: 'var(--accent-red)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: 'var(--radius-md)',
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                    }}
                                >
                                    🗑️ Xóa
                                </button>
                                <button
                                    onClick={() => setSelectedReport(null)}
                                    style={{
                                        padding: '10px 16px',
                                        background: 'var(--bg-secondary)',
                                        color: 'var(--text-primary)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: 'var(--radius-md)',
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                    }}
                                >
                                    Đóng
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
