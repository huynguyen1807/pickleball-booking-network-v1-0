import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'
import UserProfileCard from '../components/UserProfileCard'
import styles from '../styles/Booking.module.css'



export default function CourtDetail() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { user } = useAuth()
    const [court, setCourt] = useState(null)
    const [loading, setLoading] = useState(true)
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
    const [startTime, setStartTime] = useState('')
    const [endTime, setEndTime] = useState('')
    const [bookedSlots, setBookedSlots] = useState([])
    const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '' })
    const [submittingReview, setSubmittingReview] = useState(false)

    useEffect(() => {
        loadCourt()
    }, [id])

    useEffect(() => {
        if (id && selectedDate) {
            loadBookedSlots()
        }
    }, [id, selectedDate])

    const loadBookedSlots = async () => {
        try {
            const res = await api.get(`/bookings/booked-slots/${id}/${selectedDate}`)
            setBookedSlots(res.data)
            setStartTime('')
            setEndTime('')
        } catch (err) {
            console.error('Failed to load booked slots:', err)
        }
    }

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

    // Sinh các mốc thời gian cách nhau 30 phút từ 05:00 đến 23:00
    const generateTimeOptions = () => {
        const options = []
        for (let h = 5; h <= 23; h++) {
            for (let m = 0; m < 60; m += 30) {
                if (h === 23 && m === 30) continue; // Dừng ở 23:00
                options.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`)
            }
        }
        return options
    }

    const allTimeOptions = generateTimeOptions()

    // Kiểm tra xem một khoảng thời gian cụ thể có bị trùng với giờ đã book không
    const isSlotBooked = (start, end) => {
        return bookedSlots.some(slot => {
            return (start < slot.end_time && end > slot.start_time)
        })
    }

    const todayStr = new Date().toISOString().split('T')[0]
    const now = new Date()
    const currentH = now.getHours()
    const currentM = now.getMinutes()
    const minTimeValue = currentH + (currentM + 30) / 60

    // Các option giờ bắt đầu hợp lệ
    const availableStartTimes = allTimeOptions.filter(time => {
        // Kiểm tra quá khứ / tối thiểu 30p trước
        if (selectedDate === todayStr) {
            const [h, m] = time.split(':').map(Number)
            if (h + m / 60 < minTimeValue) return false
        }
        // Kiểm tra xem thời điểm này bắt đầu có lập tức đụng slot bị book không
        const [th, tm] = time.split(':').map(Number)
        let endM = tm + 30
        let endH = th
        if (endM >= 60) { endM -= 60; endH += 1; }
        const nextTime = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`
        if (nextTime > "23:00" || isSlotBooked(time, nextTime)) return false

        return true
    })

    // Các option giờ kết thúc hợp lệ dựa vào startTime đã chọn
    const availableEndTimes = startTime ? allTimeOptions.filter(time => {
        if (time <= startTime) return false
        // Kiểm tra từ startTime đến time có bị vướng booked slot không
        if (isSlotBooked(startTime, time)) return false
        return true
    }) : []

    const extractTimeH = (timeStr: string) => {
        if (!timeStr) return null;
        const match = timeStr.match(/\d{2}:\d{2}/);
        if (!match) return null;
        const [h, m] = match[0].split(':').map(Number);
        return h + m / 60;
    }

    let regularHours = 0;
    let peakHours = 0;
    let totalPrice = 0;
    let regularPrice = 0;
    let peakPriceTotal = 0;

    if (startTime && endTime) {
        const startH = parseFloat(startTime.split(':')[0]) + parseFloat(startTime.split(':')[1]) / 60
        const endH = parseFloat(endTime.split(':')[0]) + parseFloat(endTime.split(':')[1]) / 60

        const peakStartH = extractTimeH(court.peak_start_time);
        const peakEndH = extractTimeH(court.peak_end_time);

        if (court.peak_price && peakStartH !== null && peakEndH !== null) {
            // Find overlap between booking [startH, endH] and peak time [peakStartH, peakEndH]
            const overlapStart = Math.max(startH, peakStartH);
            const overlapEnd = Math.min(endH, peakEndH);

            if (overlapStart < overlapEnd) {
                peakHours = overlapEnd - overlapStart;
            }
        }

        regularHours = (endH - startH) - peakHours;

        regularPrice = regularHours * court.price_per_hour;
        peakPriceTotal = peakHours * (court.peak_price || court.price_per_hour);
        totalPrice = regularPrice + peakPriceTotal;
    }

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
                                        {r.user_id ? (
                                            <UserProfileCard userId={r.user_id}>
                                                <div className="avatar avatar-sm" style={{ cursor: 'pointer' }}>{r.full_name?.charAt(0) || '?'}</div>
                                            </UserProfileCard>
                                        ) : (
                                            <div className="avatar avatar-sm">{r.full_name?.charAt(0) || '?'}</div>
                                        )}
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
                                    min={todayStr}
                                    onChange={e => setSelectedDate(e.target.value)} />
                            </div>

                            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                                <div className="input-group" style={{ flex: 1 }}>
                                    <label>Giờ bắt đầu</label>
                                    <select className="input-field" value={startTime} onChange={e => { setStartTime(e.target.value); setEndTime(''); }}>
                                        <option value="">Chọn giờ</option>
                                        {availableStartTimes.map(t => (
                                            <option key={t} value={t}>{t}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="input-group" style={{ flex: 1 }}>
                                    <label>Giờ kết thúc</label>
                                    <select className="input-field" value={endTime} onChange={e => setEndTime(e.target.value)} disabled={!startTime}>
                                        <option value="">Chọn giờ</option>
                                        {availableEndTimes.map(t => (
                                            <option key={t} value={t}>{t}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {startTime && endTime && (
                                <div className={styles.bookingSummary}>
                                    {regularHours > 0 && (
                                        <div className={styles.summaryRow}>
                                            <span>Giá thường ({regularHours.toFixed(1)}h)</span>
                                            <span>{formatPrice(regularPrice)}</span>
                                        </div>
                                    )}
                                    {peakHours > 0 && (
                                        <div className={styles.summaryRow} style={{ color: 'var(--accent-orange)' }}>
                                            <span>🔥 Giờ vàng ({peakHours.toFixed(1)}h)</span>
                                            <span>{formatPrice(peakPriceTotal)}</span>
                                        </div>
                                    )}
                                    <div className={`${styles.summaryRow} ${styles.summaryTotal}`}>
                                        <span>Tổng cộng</span>
                                        <span>{formatPrice(totalPrice)}</span>
                                    </div>
                                </div>
                            )}

                            <button className="btn btn-primary btn-lg" style={{ width: '100%' }}
                                disabled={!startTime || !endTime}
                                onClick={() => navigate(`/booking/${court.id}?date=${selectedDate}&start=${startTime}&end=${endTime}`)}>
                                {(startTime && endTime) ? '💳 Đặt sân & Thanh toán' : 'Chọn khung giờ'}
                            </button>

                            {/* Owner info */}
                            <div className={styles.ownerInfo}>
                                {court.owner_id ? (
                                    <UserProfileCard userId={court.owner_id}>
                                        <div className="avatar avatar-sm" style={{ cursor: 'pointer' }}>{court.owner_name?.charAt(0) || '?'}</div>
                                    </UserProfileCard>
                                ) : (
                                    <div className="avatar avatar-sm">{court.owner_name?.charAt(0) || '?'}</div>
                                )}
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
