import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'
import { useDialog } from '../context/DialogContext'
import styles from '../styles/Dashboard.module.css'
import { formatTimeHHmm } from '../utils/dateTime'

export default function OwnerCourts() {
    const navigate = useNavigate()
    const { showAlert, showConfirm } = useDialog()
    const [facilities, setFacilities] = useState([])
    const [courtsByFacility, setCourtsByFacility] = useState<Record<number, any[]>>({})
    const [loading, setLoading] = useState(true)

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
        loadData()
    }, [])

    const loadData = async () => {
        try {
            // Fetch owner's facilities
            const facRes = await api.get('/facilities/my')
            const facs = facRes.data
            setFacilities(facs)

            // For each facility, fetch its courts
            const courtsMap: Record<number, any[]> = {}
            await Promise.all(facs.map(async (f: any) => {
                const cRes = await api.get(`/facilities/${f.id}/courts`)
                courtsMap[f.id] = cRes.data
            }))

            setCourtsByFacility(courtsMap)
        } catch (err) {
            console.error('Failed to load owner data:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleToggleFacilityActive = async (facility: any) => {
        try {
            await api.put(`/facilities/${facility.id}`, {
                ...facility,
                gallery: facility.gallery ? JSON.parse(facility.gallery) : null,
                amenities: facility.amenities ? JSON.parse(facility.amenities) : null,
                is_active: !facility.is_active
            })
            loadData()
        } catch (err: any) {
            await showAlert('Lỗi cập nhật cơ sở', err.response?.data?.message || 'Lỗi cập nhật cơ sở')
        }
    }

    const handleToggleCourtActive = async (court: any) => {
        try {
            await api.put(`/courts/${court.id}`, {
                ...court,
                is_active: !court.is_active
            })
            loadData()
        } catch (err: any) {
            await showAlert('Lỗi cập nhật sân', err.response?.data?.message || 'Lỗi cập nhật sân')
        }
    }

    const handleDeleteCourt = async (court: any) => {
        const isConfirm = await showConfirm('Xác nhận xóa sân', `Bạn chắc chắn muốn xóa sân "${court.name}"?`)
        if (!isConfirm) return
        try {
            await api.delete(`/courts/${court.id}`)
            loadData()
        } catch (err: any) {
            await showAlert('Lỗi xóa sân', err.response?.data?.message || 'Lỗi xóa sân')
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
            await showAlert('Cảnh báo', 'Vui lòng điền tên sân và đơn giá mặc định')
            return
        }

        if (editForm.peak_start_time || editForm.peak_end_time || editForm.peak_price) {
            if (!editForm.peak_start_time || !editForm.peak_end_time || !editForm.peak_price) {
                await showAlert('Cảnh báo', 'Vui lòng điền đầy đủ Giờ bắt đầu, Giờ kết thúc và Giá cho Khung giờ vàng')
                return
            }
            if (editForm.peak_start_time >= editForm.peak_end_time) {
                await showAlert('Cảnh báo', 'Giờ bắt đầu khung giờ vàng phải trước Giờ kết thúc')
                return
            }
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
            await showAlert('Thành công', 'Cập nhật sân thành công!')
            setEditCourt(null)
            loadData()
        } catch (err: any) {
            await showAlert('Lỗi', err.response?.data?.message || 'Lỗi khi cập nhật sân')
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
                    <h1 className="page-title">⚙️ Quản lý Cơ Sở & Sân</h1>
                    <p className="page-subtitle">Thêm cơ sở mới và quản lý các sân trực thuộc</p>
                </div>
                <button className="btn btn-primary" onClick={() => navigate('/owner/facilities/new')}>+ Thêm cơ sở mới</button>
            </div>

            {facilities.length > 0 ? facilities.map((fac: any) => (
                <div key={fac.id} className="glass-card" style={{ marginBottom: '30px', padding: '20px' }}>

                    {/* Facility Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '15px', marginBottom: '15px' }}>
                        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                            <div style={{ width: '60px', height: '60px', borderRadius: 'var(--radius-md)', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>
                                🏭
                            </div>
                            <div>
                                <h2 style={{ margin: '0 0 5px 0', fontSize: '1.25rem', color: 'var(--text-primary)' }}>{fac.name}</h2>
                                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>📍 {fac.address}</p>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <span className={`badge ${fac.is_active ? 'badge-green' : 'badge-red'}`}>
                                {fac.is_active ? 'Hoạt động' : 'Tạm ngưng'}
                            </span>
                            <button className="btn btn-secondary btn-sm" onClick={() => handleToggleFacilityActive(fac)}>
                                {fac.is_active ? '⏸ Tạm ngưng cơ sở' : '▶ Kích hoạt cơ sở'}
                            </button>
                            <button className="btn btn-primary btn-sm" onClick={() => navigate(`/owner/facilities/${fac.id}/courts/new`)}>
                                + Thêm sân con
                            </button>
                        </div>
                    </div>

                    {/* Courts List */}
                    <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '15px' }}>Danh sách sân:</h3>
                    {courtsByFacility[fac.id] && courtsByFacility[fac.id].length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {courtsByFacility[fac.id].map(court => (
                                <div key={court.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                                    <div>
                                        <h4 style={{ margin: '0 0 5px 0', color: 'var(--text-primary)' }}>{court.name}</h4>
                                        <div style={{ display: 'flex', gap: '15px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                            <span>🏓 {court.court_type === 'indoor' ? 'Trong nhà' : court.court_type === 'roofed' ? 'Có mái che' : 'Ngoài trời'}</span>
                                            <span>🏷️ {court.surface_type === 'carpet' ? 'Sân thảm' : 'Sân cứng'}</span>
                                            <span>💰 {formatPrice(court.price_per_hour)}/h</span>
                                            {court.peak_price && <span>🔥 Giờ vàng: {formatPrice(court.peak_price)}/h ({formatTimeHHmm(court.peak_start_time)} - {formatTimeHHmm(court.peak_end_time)})</span>}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                        <span className={`badge ${court.is_active && court.status === 'active' ? 'badge-green' : court.status === 'maintenance' ? 'badge-yellow' : 'badge-red'}`}>
                                            {court.status === 'maintenance' ? 'Bảo trì' : court.is_active ? 'Hoạt động' : 'Tạm ngưng'}
                                        </span>
                                        <button className="btn btn-secondary btn-sm" onClick={() => openEditModal(court)}>
                                            ✏️ Sửa
                                        </button>
                                        <button className="btn btn-secondary btn-sm" onClick={() => handleToggleCourtActive(court)}>
                                            {court.is_active ? '⏸ Ngưng' : '▶ Bật'}
                                        </button>
                                        <button className="btn btn-danger btn-sm" onClick={() => handleDeleteCourt(court)}>🗑️</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                            Chưa có sân nào thuộc cơ sở này.
                        </div>
                    )}
                </div>
            )) : (
                <div className="glass-card" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
                    🏭 Bạn chưa có cơ sở nào. Nhấn "+ Thêm cơ sở mới" để mở rộng kinh doanh!
                </div>
            )
            }

            {/* Edit Court Modal */}
            {
                editCourt && (
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
                )
            }
        </div >
    )
}
