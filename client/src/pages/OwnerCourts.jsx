import { useState, useEffect } from 'react'
import api from '../api/axios'
import styles from '../styles/Dashboard.module.css'

export default function OwnerCourts() {
    const [courts, setCourts] = useState([])
    const [loading, setLoading] = useState(true)
    const [showCreate, setShowCreate] = useState(false)
    const [creating, setCreating] = useState(false)
    const [createForm, setCreateForm] = useState({
        name: '', address: '', description: '', price_per_hour: '', latitude: '', longitude: '', image: ''
    })

    useEffect(() => {
        loadCourts()
    }, [])

    const loadCourts = async () => {
        try {
            const res = await api.get('/courts/my')
            setCourts(res.data)
        } catch (err) {
            console.error('Failed to load courts:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleCreateCourt = async () => {
        if (!createForm.name || !createForm.address || !createForm.price_per_hour) {
            alert('Vui lòng điền tên sân, địa chỉ và giá')
            return
        }
        setCreating(true)
        try {
            await api.post('/courts', {
                name: createForm.name,
                address: createForm.address,
                description: createForm.description,
                image: createForm.image || null,
                price_per_hour: parseFloat(createForm.price_per_hour),
                latitude: createForm.latitude ? parseFloat(createForm.latitude) : null,
                longitude: createForm.longitude ? parseFloat(createForm.longitude) : null
            })
            setShowCreate(false)
            setCreateForm({ name: '', address: '', description: '', price_per_hour: '', latitude: '', longitude: '', image: '' })
            loadCourts()
        } catch (err) {
            alert(err.response?.data?.message || 'Lỗi tạo sân')
        } finally {
            setCreating(false)
        }
    }

    const handleToggleActive = async (court) => {
        try {
            await api.put(`/courts/${court.id}`, {
                name: court.name,
                address: court.address,
                description: court.description,
                image: court.image,
                price_per_hour: court.price_per_hour,
                latitude: court.latitude,
                longitude: court.longitude,
                is_active: !court.is_active
            })
            loadCourts()
        } catch (err) {
            alert(err.response?.data?.message || 'Lỗi cập nhật')
        }
    }

    const handleDelete = async (courtId) => {
        if (!confirm('Bạn chắc chắn muốn xóa sân này?')) return
        try {
            await api.delete(`/courts/${courtId}`)
            loadCourts()
        } catch (err) {
            alert(err.response?.data?.message || 'Lỗi xóa sân')
        }
    }

    const formatPrice = (p) => new Intl.NumberFormat('vi-VN').format(p) + 'đ'

    if (loading) return <div className={styles.dashboardPage} style={{ textAlign: 'center', padding: '60px 20px' }}>⏳ Đang tải...</div>

    return (
        <div className={styles.dashboardPage}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
                <div>
                    <h1 className="page-title">⚙️ Quản lý sân</h1>
                    <p className="page-subtitle">Thêm, sửa, xóa sân của bạn</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowCreate(!showCreate)}>+ Thêm sân mới</button>
            </div>

            {/* Create Court Form */}
            {showCreate && (
                <div className="glass-card" style={{ marginBottom: '20px', animation: 'fadeInUp 0.3s ease' }}>
                    <h3 className={styles.sectionTitle}>🏟️ Thêm sân mới</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div className="input-group">
                                <label>Tên sân</label>
                                <input className="input-field" placeholder="VD: Sân Pickleball ABC"
                                    value={createForm.name} onChange={e => setCreateForm(p => ({ ...p, name: e.target.value }))} />
                            </div>
                            <div className="input-group">
                                <label>Giá / giờ (VNĐ)</label>
                                <input className="input-field" type="number" placeholder="150000"
                                    value={createForm.price_per_hour} onChange={e => setCreateForm(p => ({ ...p, price_per_hour: e.target.value }))} />
                            </div>
                        </div>
                        <div className="input-group">
                            <label>Địa chỉ</label>
                            <input className="input-field" placeholder="123 Đường ABC, Quận XYZ, Đà Nẵng"
                                value={createForm.address} onChange={e => setCreateForm(p => ({ ...p, address: e.target.value }))} />
                        </div>
                        <div className="input-group">
                            <label>Mô tả</label>
                            <textarea className="input-field" rows="3" placeholder="Mô tả sân, tiện ích..." style={{ resize: 'vertical' }}
                                value={createForm.description} onChange={e => setCreateForm(p => ({ ...p, description: e.target.value }))} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div className="input-group">
                                <label>Vĩ độ</label>
                                <input className="input-field" placeholder="16.0544"
                                    value={createForm.latitude} onChange={e => setCreateForm(p => ({ ...p, latitude: e.target.value }))} />
                            </div>
                            <div className="input-group">
                                <label>Kinh độ</label>
                                <input className="input-field" placeholder="108.2022"
                                    value={createForm.longitude} onChange={e => setCreateForm(p => ({ ...p, longitude: e.target.value }))} />
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Hủy</button>
                            <button className="btn btn-primary" onClick={handleCreateCourt} disabled={creating}>
                                {creating ? '⏳...' : '💾 Lưu sân'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Court List */}
            {courts.length > 0 ? courts.map(court => (
                <div key={court.id} className={styles.courtManageCard}>
                    <div className={styles.courtManageIcon}>🏟️</div>
                    <div className={styles.courtManageInfo}>
                        <div className={styles.courtManageName}>{court.name}</div>
                        <div className={styles.courtManageAddress}>{court.address}</div>
                        <div className={styles.courtManageStats}>
                            <span className={styles.courtManageStat}>💰 {formatPrice(court.price_per_hour)}/h</span>
                            <span className={styles.courtManageStat}>📋 {court.booking_count || 0} booking</span>
                            <span className={styles.courtManageStat}>⭐ {court.avg_rating ? parseFloat(court.avg_rating).toFixed(1) : 'N/A'}</span>
                        </div>
                    </div>
                    <div className={styles.courtManageActions}>
                        <span className={`badge ${court.is_active ? 'badge-green' : 'badge-red'}`}>
                            {court.is_active ? 'Hoạt động' : 'Tạm ngưng'}
                        </span>
                        <button className="btn btn-secondary btn-sm" onClick={() => handleToggleActive(court)}>
                            {court.is_active ? '⏸ Tạm ngưng' : '▶ Kích hoạt'}
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(court.id)}>
                            🗑️ Xóa
                        </button>
                    </div>
                </div>
            )) : (
                <div className="glass-card" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
                    🏟️ Chưa có sân nào. Nhấn "Thêm sân mới" để bắt đầu!
                </div>
            )}
        </div>
    )
}
