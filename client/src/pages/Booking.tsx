import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import api from '../api/axios'
import PaymentModal from '../components/PaymentModal'
import { PayOSPayment } from '../components/PayOSPayment'
import { useDialog } from '../context/DialogContext'
import styles from '../styles/Booking.module.css'
import { formatDateVN, getTodayYMD } from '../utils/dateTime'

export default function Booking() {
    const { id } = useParams()
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const { showAlert } = useDialog()
    const [step, setStep] = useState(1)
    const [payment, setPayment] = useState('')
    const [court, setCourt] = useState(null)
    const [subCourt, setSubCourt] = useState(null)
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [bookingResult, setBookingResult] = useState(null)
    const [bookingId, setBookingId] = useState(null)
    const [showPaymentModal, setShowPaymentModal] = useState(false)
    const [paymentData, setPaymentData] = useState(null)

    const bookingDate = searchParams.get('date') || getTodayYMD()
    const startTime = searchParams.get('start') || '18:00'
    const endTime = searchParams.get('end') || '20:00'
    const subCourtId = searchParams.get('subCourt')

    useEffect(() => {
        const loadCourt = async () => {
            try {
                const res = await api.get(`/courts/${id}`)
                setCourt(res.data)
                if (subCourtId) {
                    try {
                        const subRes = await api.get(`/courts/${id}/sub-courts/${subCourtId}`)
                        setSubCourt(subRes.data)
                    } catch (e) {
                        console.warn('Cannot load sub-court:', e)
                    }
                }
            } catch (err) {
                console.error('Failed to load court:', err)
            } finally {
                setLoading(false)
            }
        }
        loadCourt()
    }, [id, subCourtId])

    const extractTimeH = (timeStr: string) => {
        if (!timeStr) return null;
        const match = timeStr.match(/\d{2}:\d{2}/);
        if (!match) return null;
        const [h, m] = match[0].split(':').map(Number);
        return h + m / 60;
    }

    const startH = parseFloat(startTime.split(':')[0]) + parseFloat(startTime.split(':')[1] || '0') / 60
    const endH = parseFloat(endTime.split(':')[0]) + parseFloat(endTime.split(':')[1] || '0') / 60

    let regularHours = 0;
    let peakHours = 0;
    let courtPrice = 0;
    let regularPrice = 0;
    let peakPriceTotal = 0;

    if (court) {
        const peakStartH = extractTimeH(court.peak_start_time);
        const peakEndH = extractTimeH(court.peak_end_time);

        if (court.peak_price && peakStartH !== null && peakEndH !== null) {
            const overlapStart = Math.max(startH, peakStartH);
            const overlapEnd = Math.min(endH, peakEndH);
            if (overlapStart < overlapEnd) {
                peakHours = overlapEnd - overlapStart;
            }
        }

        regularHours = (endH - startH) - peakHours;
        regularPrice = regularHours * court.price_per_hour;
        peakPriceTotal = peakHours * (court.peak_price || court.price_per_hour);
        courtPrice = regularPrice + peakPriceTotal;
    }

    const total = courtPrice

    const formatPrice = (p) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(p)
    const formatDate = (d) => formatDateVN(d)

    const handleConfirmBooking = async () => {
        setSubmitting(true)
        try {
            const res = await api.post('/bookings', {
                court_id: parseInt(id),
                sub_court_id: subCourtId ? parseInt(subCourtId) : null,
                booking_date: bookingDate,
                start_time: startTime,
                end_time: endTime,
                payment_method: 'payos'
            })
            setBookingId(res.data.bookingId)  // ← Fix: Đọc bookingId thay vì id
            setBookingResult(res.data)
            setStep(2)
        } catch (err) {
            const errData = err.response?.data
            const msg = errData?.message || errData?.error || 'Đặt sân thất bại'
            await showAlert('Lỗi đặt sân', msg)
        } finally {
            setSubmitting(false)
        }
    }

    const handlePaymentSuccess = (data) => {
        if (data.method === 'payos') {
            setPaymentData(data)
        }
    }

    const handlePayOSSuccess = () => {
        setStep(3)
        setPaymentData(null)
    }

    const steps = [
        { num: 1, label: 'Xác nhận' },
        { num: 2, label: 'Thanh toán' },
        { num: 3, label: 'Hoàn tất' }
    ]

    if (loading) return <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>⏳ Đang tải...</div>
    if (!court) return <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>Không tìm thấy sân</div>

    return (
        <div className={styles.bookingPage}>
            <h1 className="page-title" style={{ marginBottom: '8px' }}>Xác nhận đặt sân</h1>
            <p className="page-subtitle" style={{ marginBottom: '24px' }}>Hoàn tất đặt sân của bạn</p>

            {/* Steps */}
            <div className={styles.bookingSteps}>
                {steps.map(s => (
                    <div key={s.num} className={`${styles.step} ${step >= s.num ? styles.activeStep : ''}`}>
                        <div className={styles.stepNumber}>{s.num}</div>
                        {s.label}
                    </div>
                ))}
            </div>

            {step === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className="glass-card">
                        <h3 className={styles.sectionTitle}>📋 Chi tiết đặt sân</h3>
                        <div className={styles.summaryRow}><span>Sân</span><span style={{ fontWeight: 600 }}>{court.name}</span></div>
                        <div className={styles.summaryRow}><span>Ngày</span><span>{formatDate(bookingDate)}</span></div>
                        <div className={styles.summaryRow}><span>Khung giờ</span><span>{startTime} - {endTime}</span></div>
                        {regularHours > 0 && (
                            <div className={styles.summaryRow}><span>Giá thường ({regularHours.toFixed(1)}h)</span><span>{formatPrice(regularPrice)}</span></div>
                        )}
                        {peakHours > 0 && (
                            <div className={styles.summaryRow} style={{ color: 'var(--accent-orange)' }}><span>🔥 Giờ vàng ({peakHours.toFixed(1)}h)</span><span>{formatPrice(peakPriceTotal)}</span></div>
                        )}
                        <div className={`${styles.summaryRow} ${styles.summaryTotal}`}><span>Tổng cộng</span><span>{formatPrice(total)}</span></div>
                    </div>
                    <button className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={submitting} onClick={handleConfirmBooking}>
                        {submitting ? '⏳ Đang tạo booking...' : 'Tiếp tục →'}
                    </button>
                </div>
            )}

            {step === 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className="glass-card">
                        <h3 className={styles.sectionTitle}>💳 Thanh toán với PayOS</h3>
                        <div style={{ padding: '20px', background: '#f0f8ff', borderRadius: '8px', borderLeft: '4px solid #667eea', marginBottom: '20px' }}>
                            <p style={{ color: '#0c5460', margin: 0 }}>
                                ✓ Quét QR code hoặc chuyển khoản trực tiếp<br />
                                ✓ Hỗ trợ 24/7 qua Napas (liên ngân hàng)<br />
                                ✓ Thanh toán an toàn với mã xác thực
                            </p>
                        </div>
                        <p style={{ textAlign: 'center', fontSize: '18px', fontWeight: 600, color: '#2c3e50', marginBottom: '20px' }}>
                            Tổng thanh toán: <span style={{ color: '#667eea' }}>{formatPrice(total)}</span>
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setStep(1)}>← Quay lại</button>
                        <button className="btn btn-primary" style={{ flex: 2 }} disabled={submitting || !bookingId}
                            onClick={() => setShowPaymentModal(true)}>
                            {submitting ? '⏳ Đang xử lý...' : '💳 Tiến hành thanh toán'}
                        </button>
                    </div>
                </div>
            )}

            {step === 3 && (
                <div className="glass-card" style={{ textAlign: 'center', padding: '48px 24px' }}>
                    <div style={{ fontSize: '4rem', marginBottom: '16px' }}>✅</div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '8px', color: 'var(--accent-green)' }}>
                        Đặt sân thành công!
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
                        Bạn đã đặt sân {court.name} ngày {formatDate(bookingDate)}, khung giờ {startTime} - {endTime}
                    </p>
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                        <button className="btn btn-primary" onClick={() => navigate('/')}>Về trang chủ</button>
                        <button className="btn btn-secondary" onClick={() => navigate('/dashboard')}>Xem lịch sử</button>
                    </div>
                </div>
            )}

            {/* Payment Modal */}
            <PaymentModal
                isOpen={showPaymentModal && step === 2}
                bookingId={bookingId}
                amount={total}
                onClose={() => setShowPaymentModal(false)}
                onSuccess={handlePaymentSuccess}
            />

            {/* PayOS QR Code Display Modal */}
            {paymentData && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2000
                }}>
                    <div style={{
                        background: 'white',
                        borderRadius: '12px',
                        maxWidth: '700px',
                        width: '95%',
                        maxHeight: '90vh',
                        overflowY: 'auto',
                        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
                        position: 'relative'
                    }}>
                        <button
                            onClick={() => setPaymentData(null)}
                            style={{
                                position: 'absolute',
                                top: '20px',
                                right: '20px',
                                background: 'none',
                                border: 'none',
                                fontSize: '28px',
                                cursor: 'pointer',
                                color: '#666',
                                zIndex: 10
                            }}
                        >
                            ×
                        </button>
                        <PayOSPayment
                            checkoutUrl={paymentData.checkoutUrl}
                            orderCode={paymentData.orderCode}
                            paymentLinkId={paymentData.paymentLinkId}
                            amount={paymentData.amount}
                            onSuccess={handlePayOSSuccess}
                            onCancel={() => setPaymentData(null)}
                        />
                    </div>
                </div>
            )}
        </div>
    )
}
