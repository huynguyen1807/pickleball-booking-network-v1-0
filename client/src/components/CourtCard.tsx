import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import ReportModal from './ReportModal'
import styles from '../styles/Cards.module.css'

export default function CourtCard({ court }) {
    const navigate = useNavigate()
    const [showReportModal, setShowReportModal] = useState(false)
    const data = court;

    const formatPrice = (price) => {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price)
    }

    return (
        <>
            <div className={styles.courtCard}>
                <div className={styles.courtImage} onClick={() => navigate(`/courts/${data.id}`)} style={{ cursor: 'pointer' }}>
                    <div className={styles.courtImagePlaceholder}>🏟️</div>
                    {data.distance && <div className={styles.courtDistance}>📍 {data.distance} km</div>}
                    <button
                        style={{
                            position: 'absolute',
                            top: '8px',
                            right: '8px',
                            background: 'var(--accent-red-dim)',
                            color: 'var(--accent-red)',
                            border: 'none',
                            borderRadius: 'var(--radius-md)',
                            padding: '6px 10px',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                        onClick={(e) => {
                            e.stopPropagation()
                            setShowReportModal(true)
                        }}
                    >
                        🚩
                    </button>
                </div>

                <div className={styles.courtInfo}>
                    <h3 className={styles.courtName} onClick={() => navigate(`/courts/${data.id}`)} style={{ cursor: 'pointer' }}>
                        {data.name}
                    </h3>
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

                    <button
                        className="btn btn-primary btn-sm"
                        onClick={() => navigate(`/courts/${data.id}`)}
                        style={{ width: '100%', marginTop: '12px' }}
                    >
                        Đặt sân ngay
                    </button>
                </div>
            </div>

            <ReportModal
                isOpen={showReportModal}
                targetId={data.id}
                targetType="court"
                targetName={data.name}
                onClose={() => setShowReportModal(false)}
            />
        </>
    )
}
