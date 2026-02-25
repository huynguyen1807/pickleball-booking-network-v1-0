import { useNavigate } from 'react-router-dom'
import styles from '../styles/Cards.module.css'

export default function CourtCard({ court }) {
    const navigate = useNavigate()
    const data = court || {
        id: 1,
        name: 'Sân Pickleball Hòa Xuân',
        address: '123 Nguyễn Phước Lan, Hòa Xuân, Cẩm Lệ',
        price_per_hour: 150000,
        image: null,
        rating: 4.5,
        total_bookings: 128,
        is_active: true,
        distance: 2.3
    }

    const formatPrice = (price) => {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price)
    }

    return (
        <div className={styles.courtCard} onClick={() => navigate(`/courts/${data.id}`)}>
            <div className={styles.courtImage}>
                <div className={styles.courtImagePlaceholder}>🏟️</div>
                <div className={styles.courtPrice}>{formatPrice(data.price_per_hour)}/h</div>
                {data.distance && <div className={styles.courtDistance}>📍 {data.distance} km</div>}
            </div>

            <div className={styles.courtInfo}>
                <h3 className={styles.courtName}>{data.name}</h3>
                <p className={styles.courtAddress}>📍 {data.address}</p>

                <div className={styles.courtStats}>
                    <span className={styles.courtRating}>⭐ {data.rating}</span>
                    <span className={styles.courtBookings}>{data.total_bookings} lượt đặt</span>
                </div>

                <button className="btn btn-primary btn-sm" style={{ width: '100%', marginTop: '12px' }}>
                    Đặt sân ngay
                </button>
            </div>
        </div>
    )
}
