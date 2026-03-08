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
    const [editCourt, setEditCourt] = useState<any>(null)
    const [submitting, setSubmitting] = useState(false)
    const [editForm, setEditForm] = useState({
        name: '',
        court_type: 'outdoor',
        surface_type: 'hard',
        status: 'active',
        price_per_hour: '',
        weekend_price: '',
        peak_start_time: '',
        peak_end_time: '',
        peak_price: '',
        slot_step_minutes: '30'
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

    const extractTime = (timeStr: string) => {
        if (!timeStr) return '';
        const match = timeStr.match(/\d{2}:\d{2}/);
        return match ? match[0] : '';
    }

    const openEditModal = (court: any) => {
        setEditCourt(court)
        setEditForm({
            name: court.name || '',
            court_type: court.court_type || 'outdoor',
            surface_type: court.surface_type || 'hard',
            status: court.status || 'active',
            price_per_hour: court.price_per_hour || '',
            weekend_price: court.weekend_price || '',
            peak_start_time: extractTime(court.peak_start_time),
            peak_end_time: extractTime(court.peak_end_time),
            peak_price: court.peak_price || '',
            slot_step_minutes: court.slot_step_minutes?.toString() || '30'
        })
    }

    const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setEditForm({ ...editForm, [e.target.name]: e.target.value })
    }

    const handleSaveEdit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!editForm.name || !editForm.price_per_hour) {
            alert('Vui lòng điền tên sân và đơn giá mặc định')
            return
        }

        setSubmitting(true)
        try {
            await api.put(`/courts/${editCourt.id}`, {
                ...editForm,
                price_per_hour: parseFloat(editForm.price_per_hour),
                weekend_price: editForm.weekend_price ? parseFloat(editForm.weekend_price) : null,
                peak_price: editForm.peak_price ? parseFloat(editForm.peak_price) : null,
                slot_step_minutes: parseInt(editForm.slot_step_minutes)
            })
            alert('Cập nhật sân thành công!')
            setEditCourt(null)
            loadCourts()
        } catch (err: any) {
            alert(err.response?.data?.message || 'Lỗi khi cập nhật sân')
        } finally {
            setSubmitting(false)
        }
    }

    const formatPrice = (p: any) => new Intl.NumberFormat('vi-VN').format(p) + 'đ'

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
                            <textarea className="input-field" rows={3} placeholder="Mô tả sân, tiện ích..." style={{ resize: 'vertical' }}
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
            {courts.length > 0 ? courts.map((court: any) => (
                <div key={court.id} className={styles.courtManageCard}>
                    <div className={styles.courtManageIcon}>🏟️</div>
                    <div className={styles.courtManageInfo}>
                        <div className={styles.courtManageName}>{court.name}</div>
                        <div className={styles.courtManageAddress}>{court.address}</div>
                        <div className={styles.courtManageStats}>
                            <span className={styles.courtManageStat}>🏓 {court.court_type === 'indoor' ? 'Trong nhà' : court.court_type === 'roofed' ? 'Có mái che' : 'Ngoài trời'}</span>
                            <span className={styles.courtManageStat}>🏷️ {court.surface_type === 'carpet' ? 'Sân thảm' : 'Sân cứng'}</span>
                            <span className={styles.courtManageStat}>💰 {formatPrice(court.price_per_hour)}/h</span>
                            {court.peak_price && <span className={styles.courtManageStat}>🔥 Giờ vàng: {formatPrice(court.peak_price)}/h ({extractTime(court.peak_start_time)} - {extractTime(court.peak_end_time)})</span>}
                            <span className={styles.courtManageStat}>📋 {court.booking_count || 0} booking</span>
                            <span className={styles.courtManageStat}>⭐ {court.avg_rating ? parseFloat(court.avg_rating).toFixed(1) : 'N/A'}</span>
                        </div>
                    </div>
                    <div className={styles.courtManageActions}>
                        <span className={`badge ${court.is_active && court.status === 'active' ? 'badge-green' : court.status === 'maintenance' ? 'badge-yellow' : 'badge-red'}`}>
                            {court.status === 'maintenance' ? 'Bảo trì' : court.is_active ? 'Hoạt động' : 'Tạm ngưng'}
                        </span>
                        <button className="btn btn-secondary btn-sm" onClick={() => openEditModal(court)}>
                            ✏️ Sửa
                        </button>
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

            {/* Edit Court Modal */}
            {editCourt && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
                    display: 'flex', justifyContent: 'center', alignItems: 'center',
                    padding: '20px', overflowY: 'auto'
                }}>
                    <form onSubmit={handleSaveEdit} className="glass-card" style={{ padding: '30px', width: '100%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto', backgroundColor: 'var(--bg-primary)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ margin: 0 }}>✏️ Chỉnh sửa Sân</h2>
                            <button type="button" onClick={() => setEditCourt(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-primary)' }}>✖</button>
                        </div>

                        <h3 className={styles.sectionTitle}>1. Cấu hình chung</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                            <div className="input-group">
                                <label>Tên Sân *</label>
                                <input name="name" className="input-field" placeholder="VD: Sân 1, Sân VIP..." value={editForm.name} onChange={handleEditChange} required />
                            </div>
                            <div className="input-group">
                                <label>Trạng thái</label>
                                <select name="status" className="input-field" value={editForm.status} onChange={handleEditChange}>
                                    <option value="active">Đang hoạt động</option>
                                    <option value="maintenance">Đang bảo trì</option>
                                </select>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
                            <div className="input-group">
                                <label>Loại sân</label>
                                <select name="court_type" className="input-field" value={editForm.court_type} onChange={handleEditChange}>
                                    <option value="outdoor">Ngoài trời (Outdoor)</option>
                                    <option value="indoor">Trong nhà (Indoor)</option>
                                    <option value="roofed">Có mái che (Roofed Outdoor)</option>
                                </select>
                            </div>
                            <div className="input-group">
                                <label>Mặt sân</label>
                                <select name="surface_type" className="input-field" value={editForm.surface_type} onChange={handleEditChange}>
                                    <option value="hard">Sân cứng (Hard court)</option>
                                    <option value="carpet">Sân thảm (Carpet court)</option>
                                </select>
                            </div>
                        </div>

                        <h3 className={styles.sectionTitle}>2. Cấu hình Giá & Khung giờ</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                            <div className="input-group">
                                <label>Đơn giá Mặc định (VNĐ/giờ) *</label>
                                <input type="number" name="price_per_hour" className="input-field" placeholder="VD: 100000" value={editForm.price_per_hour} onChange={handleEditChange} required />
                            </div>
                            <div className="input-group">
                                <label>Đơn giá Cuối tuần (VNĐ/giờ)</label>
                                <input type="number" name="weekend_price" className="input-field" placeholder="VD: 120000" value={editForm.weekend_price} onChange={handleEditChange} />
                            </div>
                        </div>

                        <div style={{ background: 'var(--bg-tertiary)', padding: '15px', borderRadius: 'var(--radius-md)', marginBottom: '20px' }}>
                            <h4 style={{ margin: '0 0 10px 0', fontSize: '1rem', color: 'var(--text-secondary)' }}>Khung giờ vàng (Tùy chọn)</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
                                <div className="input-group">
                                    <label>Giờ bắt đầu</label>
                                    <input type="time" name="peak_start_time" className="input-field" value={editForm.peak_start_time} onChange={handleEditChange} />
                                </div>
                                <div className="input-group">
                                    <label>Giờ kết thúc</label>
                                    <input type="time" name="peak_end_time" className="input-field" value={editForm.peak_end_time} onChange={handleEditChange} />
                                </div>
                                <div className="input-group">
                                    <label>Giá Giờ vàng (VNĐ)</label>
                                    <input type="number" name="peak_price" className="input-field" placeholder="VD: 150000" value={editForm.peak_price} onChange={handleEditChange} />
                                </div>
                            </div>
                        </div>

                        <div className="input-group" style={{ marginBottom: '30px' }}>
                            <label>Bước nhảy thời gian (Phút)</label>
                            <select name="slot_step_minutes" className="input-field" value={editForm.slot_step_minutes} onChange={handleEditChange}>
                                <option value="30">30 Phút</option>
                                <option value="60">60 Phút</option>
                            </select>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px' }}>
                            <button type="button" className="btn btn-secondary" onClick={() => setEditCourt(null)}>Hủy</button>
                            <button type="submit" className="btn btn-primary" disabled={submitting}>
                                {submitting ? '⏳ Đang lưu...' : '💾 Lưu Thay Đổi'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    )
}
