import { useNavigate } from 'react-router-dom'
import styles from '../styles/Cards.module.css'

export default function FacilityCard({ facility }) {
    const navigate = useNavigate()
    const data = facility

    const formatPrice = (price) => {
        if (price === null || price === undefined) return '0 đ'
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price)
    }

    return (
        <div className={styles.courtCard} onClick={() => navigate(`/facilities/${data.id}`)}>
            <div className={styles.courtImage}>
                <div className={styles.courtImagePlaceholder} style={{ fontSize: '3rem' }}>🏟️</div>
                <div className={styles.courtPrice}>Từ {formatPrice(data.min_price)}/h</div>
            </div>

            <div className={styles.courtInfo}>
                <h3 className={styles.courtName}>{data.name}</h3>
                <p className={styles.courtAddress}>📍 {data.address}</p>

                <div className={styles.courtStats}>
                    <span className={styles.courtRating}>⭐ {Number(data.avg_rating || 0).toFixed(1)}</span>
                    <span className={styles.courtBookings}>
                        Sân: {data.court_count || 0}
                    </span>
                    <span className={styles.courtBookings} style={{ marginLeft: 'auto' }}>
                        {data.booking_count || 0} lượt đặt
                    </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                    <button className="btn btn-primary btn-sm" style={{ width: '100%' }}>
                        Xem chi tiết
                    </button>
                </div>
            </div>
        </div>
    )
}
