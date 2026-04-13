import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useDialog } from '../context/DialogContext'
import { createSocket } from '../api/socket'
import api from '../api/axios'

interface Report {
  id: number
  report_type: string
  report_target_id: number
  report_target_type: string
  description: string
  evidence_url?: string
  status: 'pending' | 'investigating' | 'resolved' | 'rejected'
  admin_note?: string
  created_at?: string
  updated_at?: string
}

export default function MyReports() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { showAlert } = useDialog()
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'investigating' | 'resolved' | 'rejected'>('all')
  const [updatedReportId, setUpdatedReportId] = useState<number | null>(null)

  useEffect(() => {
    if (!user) {
      navigate('/login')
      return
    }
    fetchReports()

    // Setup socket for real-time reports
    const socket = createSocket()
    
    // Kết nối và join room khi socket sẵn sàng
    if (socket.connected) {
      console.log('✅ Socket đã kết nối:', socket.id)
      console.log('📤 Emit join_reports với user ID:', user.id)
      socket.emit('join_reports', user.id)
    }

    socket.on('connect', () => {
      console.log('✅ Socket vừa kết nối:', socket.id)
      console.log('📤 Emit join_reports với user ID:', user.id)
      socket.emit('join_reports', user.id)
    })

    socket.on('disconnect', () => {
      console.log('❌ Socket ngắt kết nối')
    })

    // Lắng nghe cập nhật báo cáo real-time
    socket.on('report_status_updated', (data) => {
      console.log('📬 Báo cáo được cập nhật từ socket:', data)
      setReports(prevReports =>
        prevReports.map(r =>
          r.id === parseInt(data.id) ? { ...r, status: data.status, admin_note: data.admin_note, updated_at: data.updated_at } : r
        )
      )
      // Highlight cái vừa được cập nhật
      setUpdatedReportId(parseInt(data.id))
      setTimeout(() => setUpdatedReportId(null), 2000)
    })

    socket.on('error', (error) => {
      console.error('❌ Socket lỗi:', error)
    })

    // Cleanup khi component unmount
    return () => {
      console.log('🧹 Đóng socket connection')
      if (socket.connected) {
        socket.emit('leave_reports', user.id)
      }
      socket.off('report_status_updated')
      socket.off('connect')
      socket.off('disconnect')
      socket.off('error')
      socket.disconnect()
    }
  }, [user, navigate])

  const fetchReports = async () => {
    try {
      setLoading(true)
      const res = await api.get('/reports/my-reports')
      setReports(res.data)
    } catch (err: any) {
      console.error('Error fetching reports:', err)
      showAlert('Lỗi khi tải báo cáo của bạn')
    } finally {
      setLoading(false)
    }
  }

  const filteredReports = filter === 'all' ? reports : reports.filter(r => r.status === filter)

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#FFA500' // Orange
      case 'investigating': return '#1E90FF' // Blue
      case 'resolved': return '#00AA00' // Green
      case 'rejected': return '#FF4444' // Red
      default: return '#999'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return '⏳ Đang chờ'
      case 'investigating': return '🔍 Đang xử lý'
      case 'resolved': return '✅ Đã giải quyết'
      case 'rejected': return '❌ Bị từ chối'
      default: return status
    }
  }

  const getReportTypeLabel = (type: string) => {
    const labels: { [key: string]: string } = {
      account: '👤 Tài khoản vi phạm',
      post: '📝 Bài viết vi phạm',
      impostor: '🎭 Tài khoản giả mạo',
      court: '🏸 Sân không đạt chuẩn',
      other: '❓ Khác'
    }
    return labels[type] || type
  }

  if (!user) return null

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '20px' }}>
      {/* Animation styles */}
      <style>{`
        @keyframes updatePulse {
          0% { box-shadow: 0 0 0 0 rgba(30, 144, 255, 0.4); }
          50% { box-shadow: 0 0 0 10px rgba(30, 144, 255, 0); }
          100% { box-shadow: 0 0 0 0 rgba(30, 144, 255, 0); }
        }
        .report-updated {
          animation: updatePulse 0.6s;
        }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: '0 0 8px 0', fontSize: '1.8rem' }}>📋 Báo Cáo Của Tôi</h1>
          <p style={{ margin: '0', color: '#999', fontSize: '0.95rem' }}>
            Theo dõi những báo cáo bạn đã gửi
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '20px',
        flexWrap: 'wrap'
      }}>
        {(['all', 'pending', 'investigating', 'resolved', 'rejected'] as const).map(status => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            style={{
              padding: '8px 14px',
              border: 'none',
              borderRadius: '6px',
              background: filter === status ? 'var(--accent-blue)' : 'var(--bg-secondary)',
              color: filter === status ? '#fff' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontWeight: filter === status ? 600 : 500,
              fontSize: '0.9rem',
              transition: 'all 0.2s'
            }}
          >
            {status === 'all' ? '📊 Tất cả' : getStatusLabel(status)}
          </button>
        ))}
      </div>

      {/* Reports List */}
      {loading ? (
        <div style={{
          textAlign: 'center',
          padding: '40px 20px',
          color: 'var(--text-secondary)'
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '12px' }}>⏳</div>
          <div>Đang tải báo cáo...</div>
        </div>
      ) : filteredReports.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '40px 20px',
          background: 'var(--bg-secondary)',
          borderRadius: '8px',
          color: 'var(--text-secondary)'
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '12px' }}>📭</div>
          <div>Không có báo cáo nào</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredReports.map((report) => (
            <div
              key={report.id}
              className={updatedReportId === report.id ? 'report-updated' : ''}
              style={{
                background: 'var(--bg-secondary)',
                border: `2px solid ${getStatusColor(report.status)}`,
                borderRadius: '8px',
                padding: '16px',
                opacity: report.status === 'rejected' ? 0.7 : 1,
                transition: 'all 0.3s ease'
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '4px' }}>
                    {getReportTypeLabel(report.report_type)}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                    #{report.id} • {report.created_at ? new Date(report.created_at).toLocaleDateString('vi-VN') : ''}
                  </div>
                </div>
                <div style={{
                  background: getStatusColor(report.status),
                  color: '#fff',
                  padding: '6px 12px',
                  borderRadius: '4px',
                  fontSize: '0.9rem',
                  fontWeight: 600
                }}>
                  {getStatusLabel(report.status)}
                </div>
              </div>

              {/* Description */}
              <div style={{
                background: 'var(--bg-primary)',
                padding: '10px 12px',
                borderRadius: '4px',
                marginBottom: '12px',
                fontSize: '0.9rem',
                lineHeight: 1.5,
                color: 'var(--text-secondary)'
              }}>
                {report.description}
              </div>

              {/* Evidence */}
              {report.evidence_url && (
                <div style={{ marginBottom: '12px' }}>
                  <div style={{
                    position: 'relative',
                    maxHeight: '150px',
                    maxWidth: '100%',
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden',
                    background: 'var(--bg-primary)',
                    display: 'inline-block'
                  }}>
                    {report.evidence_url.match(/\.(jpeg|jpg|gif|png|webp)/i) || report.evidence_url.includes('image/upload') ? (
                        <a href={report.evidence_url} target="_blank" rel="noreferrer" title="Click để xem đầy đủ">
                            <img 
                                src={report.evidence_url} 
                                alt="Bằng chứng" 
                                style={{ maxHeight: '150px', objectFit: 'contain', display: 'block' }} 
                            />
                        </a>
                    ) : report.evidence_url.match(/\.(mp4|webm|avi)/i) || report.evidence_url.includes('video/upload') ? (
                        <video 
                            src={report.evidence_url} 
                            controls 
                            preload="metadata"
                            style={{ maxHeight: '150px', maxWidth: '100%', display: 'block' }} 
                        />
                    ) : (
                        <a 
                            href={report.evidence_url} 
                            target="_blank" 
                            rel="noreferrer" 
                            style={{ 
                                color: 'white', 
                                background: 'var(--accent-blue)', 
                                padding: '6px 12px', 
                                borderRadius: 'var(--radius-md)', 
                                display: 'inline-flex',
                                alignItems: 'center',
                                textDecoration: 'none',
                                fontWeight: 600,
                                fontSize: '0.85rem'
                            }}
                        >
                            🔗 Xem Bằng Chứng
                        </a>
                    )}
                  </div>
                </div>
              )}

              {/* Admin Note */}
              {report.admin_note && (
                <div style={{
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  padding: '10px 12px',
                  borderRadius: '4px',
                  marginBottom: '12px',
                  fontSize: '0.9rem',
                  color: 'var(--text-secondary)'
                }}>
                  <div style={{ fontWeight: 600, marginBottom: '4px', color: 'var(--accent-blue)' }}>
                    💬 Ghi chú từ Admin:
                  </div>
                  {report.admin_note}
                </div>
              )}

              {/* Timeline */}
              <div style={{
                display: 'flex',
                gap: '16px',
                fontSize: '0.8rem',
                color: 'var(--text-tertiary)',
                paddingTop: '8px',
                borderTop: '1px solid var(--border-color)'
              }}>
                <div>
                  📅 Gửi: {report.created_at ? new Date(report.created_at).toLocaleString('vi-VN') : ''}
                </div>
                {report.updated_at && (
                  <div>
                    🔄 Cập nhật: {new Date(report.updated_at).toLocaleString('vi-VN')}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  )
}
