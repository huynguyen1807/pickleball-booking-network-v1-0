import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'
import UserProfileCard from '../components/UserProfileCard'
import { useDialog } from '../context/DialogContext'
import styles from '../styles/Booking.module.css'
import { getTodayYMD } from '../utils/dateTime'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Slot {
    start_time: string
    end_time: string
    is_available: boolean
}

// ─── Helper ───────────────────────────────────────────────────────────────────

const toMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
}

const formatPrice = (p: number) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(p)

// ─── Component ────────────────────────────────────────────────────────────────

export default function CourtDetail() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { user } = useAuth()
    const { showAlert } = useDialog()

    const [court, setCourt] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [selectedDate, setSelectedDate] = useState(getTodayYMD())
    const [slots, setSlots] = useState<Slot[]>([])
    const [selectedSlots, setSelectedSlots] = useState<Slot[]>([])
    const [slotsLoading, setSlotsLoading] = useState(false)
    const [bookedSlots, setBookedSlots] = useState<Slot[]>([])
    const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '' })
    const [submittingReview, setSubmittingReview] = useState(false)

    useEffect(() => { loadCourt() }, [id])
    useEffect(() => { if (id && selectedDate) loadSlots() }, [id, selectedDate])

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

    const loadSlots = async () => {
        setSlotsLoading(true)
        setSelectedSlots([])
        try {
            const res = await api.get(`/courts/${id}/slots?date=${selectedDate}`)
            const raw: Slot[] = res.data

            // Nếu chọn ngày hôm nay → disable các slot đã qua hoặc còn < 30 phút
            const todayLocal = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD theo local time
            if (selectedDate === todayLocal) {
                const now = new Date()
                // Thêm buffer 30 phút
                const bufferMinutes = now.getHours() * 60 + now.getMinutes() + 30
                const filtered = raw.map(slot => ({
                    ...slot,
                    is_available: slot.is_available && toMinutes(slot.start_time) >= bufferMinutes,
                }))
                setSlots(filtered)
                setBookedSlots(filtered.filter(slot => !slot.is_available))
            } else {
                setSlots(raw)
                setBookedSlots(raw.filter(slot => !slot.is_available))
            }
        } catch (err) {
            console.error('Failed to load slots:', err)
            setSlots([])
        } finally {
            setSlotsLoading(false)
        }
    }

    // ─── Slot selection logic ──────────────────────────────────────────────────

    const handleSlotClick = (slot: Slot) => {
        if (!slot.is_available) return

        setSelectedSlots(prev => {
            if (prev.length === 0) return [slot]

            const firstMin  = toMinutes(prev[0].start_time)
            const lastMin   = toMinutes(prev[prev.length - 1].end_time)
            const clickMin  = toMinutes(slot.start_time)
            const clickEndM = toMinutes(slot.end_time)

            // Deselect nếu click vào slot đang chọn
            const alreadySelected = prev.some(s => s.start_time === slot.start_time)
            if (alreadySelected) {
                // Chỉ cho deselect từ đầu hoặc cuối
                if (slot.start_time === prev[0].start_time)
                    return prev.slice(1)
                if (slot.end_time === prev[prev.length - 1].end_time)
                    return prev.slice(0, -1)
                return prev
            }

            // Mở rộng selection nếu liền kề
            if (clickMin === lastMin) {
                // Check slot giữa không bị booked
                return [...prev, slot]
            }
            if (clickEndM === firstMin) {
                return [slot, ...prev]
            }

            // Không liền kề → reset và bắt đầu từ slot mới
            return [slot]
        })
    }

    const isSlotSelected = (slot: Slot) =>
        selectedSlots.some(s => s.start_time === slot.start_time)

    // Kiểm tra có slot nào bị booked giữa start và end không
    const hasConflictBetween = (start: string, end: string) =>
        slots.some(s => !s.is_available && s.start_time >= start && s.end_time <= end)

    // ─── Price calculation ─────────────────────────────────────────────────────

    const calcPrice = () => {
        if (!court || selectedSlots.length === 0) return { total: 0, regular: 0, peak: 0, regularH: 0, peakH: 0 }

        const startH = toMinutes(selectedSlots[0].start_time) / 60
        const endH   = toMinutes(selectedSlots[selectedSlots.length - 1].end_time) / 60

        const extractH = (timeStr: any): number | null => {
            if (!timeStr) return null
            const str = timeStr instanceof Date ? timeStr.toISOString() : String(timeStr)
            const match = str.match(/\d{2}:\d{2}/)
            if (!match) return null
            const [h, m] = match[0].split(':').map(Number)
            return h + m / 60
        }

        const peakStartH = extractH(court.peak_start_time)
        const peakEndH   = extractH(court.peak_end_time)

        let peakH = 0
        if (court.peak_price && peakStartH !== null && peakEndH !== null) {
            const ovStart = Math.max(startH, peakStartH)
            const ovEnd   = Math.min(endH, peakEndH)
            if (ovStart < ovEnd) peakH = ovEnd - ovStart
        }

        const regularH     = (endH - startH) - peakH
        const regularPrice = regularH * court.price_per_hour
        const peakPrice    = peakH * (court.peak_price || court.price_per_hour)
        return {
            total: Math.round(regularPrice + peakPrice),
            regular: Math.round(regularPrice),
            peak: Math.round(peakPrice),
            regularH,
            peakH,
        }
    }

    const priceInfo = calcPrice()
    const startTime = selectedSlots.length > 0 ? selectedSlots[0].start_time : ''
    const endTime   = selectedSlots.length > 0 ? selectedSlots[selectedSlots.length - 1].end_time : ''

    // ─── Review ────────────────────────────────────────────────────────────────

    const handleSubmitReview = async () => {
        if (!reviewForm.comment.trim()) return
        setSubmittingReview(true)
        try {
            await api.post(`/courts/${id}/review`, reviewForm)
            setReviewForm({ rating: 5, comment: '' })
            loadCourt()
        } catch (err: any) {
            await showAlert('Lỗi', err.response?.data?.message || 'Lỗi khi đánh giá')
        } finally {
            setSubmittingReview(false)
        }
    }

    // ─── Render ────────────────────────────────────────────────────────────────

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

    const todayStr = getTodayYMD()
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
                {/* Hero */}
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
                    {/* Left: Info + Reviews */}
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
                                    <div className={styles.statValue}>{formatPrice(court.price_per_hour)}/h</div>
                                    <div className={styles.statLabel}>Giá</div>
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
                            {court.reviews && court.reviews.length > 0 ? court.reviews.map((r: any, i: number) => (
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

                            {/* Date picker */}
                            <div className="input-group" style={{ marginBottom: '16px' }}>
                                <label>Chọn ngày</label>
                                <input type="date" className="input-field" value={selectedDate}
                                    min={todayStr}
                                    onChange={e => setSelectedDate(e.target.value)} />
                            </div>

                            {/* Slot Grid */}
                            <div style={{ marginBottom: '16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Chọn khung giờ</label>
                                    {selectedSlots.length > 0 && (
                                        <button onClick={() => setSelectedSlots([])}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            ✕ Bỏ chọn
                                        </button>
                                    )}
                                </div>

                                {/* Legend */}
                                <div style={{ display: 'flex', gap: '12px', marginBottom: '10px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <span style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', display: 'inline-block' }}></span>
                                        Trống
                                    </span>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <span style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--accent-green, #10b981)', opacity: 0.8, display: 'inline-block' }}></span>
                                        Đang chọn
                                    </span>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <span style={{ width: 12, height: 12, borderRadius: 3, background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', display: 'inline-block' }}></span>
                                        Đã đặt
                                    </span>
                                </div>

                                {slotsLoading ? (
                                    <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>⏳ Đang tải lịch...</div>
                                ) : slots.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                        Không có slot cho ngày này
                                    </div>
                                ) : (
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(4, 1fr)',
                                        gap: '6px',
                                        maxHeight: '280px',
                                        overflowY: 'auto',
                                        paddingRight: '4px',
                                    }}>
                                        {slots.map((slot) => {
                                            const selected = isSlotSelected(slot)
                                            const booked   = !slot.is_available
                                            return (
                                                <button
                                                    key={slot.start_time}
                                                    onClick={() => handleSlotClick(slot)}
                                                    disabled={booked}
                                                    title={booked ? 'Đã được đặt' : slot.start_time}
                                                    style={{
                                                        padding: '6px 4px',
                                                        borderRadius: '8px',
                                                        fontSize: '0.72rem',
                                                        fontWeight: 600,
                                                        cursor: booked ? 'not-allowed' : 'pointer',
                                                        border: selected
                                                            ? '2px solid #10b981'
                                                            : booked
                                                                ? '1px solid rgba(239,68,68,0.3)'
                                                                : '1px solid var(--border-glass)',
                                                        background: selected
                                                            ? 'rgba(16,185,129,0.2)'
                                                            : booked
                                                                ? 'rgba(239,68,68,0.1)'
                                                                : 'var(--bg-glass)',
                                                        color: selected
                                                            ? '#10b981'
                                                            : booked
                                                                ? 'rgba(239,68,68,0.6)'
                                                                : 'var(--text-secondary)',
                                                        transition: 'all 0.15s',
                                                        textDecoration: booked ? 'line-through' : 'none',
                                                    }}
                                                >
                                                    {slot.start_time}
                                                </button>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Selection summary */}
                            {selectedSlots.length > 0 && (
                                <div style={{
                                    background: 'rgba(16,185,129,0.08)',
                                    border: '1px solid rgba(16,185,129,0.3)',
                                    borderRadius: '10px',
                                    padding: '12px',
                                    marginBottom: '12px',
                                    fontSize: '0.85rem',
                                }}>
                                    <div style={{ fontWeight: 700, marginBottom: '6px', color: '#10b981' }}>
                                        ✅ {startTime} → {endTime}
                                        <span style={{ marginLeft: 8, fontWeight: 400, color: 'var(--text-muted)' }}>
                                            ({selectedSlots.length * 30} phút)
                                        </span>
                                    </div>

                                    {priceInfo.regularH > 0 && (
                                        <div className={styles.summaryRow}>
                                            <span>Giá thường ({priceInfo.regularH.toFixed(1)}h)</span>
                                            <span>{formatPrice(priceInfo.regular)}</span>
                                        </div>
                                    )}
                                    {priceInfo.peakH > 0 && (
                                        <div className={styles.summaryRow} style={{ color: 'var(--accent-orange)' }}>
                                            <span>🔥 Giờ vàng ({priceInfo.peakH.toFixed(1)}h)</span>
                                            <span>{formatPrice(priceInfo.peak)}</span>
                                        </div>
                                    )}
                                    <div className={`${styles.summaryRow} ${styles.summaryTotal}`}>
                                        <span>Tổng cộng</span>
                                        <span>{formatPrice(priceInfo.total)}</span>
                                    </div>
                                </div>
                            )}

                            <button
                                className="btn btn-primary btn-lg"
                                style={{ width: '100%' }}
                                disabled={selectedSlots.length === 0}
                                onClick={() => navigate(`/booking/${court.id}?date=${selectedDate}&start=${startTime}&end=${endTime}`)}
                            >
                                {selectedSlots.length > 0 ? '💳 Đặt sân & Thanh toán' : 'Chọn khung giờ để đặt'}
                            </button>

                            {/* Peak info */}
                            {court.peak_price && court.peak_start_time && (
                                <div style={{ marginTop: '10px', fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                                    🔥 Giờ vàng: {String(court.peak_start_time).slice(0, 5)} – {String(court.peak_end_time).slice(0, 5)} → {formatPrice(court.peak_price)}/h
                                </div>
                            )}

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
