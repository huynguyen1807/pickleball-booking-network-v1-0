import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'
import { useDialog } from '../context/DialogContext'
import styles from '../styles/Dashboard.module.css'

export default function OwnerCreateFacility() {
    const navigate = useNavigate()
    const { showAlert } = useDialog()
    const [submitting, setSubmitting] = useState(false)
    const [form, setForm] = useState({
        name: '',
        address: '',
        phone: '',
        open_time: '05:00',
        close_time: '23:00',
        description: '',
        avatar: '',
        cover_image: ''
    })

    const [amenities, setAmenities] = useState({
        parking: false,
        wifi: false,
        canteen: false,
        rentals: false,
        restroom: false,
        roof: false,
        lighting: false
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!form.name || !form.address) {
            await showAlert('Vui lòng điền tên và địa chỉ cơ sở')
            return
        }

        setSubmitting(true)
        try {
            // Convert checked amenities into an array of strings
            const activeAmenities = Object.keys(amenities).filter(k => amenities[k as keyof typeof amenities])

            await api.post('/facilities', {
                ...form,
                amenities: activeAmenities
            })
            await showAlert('Tạo cơ sở thành công!')
            navigate('/owner/courts') // Go back to management page
        } catch (err: any) {
            await showAlert(err.response?.data?.message || 'Lỗi khi tạo cơ sở')
        } finally {
            setSubmitting(false)
        }
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setForm({ ...form, [e.target.name]: e.target.value })
    }

    const handleAmenityChange = (key: string) => {
        setAmenities({ ...amenities, [key]: !amenities[key as keyof typeof amenities] })
    }

    return (
        <div className={styles.dashboardPage}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
                <div>
                    <h1 className="page-title">🏭 Thêm cơ sở mới</h1>
                    <p className="page-subtitle">Cấu hình thông tin chung cho cụm sân của bạn</p>
                </div>
                <button className="btn btn-secondary" onClick={() => navigate('/owner/courts')}>Quay lại</button>
            </div>

            <form onSubmit={handleSubmit} className="glass-card" style={{ padding: '30px', maxWidth: '800px', margin: '0 auto' }}>
                <h3 className={styles.sectionTitle}>1. Thông tin chung</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                    <div className="input-group">
                        <label>Tên Cơ Sở *</label>
                        <input name="name" className="input-field" placeholder="VD: CLB Pickleball Cầu Giấy" value={form.name} onChange={handleChange} required />
                    </div>
                    <div className="input-group">
                        <label>Hotline</label>
                        <input name="phone" className="input-field" placeholder="VD: 0901234567" value={form.phone} onChange={handleChange} />
                    </div>
                </div>

                <div className="input-group" style={{ marginBottom: '20px' }}>
                    <label>Địa chỉ chi tiết *</label>
                    <input name="address" className="input-field" placeholder="Số nhà, Tên đường, Quận, Thành phố..." value={form.address} onChange={handleChange} required />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                    <div className="input-group">
                        <label>Giờ mở cửa</label>
                        <input name="open_time" type="time" className="input-field" value={form.open_time} onChange={handleChange} />
                    </div>
                    <div className="input-group">
                        <label>Giờ đóng cửa</label>
                        <input name="close_time" type="time" className="input-field" value={form.close_time} onChange={handleChange} />
                    </div>
                </div>

                <div className="input-group" style={{ marginBottom: '30px' }}>
                    <label>Mô tả giới thiệu</label>
                    <textarea name="description" className="input-field" rows={4} style={{ resize: 'vertical' }} placeholder="Giới thiệu về chất lượng sân, không khí..." value={form.description} onChange={handleChange} />
                </div>

                <h3 className={styles.sectionTitle}>2. Tiện ích đi kèm</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '15px', marginBottom: '30px', padding: '15px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={amenities.parking} onChange={() => handleAmenityChange('parking')} /> 🚗 Bãi đỗ xe ô tô
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={amenities.wifi} onChange={() => handleAmenityChange('wifi')} /> 📶 Wifi miễn phí
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={amenities.canteen} onChange={() => handleAmenityChange('canteen')} /> ☕ Canteen/Nước
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={amenities.rentals} onChange={() => handleAmenityChange('rentals')} /> 🏸 Cho thuê vợt/bóng
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={amenities.restroom} onChange={() => handleAmenityChange('restroom')} /> 🚿 Phòng tắm/Thay đồ
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={amenities.roof} onChange={() => handleAmenityChange('roof')} /> 🏠 Có mái che
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={amenities.lighting} onChange={() => handleAmenityChange('lighting')} /> 💡 Đèn chiếu sáng
                    </label>
                </div>

                {/* <h3 className={styles.sectionTitle}>3. Hình ảnh (Tùy chọn)</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
                    <div className="input-group">
                        <label>Link Ảnh Đại Diện (Logo)</label>
                        <input name="avatar" className="input-field" placeholder="https://..." value={form.avatar} onChange={handleChange} />
                    </div>
                    <div className="input-group">
                        <label>Link Ảnh Bìa (Cover)</label>
                        <input name="cover_image" className="input-field" placeholder="https://..." value={form.cover_image} onChange={handleChange} />
                    </div>
                </div> */}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => navigate('/owner/courts')}>Hủy</button>
                    <button type="submit" className="btn btn-primary" disabled={submitting}>
                        {submitting ? '⏳ Đang lưu...' : '💾 Tạo Cơ Sở'}
                    </button>
                </div>
            </form>
        </div>
    )
}
