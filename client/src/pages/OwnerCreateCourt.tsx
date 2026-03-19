import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../api/axios'
import { useDialog } from '../context/DialogContext'
import styles from '../styles/Dashboard.module.css'

export default function OwnerCreateCourt() {
    const navigate = useNavigate()
    const { facilityId } = useParams()
    const { showAlert } = useDialog()
    const [submitting, setSubmitting] = useState(false)
    const [form, setForm] = useState({
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!form.name || !form.price_per_hour) {
            await showAlert('Vui lòng điền tên sân và đơn giá mặc định')
            return
        }

        if (form.peak_start_time || form.peak_end_time || form.peak_price) {
            if (!form.peak_start_time || !form.peak_end_time || !form.peak_price) {
                await showAlert('Vui lòng điền đầy đủ Giờ bắt đầu, Giờ kết thúc và Giá cho Khung giờ vàng')
                return
            }
            if (form.peak_start_time >= form.peak_end_time) {
                await showAlert('Giờ bắt đầu khung giờ vàng phải trước Giờ kết thúc')
                return
            }
        }

        setSubmitting(true)
        try {
            await api.post('/courts', {
                facility_id: parseInt(facilityId || '0'),
                ...form,
                price_per_hour: parseFloat(form.price_per_hour),
                weekend_price: form.weekend_price ? parseFloat(form.weekend_price) : null,
                peak_price: form.peak_price ? parseFloat(form.peak_price) : null,
                slot_step_minutes: parseInt(form.slot_step_minutes)
            })
            await showAlert('Tạo sân thành công!')
            navigate('/owner/courts') // Go back to management page
        } catch (err: any) {
            await showAlert(err.response?.data?.message || 'Lỗi khi tạo sân')
        } finally {
            setSubmitting(false)
        }
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setForm({ ...form, [e.target.name]: e.target.value })
    }

    return (
        <div className={styles.dashboardPage}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
                <div>
                    <h1 className="page-title">🏟️ Thêm sân con mới</h1>
                    <p className="page-subtitle">Cấu hình chi tiết loại sân và chiến lược giá</p>
                </div>
                <button className="btn btn-secondary" onClick={() => navigate('/owner/courts')}>Quay lại</button>
            </div>

            <form onSubmit={handleSubmit} className="glass-card" style={{ padding: '30px', maxWidth: '800px', margin: '0 auto' }}>
                <h3 className={styles.sectionTitle}>1. Cấu hình chung</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                    <div className="input-group">
                        <label>Tên Sân *</label>
                        <input name="name" className="input-field" placeholder="VD: Sân 1, Sân VIP..." value={form.name} onChange={handleChange} required />
                    </div>
                    <div className="input-group">
                        <label>Trạng thái</label>
                        <select name="status" className="input-field" value={form.status} onChange={handleChange}>
                            <option value="active">Đang hoạt động</option>
                            <option value="maintenance">Đang bảo trì</option>
                        </select>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
                    <div className="input-group">
                        <label>Loại sân</label>
                        <select name="court_type" className="input-field" value={form.court_type} onChange={handleChange}>
                            <option value="outdoor">Ngoài trời (Outdoor)</option>
                            <option value="indoor">Trong nhà (Indoor)</option>
                            <option value="roofed">Có mái che (Roofed Outdoor)</option>
                        </select>
                    </div>
                    <div className="input-group">
                        <label>Mặt sân</label>
                        <select name="surface_type" className="input-field" value={form.surface_type} onChange={handleChange}>
                            <option value="hard">Sân cứng (Hard court)</option>
                            <option value="carpet">Sân thảm (Carpet court)</option>
                        </select>
                    </div>
                </div>

                <h3 className={styles.sectionTitle}>2. Cấu hình Giá & Khung giờ</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                    <div className="input-group">
                        <label>Đơn giá Mặc định (VNĐ/giờ) *</label>
                        <input type="number" name="price_per_hour" className="input-field" placeholder="VD: 100000" value={form.price_per_hour} onChange={handleChange} required />
                    </div>
                    <div className="input-group">
                        <label>Đơn giá Cuối tuần (VNĐ/giờ)</label>
                        <input type="number" name="weekend_price" className="input-field" placeholder="VD: 120000" value={form.weekend_price} onChange={handleChange} />
                    </div>
                </div>

                <div style={{ background: 'var(--bg-tertiary)', padding: '15px', borderRadius: 'var(--radius-md)', marginBottom: '20px' }}>
                    <h4 style={{ margin: '0 0 10px 0', fontSize: '1rem', color: 'var(--text-secondary)' }}>Khung giờ vàng (Tùy chọn)</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
                        <div className="input-group">
                            <label>Giờ bắt đầu</label>
                            <input type="time" name="peak_start_time" className="input-field" value={form.peak_start_time} onChange={handleChange} />
                        </div>
                        <div className="input-group">
                            <label>Giờ kết thúc</label>
                            <input type="time" name="peak_end_time" className="input-field" value={form.peak_end_time} onChange={handleChange} />
                        </div>
                        <div className="input-group">
                            <label>Giá Giờ vàng (VNĐ)</label>
                            <input type="number" name="peak_price" className="input-field" placeholder="VD: 150000" value={form.peak_price} onChange={handleChange} />
                        </div>
                    </div>
                </div>

                <div className="input-group" style={{ marginBottom: '30px' }}>
                    <label>Bước nhảy thời gian (Phút)</label>
                    <select name="slot_step_minutes" className="input-field" value={form.slot_step_minutes} onChange={handleChange}>
                        <option value="30">30 Phút</option>
                        <option value="60">60 Phút</option>
                    </select>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => navigate('/owner/courts')}>Hủy</button>
                    <button type="submit" className="btn btn-primary" disabled={submitting}>
                        {submitting ? '⏳ Đang lưu...' : '💾 Tạo Sân'}
                    </button>
                </div>
            </form>
        </div>
    )
}
