import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'
import styles from '../styles/Dashboard.module.css'

export default function OwnerCourts() {
    const navigate = useNavigate()
    const [facilities, setFacilities] = useState([])
    const [courtsByFacility, setCourtsByFacility] = useState<Record<number, any[]>>({})
    const [loading, setLoading] = useState(true)

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
            alert(err.response?.data?.message || 'Lỗi cập nhật cơ sở')
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
            alert(err.response?.data?.message || 'Lỗi cập nhật sân')
        }
    }

    const handleDeleteCourt = async (court: any) => {
        if (!confirm(`Bạn chắc chắn muốn xóa sân "${court.name}"?`)) return
        try {
            await api.delete(`/courts/${court.id}`)
            loadData()
        } catch (err: any) {
            alert(err.response?.data?.message || 'Lỗi xóa sân')
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
                                            {court.peak_price && <span>🔥 Giờ vàng: {formatPrice(court.peak_price)}/h ({court.peak_start_time?.slice(0, 5)} - {court.peak_end_time?.slice(0, 5)})</span>}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                        <span className={`badge ${court.is_active && court.status === 'active' ? 'badge-green' : court.status === 'maintenance' ? 'badge-yellow' : 'badge-red'}`}>
                                            {court.status === 'maintenance' ? 'Bảo trì' : court.is_active ? 'Hoạt động' : 'Tạm ngưng'}
                                        </span>
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
            )}
        </div>
    )
}
