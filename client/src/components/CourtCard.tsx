import { useNavigate } from 'react-router-dom'
import styles from '../styles/Cards.module.css'

export default function CourtCard({ court }) {
    const navigate = useNavigate()
    const data = court

    const displayRating = Number(data.rating ?? data.avg_rating ?? 0).toFixed(1)
    const displayBookings = Number(data.total_bookings ?? data.booking_count ?? 0)
    const displayPrice = Number(data.price_per_hour ?? 0)

    const formatPrice = (price) => {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price)
    }

    return (
        <>
            <div className={styles.courtCard}>
                <div className={styles.courtImage} onClick={() => navigate(`/courts/${data.id}`)} style={{ cursor: 'pointer' }}>
                    <div className={styles.courtImagePlaceholder}>🏟️</div>
                    {data.distance && <div className={styles.courtDistance}>📍 {data.distance} km</div>}
                    <div className={styles.courtPrice}>{formatPrice(displayPrice)}/h</div>
                </div>

                <div className={styles.courtInfo}>
                    <h3 className={styles.courtName} onClick={() => navigate(`/courts/${data.id}`)} style={{ cursor: 'pointer' }}>
                        {data.name}
                    </h3>

                    <div className={styles.courtStats}>
                        <span className={styles.courtRating}>⭐ {displayRating}</span>
                        <span className={styles.courtBookings}>{displayBookings} lượt đặt</span>
                    </div>

                    {data.owner_name && (
                        <div style={{ marginTop: '8px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                            👤 Chủ sân: <span style={{ fontWeight: 600 }}>{data.owner_name}</span>
                        </div>
                    )}

                    <button
                        className="btn btn-primary btn-sm"
                        onClick={() => navigate(`/courts/${data.id}`)}
                        style={{ width: '100%', marginTop: '12px' }}
                    >
                        Đặt sân ngay
                    </button>
                </div>
            </div>

        </>
    )
}
