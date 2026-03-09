import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api/axios'
import CourtCard from '../components/CourtCard'

export default function FacilityDetail() {
    const { id } = useParams()
    const navigate = useNavigate()
    const [facility, setFacility] = useState(null)
    const [courts, setCourts] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const loadData = async () => {
            try {
                const [facRes, courtRes] = await Promise.all([
                    api.get(`/facilities/${id}`),
                    api.get(`/facilities/${id}/courts`)
                ])
                setFacility(facRes.data)
                setCourts(courtRes.data)
            } catch (err) {
                console.error('Failed to load facility data:', err)
            } finally {
                setLoading(false)
            }
        }
        loadData()
    }, [id])

    if (loading) return <div style={{ textAlign: 'center', padding: '100px' }}>⏳ Đang tải...</div>
    if (!facility) return <div style={{ textAlign: 'center', padding: '100px' }}>❌ Không tìm thấy cơ sở</div>

    return (
        <div className="container" style={{ paddingTop: '60px', paddingBottom: '60px' }}>
            <button className="btn btn-outline btn-sm" onClick={() => navigate('/facilities')} style={{ marginBottom: '20px' }}>
                ⬅ Quay lại danh sách
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', backgroundColor: 'var(--surface)', padding: '30px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                <h1 style={{ margin: 0 }}>{facility.name}</h1>
                <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', margin: 0 }}>📍 {facility.address}</p>
                {facility.description && <p style={{ margin: 0, marginTop: '10px' }}>{facility.description}</p>}

                <div style={{ display: 'flex', gap: '15px', marginTop: '15px', flexWrap: 'wrap' }}>
                    <span style={{ padding: '6px 14px', backgroundColor: 'var(--primary-dark)', borderRadius: '20px', fontSize: '0.9rem', color: 'white', fontWeight: 'bold' }}>⭐ {Number(facility.avg_rating || 0).toFixed(1)} / 5</span>
                    <span style={{ padding: '6px 14px', backgroundColor: 'var(--surface-hover)', borderRadius: '20px', fontSize: '0.9rem' }}>👤 Quản lý bởi: {facility.owner_name}</span>
                    <span style={{ padding: '6px 14px', backgroundColor: 'var(--surface-hover)', borderRadius: '20px', fontSize: '0.9rem' }}>📅 Tổng lượt đặt: {facility.booking_count || 0}</span>
                </div>
            </div>

            <h2 style={{ marginTop: '40px', marginBottom: '20px' }}>Danh sách sân ({courts.length})</h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px' }}>
                {courts.map((court: any) => (
                    <CourtCard key={court.id} court={court} />
                ))}
            </div>
            {courts.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px', backgroundColor: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                    <p>Cơ sở này hiện chưa có sân nào.</p>
                </div>
            )}
        </div>
    )
}
