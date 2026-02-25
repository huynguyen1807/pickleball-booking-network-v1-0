import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'
import styles from '../styles/Booking.module.css'

const TIME_SLOTS = [
    { id: 1, start: '06:00', end: '08:00', label: '06:00 - 08:00' },
    { id: 2, start: '08:00', end: '10:00', label: '08:00 - 10:00' },
    { id: 3, start: '10:00', end: '12:00', label: '10:00 - 12:00' },
    { id: 4, start: '14:00', end: '16:00', label: '14:00 - 16:00' },
    { id: 5, start: '16:00', end: '18:00', label: '16:00 - 18:00' },
    { id: 6, start: '18:00', end: '20:00', label: '18:00 - 20:00' },
    { id: 7, start: '20:00', end: '22:00', label: '20:00 - 22:00' }
]

export default function CourtDetail() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { user } = useAuth()
    const [court, setCourt] = useState(null)
    const [loading, setLoading] = useState(true)
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
    const [selectedSlot, setSelectedSlot] = useState(null)
    const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '' })
    const [submittingReview, setSubmittingReview] = useState(false)

    useEffect(() => {
        loadCourt()
    }, [id])

    const loadCourt = async () => {
        try {
            const res = await api.get(`/courts/${id}`)
            setCourt(res.data)
        } catch (err) {
            console.error('Failed to load court:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleSubmitReview = async () => {
        if (!reviewForm.comment.trim()) return
        setSubmittingReview(true)
        try {
            await api.post(`/courts/${id}/review`, reviewForm)
            setReviewForm({ rating: 5, comment: '' })
            loadCourt()
        } catch (err) {
            alert(err.response?.data?.message || 'Lỗi khi đánh giá')
        } finally {
            setSubmittingReview(false)
        }
    }

    const formatPrice = (p) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(p)

    if (loading) return <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>⏳ Đang tải...</div>
    if (!court) return <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>Không tìm thấy sân</div>

    const selectedSlotData = TIME_SLOTS.find(s => s.id === selectedSlot)
    const hours = selectedSlotData ? parseInt(selectedSlotData.end) - parseInt(selectedSlotData.start) : 0
    const totalPrice = court.price_per_hour * hours
    const commission = totalPrice * 0.05

    return (
        <div className={styles.detailPage}>
            <div className={styles.detailContainer}>
                {/* Hero Image */}
                <div className={styles.courtHero}>
                    <div className={styles.courtHeroPlaceholder}>🏟️</div>
                    <div className={styles.courtHeroOverlay}>
                        <button className={styles.backBtn} onClick={() => navigate(-1)}>← Quay lại</button>
                        <div className={styles.courtHeroInfo}>
                            <h1 className={styles.courtName}>{court.name}</h1>
                            <p className={styles.courtAddress}>📍 {court.address}</p>
                        </div>
                    </div>
                </div>

                <div className={styles.detailGrid}>
                    {/* Left: Info */}
                    <div className={styles.detailLeft}>
                        {/* Stats */}
                        <div className="glass-card">
                            <div className={styles.statsRow}>
                                <div className={styles.stat}>
                                    <div className={styles.statValue}>⭐ {court.avg_rating ? parseFloat(court.avg_rating).toFixed(1) : 'N/A'}</div>
                                    <div className={styles.statLabel}>Đánh giá</div>
                                </div>
                                <div className={styles.stat}>
                                    <div className={styles.statValue}>{court.booking_count || 0}</div>
                                    <div className={styles.statLabel}>Lượt đặt</div>
                                </div>
                                <div className={styles.stat}>
                                    <div className={styles.statValue}>{formatPrice(court.price_per_hour)}</div>
                                    <div className={styles.statLabel}>/ giờ</div>
                                </div>
                            </div>
                        </div>

                        {/* Description */}
                        <div className="glass-card">
                            <h3 className={styles.sectionTitle}>Mô tả</h3>
                            <p className={styles.description}>{court.description || 'Chưa có mô tả'}</p>
                        </div>

                        {/* Reviews */}
                        <div className="glass-card">
                            <h3 className={styles.sectionTitle}>Đánh giá ({court.reviews?.length || 0})</h3>
                            {court.reviews && court.reviews.length > 0 ? court.reviews.map((r, i) => (
                                <div key={i} className={styles.review}>
                                    <div className={styles.reviewHeader}>
                                        <div className="avatar avatar-sm">{r.full_name?.charAt(0) || '?'}</div>
                                        <div>
                                            <div className={styles.reviewUser}>{r.full_name}</div>
                                            <div className={styles.reviewDate}>{new Date(r.created_at).toLocaleDateString('vi-VN')}</div>
                                        </div>
                                        <div className={styles.reviewRating}>{'⭐'.repeat(r.rating)}</div>
                                    </div>
                                    <p className={styles.reviewText}>{r.comment}</p>
                                </div>
                            )) : (
                                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Chưa có đánh giá nào</p>
                            )}

                            {/* Review Form */}
                            {user && (
                                <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                                    <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '8px' }}>Viết đánh giá</h4>
                                    <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
                                        {[1, 2, 3, 4, 5].map(star => (
                                            <button key={star} onClick={() => setReviewForm(p => ({ ...p, rating: star }))}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', opacity: star <= reviewForm.rating ? 1 : 0.3 }}>
                                                ⭐
                                            </button>
                                        ))}
                                    </div>
                                    <textarea className="input-field" rows={2} placeholder="Nhận xét của bạn..."
                                        value={reviewForm.comment} onChange={e => setReviewForm(p => ({ ...p, comment: e.target.value }))}
                                        style={{ resize: 'vertical', marginBottom: '8px' }} />
                                    <button className="btn btn-primary btn-sm" onClick={handleSubmitReview}
                                        disabled={submittingReview || !reviewForm.comment.trim()}>
                                        {submittingReview ? '⏳...' : '📤 Gửi đánh giá'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: Booking */}
                    <div className={styles.detailRight}>
                        <div className={`glass-card ${styles.bookingCard}`}>
                            <h3 className={styles.sectionTitle}>🗓️ Đặt sân</h3>

                            <div className="input-group" style={{ marginBottom: '16px' }}>
                                <label>Chọn ngày</label>
                                <input type="date" className="input-field" value={selectedDate}
                                    onChange={e => setSelectedDate(e.target.value)} />
                            </div>

                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>
                                    Chọn khung giờ
                                </label>
                                <div className={styles.slotsGrid}>
                                    {TIME_SLOTS.map(slot => (
                                        <button
                                            key={slot.id}
                                            className={`${styles.slotBtn} ${selectedSlot === slot.id ? styles.slotSelected : ''}`}
                                            onClick={() => setSelectedSlot(slot.id)}
                                        >
                                            {slot.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {selectedSlot && (
                                <div className={styles.bookingSummary}>
                                    <div className={styles.summaryRow}>
                                        <span>Giá sân ({hours}h)</span>
                                        <span>{formatPrice(totalPrice)}</span>
                                    </div>
                                    <div className={styles.summaryRow}>
                                        <span>Phí dịch vụ (5%)</span>
                                        <span>{formatPrice(commission)}</span>
                                    </div>
                                    <div className={`${styles.summaryRow} ${styles.summaryTotal}`}>
                                        <span>Tổng cộng</span>
                                        <span>{formatPrice(totalPrice + commission)}</span>
                                    </div>
                                </div>
                            )}

                            <button className="btn btn-primary btn-lg" style={{ width: '100%' }}
                                disabled={!selectedSlot}
                                onClick={() => navigate(`/booking/${court.id}?slot=${selectedSlot}&date=${selectedDate}&start=${selectedSlotData?.start}&end=${selectedSlotData?.end}`)}>
                                {selectedSlot ? '💳 Đặt sân & Thanh toán' : 'Chọn khung giờ'}
                            </button>

                            {/* Owner info */}
                            <div className={styles.ownerInfo}>
                                <div className="avatar avatar-sm">{court.owner_name?.charAt(0) || '?'}</div>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{court.owner_name}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Chủ sân</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
