import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import api from '../api/axios'
import CourtCard from '../components/CourtCard'
import BackButton from '../components/BackButton'
import styles from '../styles/FacilityDetail.module.css'

export default function FacilityDetail() {
    const { id } = useParams()
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

    if (loading) return <div className={styles.centerState}>⏳ Đang tải...</div>
    if (!facility) return <div className={styles.centerState}>❌ Không tìm thấy cơ sở</div>

    return (
        <div className={`container ${styles.page}`}>
            <BackButton
                to="/facilities"
                label="Quay lại danh sách"
                variant="outline"
                className={styles.backButton}
            />
            <div className={styles.facilityCard}>
                <h1 className={styles.title}>{facility.name}</h1>
                <p className={styles.address}>📍 {facility.address}</p>
                {facility.description && <p className={styles.description}>{facility.description}</p>}

                <div className={styles.statsRow}>
                    <span className={`${styles.pill} ${styles.ratingPill}`}>⭐ {Number(facility.avg_rating || 0).toFixed(1)} / 5</span>
                    <span className={styles.pill}>👤 Quản lý bởi: {facility.owner_name}</span>
                    <span className={styles.pill}>📅 Tổng lượt đặt: {facility.booking_count || 0}</span>
                </div>
            </div>

            <h2 className={styles.sectionTitle}>Danh sách sân ({courts.length})</h2>

            <div className={styles.courtsGrid}>
                {courts.map((court: any) => (
                    <CourtCard key={court.id} court={court} />
                ))}
            </div>
            {courts.length === 0 && (
                <div className={styles.emptyState}>
                    <p>Cơ sở này hiện chưa có sân nào.</p>
                </div>
            )}
        </div>
    )
}
