import { useState } from 'react'
import api from '../api/axios'

const notificationTypes = [
    { key: 'system', label: '🔔 Hệ thống', color: '#4FC3F7' },
    { key: 'update', label: '🆕 Cập nhật', color: '#00E676' },
    { key: 'warning', label: '⚠️ Cảnh báo', color: '#FFB74D' },
    { key: 'promo', label: '🎉 Khuyến mãi', color: '#E040FB' },
    { key: 'event', label: '🏆 Sự kiện', color: '#FFD740' },
]

const roleTargets = [
    { key: 'all', label: 'Tất cả', icon: '🌐', desc: 'Gửi cho tất cả người dùng' },
    { key: 'user', label: 'User', icon: '👤', desc: 'Chỉ gửi cho người chơi' },
    { key: 'owner', label: 'Owner', icon: '🏢', desc: 'Chỉ gửi cho chủ sân' },
]

export default function AdminNotifications() {
    const [title, setTitle] = useState('')
    const [message, setMessage] = useState('')
    const [type, setType] = useState('system')
    const [targetRole, setTargetRole] = useState('all')
    const [sending, setSending] = useState(false)
    const [resultModal, setResultModal] = useState<{ show: boolean; success: boolean; message: string }>({
        show: false, success: false, message: ''
    })

    const handleSend = async () => {
        if (!title.trim() || !message.trim()) {
            setResultModal({ show: true, success: false, message: 'Vui lòng nhập tiêu đề và nội dung thông báo' })
            return
        }

        setSending(true)
        try {
            const res = await api.post('/admin/notifications/broadcast', {
                title: title.trim(),
                message: message.trim(),
                type,
                targetRole
            })
            setResultModal({ show: true, success: true, message: res.data.message })
            setTitle('')
            setMessage('')
        } catch (err: any) {
            setResultModal({
                show: true, success: false,
                message: err.response?.data?.message || 'Lỗi gửi thông báo'
            })
        } finally {
            setSending(false)
        }
    }

    const selectedType = notificationTypes.find(t => t.key === type)
    const selectedTarget = roleTargets.find(r => r.key === targetRole)

    return (
        <div>
            <h2 className="page-title" style={{ marginBottom: '8px' }}>📢 Gửi thông báo</h2>
            <p className="page-subtitle" style={{ marginBottom: '28px' }}>
                Gửi thông báo hệ thống đến người dùng theo vai trò
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                {/* Left: Form */}
                <div className="glass-card" style={{ padding: '28px' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '20px', color: 'var(--text-primary)' }}>
                        ✏️ Soạn thông báo
                    </h3>

                    {/* Title */}
                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            Tiêu đề *
                        </label>
                        <input
                            type="text"
                            className="input-field"
                            placeholder="VD: Bảo trì hệ thống ngày 20/03"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            style={{ width: '100%' }}
                        />
                    </div>

                    {/* Message */}
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            Nội dung *
                        </label>
                        <textarea
                            className="input-field"
                            placeholder="Nhập nội dung thông báo..."
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                            rows={5}
                            style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
                        />
                    </div>

                    {/* Notification Type */}
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            Loại thông báo
                        </label>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {notificationTypes.map(t => (
                                <button
                                    key={t.key}
                                    onClick={() => setType(t.key)}
                                    style={{
                                        padding: '8px 14px',
                                        borderRadius: '20px',
                                        border: `1.5px solid ${type === t.key ? t.color : 'var(--border-glass)'}`,
                                        background: type === t.key ? `${t.color}18` : 'transparent',
                                        color: type === t.key ? t.color : 'var(--text-secondary)',
                                        cursor: 'pointer',
                                        fontSize: '0.82rem',
                                        fontWeight: type === t.key ? 600 : 400,
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Target Role */}
                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            Gửi đến
                        </label>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            {roleTargets.map(r => (
                                <button
                                    key={r.key}
                                    onClick={() => setTargetRole(r.key)}
                                    style={{
                                        flex: 1,
                                        padding: '14px 12px',
                                        borderRadius: 'var(--radius-md)',
                                        border: `1.5px solid ${targetRole === r.key ? 'var(--accent-green)' : 'var(--border-glass)'}`,
                                        background: targetRole === r.key ? 'var(--accent-green-dim)' : 'var(--bg-glass)',
                                        color: targetRole === r.key ? 'var(--accent-green)' : 'var(--text-secondary)',
                                        cursor: 'pointer',
                                        fontSize: '0.85rem',
                                        fontWeight: targetRole === r.key ? 700 : 500,
                                        transition: 'all 0.2s ease',
                                        textAlign: 'center'
                                    }}
                                >
                                    <div style={{ fontSize: '1.4rem', marginBottom: '4px' }}>{r.icon}</div>
                                    {r.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Send Button */}
                    <button
                        className="btn btn-primary"
                        onClick={handleSend}
                        disabled={sending || !title.trim() || !message.trim()}
                        style={{ width: '100%', padding: '14px', fontSize: '1rem', fontWeight: 700 }}
                    >
                        {sending ? '⏳ Đang gửi...' : '📤 Gửi thông báo'}
                    </button>
                </div>

                {/* Right: Preview */}
                <div>
                    <div className="glass-card" style={{ padding: '28px' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '20px', color: 'var(--text-primary)' }}>
                            👁️ Xem trước
                        </h3>

                        <div style={{
                            background: 'var(--bg-glass)',
                            borderRadius: 'var(--radius-md)',
                            padding: '20px',
                            border: '1px solid var(--border-glass)'
                        }}>
                            {/* Preview notification */}
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                <div style={{
                                    width: '40px', height: '40px',
                                    borderRadius: '50%',
                                    background: `${selectedType?.color || '#4FC3F7'}20`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '1.2rem', flexShrink: 0
                                }}>
                                    {selectedType?.label.split(' ')[0]}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '4px' }}>
                                        {title || 'Tiêu đề thông báo'}
                                    </div>
                                    <div style={{
                                        color: 'var(--text-secondary)', fontSize: '0.85rem',
                                        lineHeight: 1.5, whiteSpace: 'pre-wrap',
                                        wordBreak: 'break-word'
                                    }}>
                                        {message || 'Nội dung thông báo sẽ hiển thị ở đây...'}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                                        Vừa xong
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Summary card */}
                    <div className="glass-card" style={{ padding: '20px', marginTop: '16px' }}>
                        <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '12px' }}>📊 Tóm tắt</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Loại:</span>
                                <span style={{ color: selectedType?.color, fontWeight: 600 }}>
                                    {selectedType?.label}
                                </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Đối tượng:</span>
                                <span style={{ fontWeight: 600 }}>
                                    {selectedTarget?.icon} {selectedTarget?.desc}
                                </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Tiêu đề:</span>
                                <span style={{ fontWeight: 600, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {title || '—'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Result Modal */}
            {resultModal.show && (
                <div style={{
                    position: 'fixed', inset: 0,
                    background: 'rgba(0,0,0,0.7)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1001, backdropFilter: 'blur(4px)'
                }}>
                    <div className="glass-card" style={{
                        maxWidth: '400px', width: '90%', padding: '32px',
                        textAlign: 'center', animation: 'fadeInUp 0.3s ease'
                    }}>
                        <div style={{ fontSize: '3rem', marginBottom: '16px' }}>
                            {resultModal.success ? '✅' : '❌'}
                        </div>
                        <p style={{
                            fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '24px',
                            color: resultModal.success ? 'var(--text-primary)' : 'var(--accent-red)'
                        }}>
                            {resultModal.message}
                        </p>
                        <button
                            className="btn btn-primary"
                            onClick={() => setResultModal({ show: false, success: false, message: '' })}
                            style={{ minWidth: '120px' }}
                        >
                            Đóng
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
