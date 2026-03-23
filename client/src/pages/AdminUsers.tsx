import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api/axios'
import styles from '../styles/Dashboard.module.css'

export default function AdminUsers() {
    const [users, setUsers] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [roleFilter, setRoleFilter] = useState('all')
    const navigate = useNavigate()

    // Modal states
    const [showConfirm, setShowConfirm] = useState(false)
    const [confirmData, setConfirmData] = useState<{ userId: number; userName: string; action: 'ban' | 'unban' } | null>(null)
    const [processing, setProcessing] = useState(false)
    const [resultModal, setResultModal] = useState<{ show: boolean; success: boolean; message: string }>({ show: false, success: false, message: '' })

    useEffect(() => {
        loadUsers()
    }, [])

    const loadUsers = async () => {
        try {
            const res = await api.get('/admin/users')
            setUsers(res.data)
        } catch (err) {
            console.error('Failed to load users:', err)
        } finally {
            setLoading(false)
        }
    }

    const openConfirmModal = (userId: number, userName: string, currentStatus: string) => {
        setConfirmData({
            userId,
            userName,
            action: currentStatus === 'active' ? 'ban' : 'unban'
        })
        setShowConfirm(true)
    }

    const handleConfirm = async () => {
        if (!confirmData) return
        setProcessing(true)
        const newStatus = confirmData.action === 'ban' ? 'banned' : 'active'

        try {
            await api.put(`/admin/users/${confirmData.userId}/status`, { status: newStatus })
            setUsers(prev => prev.map(u => u.id === confirmData.userId ? { ...u, status: newStatus } : u))
            setShowConfirm(false)
            setResultModal({
                show: true,
                success: true,
                message: confirmData.action === 'ban'
                    ? `✅ Đã ban tài khoản "${confirmData.userName}" thành công!`
                    : `✅ Đã bỏ ban tài khoản "${confirmData.userName}" thành công!`
            })
        } catch (err: any) {
            setShowConfirm(false)
            setResultModal({
                show: true,
                success: false,
                message: err.response?.data?.message || 'Lỗi cập nhật trạng thái'
            })
        } finally {
            setProcessing(false)
        }
    }

    const formatDate = (d: string) => new Date(d).toLocaleDateString('vi-VN')

    const filtered = users.filter(u => {
        const matchSearch = !search ||
            u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
            u.email?.toLowerCase().includes(search.toLowerCase())
        const matchRole = roleFilter === 'all' || u.role === roleFilter
        return matchSearch && matchRole
    })

    if (loading) {
        return <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>⏳ Đang tải...</div>
    }

    return (
        <div>
            <h2 className="page-title" style={{ marginBottom: '8px' }}>👥 Quản lý người dùng</h2>
            <p className="page-subtitle" style={{ marginBottom: '24px' }}>
                Tổng cộng {users.length} người dùng
            </p>

            {/* Filters */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
                <input
                    type="text"
                    className="input-field"
                    placeholder="🔍 Tìm theo tên hoặc email..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{ flex: 1, minWidth: '200px' }}
                />
                <div style={{ display: 'flex', gap: '8px' }}>
                    {[
                        { key: 'all', label: 'Tất cả' },
                        { key: 'user', label: 'User' },
                        { key: 'owner', label: 'Owner' },
                        { key: 'admin', label: 'Admin' }
                    ].map(f => (
                        <button
                            key={f.key}
                            className={`btn btn-sm ${roleFilter === f.key ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setRoleFilter(f.key)}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Users Table */}
            <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                <table className={styles.table} style={{ width: '100%' }}>
                    <thead>
                        <tr>
                            <th>Người dùng</th>
                            <th>Email</th>
                            <th>SĐT</th>
                            <th>Vai trò</th>
                            <th>Trạng thái</th>
                            <th>Ngày tạo</th>
                            <th style={{ textAlign: 'center' }}>Hành động</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length > 0 ? filtered.map(user => (
                            <tr key={user.id}>
                                <td>
                                    <Link to={`/admin/profile/${user.id}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', color: 'inherit' }}>
                                        <div className="avatar avatar-sm" style={{ overflow: 'hidden' }}>
                                            {user.avatar ? (
                                                <img src={user.avatar} alt={user.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                                            ) : (user.full_name?.charAt(0)?.toUpperCase() || '?')}
                                        </div>
                                        <span style={{ fontWeight: 600, color: 'var(--accent-green)' }}>{user.full_name}</span>
                                    </Link>
                                </td>
                                <td style={{ color: 'var(--text-secondary)' }}>{user.email}</td>
                                <td style={{ color: 'var(--text-secondary)' }}>{user.phone || '—'}</td>
                                <td>
                                    <span className={`badge ${user.role === 'admin' ? 'badge-purple' : user.role === 'owner' ? 'badge-blue' : 'badge-green'}`}>
                                        {user.role}
                                    </span>
                                </td>
                                <td>
                                    <span className={`badge ${user.status === 'active' ? 'badge-green' : 'badge-red'}`}>
                                        {user.status === 'active' ? '✅ Active' : '🚫 Banned'}
                                    </span>
                                </td>
                                <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                    {formatDate(user.created_at)}
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                        {user.role !== 'admin' && (
                                            <button
                                                className="btn btn-sm btn-secondary"
                                                onClick={async () => {
                                                    try {
                                                        const res = await api.post('/chat/dm', { targetUserId: user.id })
                                                        navigate(`/admin/chat?room=${res.data.roomId}`)
                                                    } catch (err) {
                                                        console.error('Failed to create DM:', err)
                                                    }
                                                }}
                                                title="Nhắn tin"
                                            >
                                                💬
                                            </button>
                                        )}
                                        {user.role !== 'admin' && (
                                            <button
                                                className={`btn btn-sm ${user.status === 'active' ? 'btn-danger' : 'btn-primary'}`}
                                                onClick={() => openConfirmModal(user.id, user.full_name, user.status)}
                                            >
                                                {user.status === 'active' ? '🔒 Ban' : '🔓 Unban'}
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                                    Không tìm thấy người dùng
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Confirm Modal */}
            {showConfirm && confirmData && (
                <div style={{
                    position: 'fixed', inset: 0,
                    background: 'rgba(0,0,0,0.7)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1000, backdropFilter: 'blur(4px)'
                }}>
                    <div className="glass-card" style={{
                        maxWidth: '440px', width: '90%', padding: '32px',
                        animation: 'fadeInUp 0.3s ease'
                    }}>
                        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                            <div style={{ fontSize: '3rem', marginBottom: '12px' }}>
                                {confirmData.action === 'ban' ? '🔒' : '🔓'}
                            </div>
                            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '8px' }}>
                                {confirmData.action === 'ban' ? 'Ban tài khoản' : 'Bỏ ban tài khoản'}
                            </h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                                {confirmData.action === 'ban'
                                    ? <>Bạn có chắc muốn <strong style={{ color: 'var(--accent-red)' }}>BAN</strong> tài khoản <strong style={{ color: 'var(--text-primary)' }}>"{confirmData.userName}"</strong>? Người dùng này sẽ không thể đăng nhập.</>
                                    : <>Bạn có chắc muốn <strong style={{ color: 'var(--accent-green)' }}>BỎ BAN</strong> tài khoản <strong style={{ color: 'var(--text-primary)' }}>"{confirmData.userName}"</strong>? Người dùng sẽ có thể đăng nhập lại.</>
                                }
                            </p>
                        </div>

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                            <button
                                className="btn btn-secondary"
                                onClick={() => setShowConfirm(false)}
                                disabled={processing}
                                style={{ minWidth: '100px' }}
                            >
                                Hủy
                            </button>
                            <button
                                className={`btn ${confirmData.action === 'ban' ? 'btn-danger' : 'btn-primary'}`}
                                onClick={handleConfirm}
                                disabled={processing}
                                style={{ minWidth: '120px' }}
                            >
                                {processing ? '⏳ Đang xử lý...' : (confirmData.action === 'ban' ? '🔒 Xác nhận Ban' : '🔓 Xác nhận Unban')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
