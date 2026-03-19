import { useNavigate } from 'react-router-dom'
import styles from '../styles/Cards.module.css'
import { useState, useEffect } from 'react'


export default function CourtCard({ court }) {
    const navigate = useNavigate()
    const data = court;

    const formatPrice = (price) => {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price)
    }

    return (
        <div className={styles.courtCard} onClick={() => navigate(`/courts/${data.id}`)}>
            <div className={styles.courtImage}>
                <div className={styles.courtImagePlaceholder}>🏟️</div>
                {data.distance && <div className={styles.courtDistance}>📍 {data.distance} km</div>}
            </div>

            <div className={styles.courtInfo}>
                <h3 className={styles.courtName}>{data.name}</h3>
                <p className={styles.courtAddress}>📍 {data.address}</p>

                <div className={styles.courtStats}>
                    <span className={styles.courtRating}>⭐ {data.rating}</span>
                    <span className={styles.courtBookings}>{data.total_bookings} lượt đặt</span>
                </div>

                {data.owner_name && (
                    <div style={{ marginTop: '8px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        👤 Chủ sân: <span style={{ fontWeight: 600 }}>{data.owner_name}</span>
                    </div>
                )}

                <button className="btn btn-primary btn-sm" style={{ width: '100%', marginTop: '12px' }}>
                    Đặt sân ngay
                </button>
            </div>
        </div>
    )
}
