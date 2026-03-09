import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import api from '../api/axios'
import PaymentModal from '../components/PaymentModal'
import { PayOSPayment } from '../components/PayOSPayment'
import styles from '../styles/Booking.module.css'

export default function Booking() {
    const { id } = useParams()
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
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

    const bookingDate = searchParams.get('date') || new Date().toISOString().split('T')[0]
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

    const toMinutes = t => {
        const [h, m] = t.split(':').map(Number)
        return h * 60 + m
    }
    const duration = toMinutes(endTime) - toMinutes(startTime)
    
    const pricingConfig = subCourt || court || {
        price_per_hour: 100000,
        peak_start_time: null,
        peak_end_time: null,
        peak_price_per_hour: 0,
        weekend_price_per_hour: 0
    }
    
    const unitPrice = (() => {
        if (!pricingConfig) return 0
        const d = new Date(bookingDate).getDay()
        if ((d === 6 || d === 0) && pricingConfig.weekend_price_per_hour > 0) return pricingConfig.weekend_price_per_hour
        if (pricingConfig.peak_start_time && pricingConfig.peak_end_time &&
            startTime >= pricingConfig.peak_start_time &&
            endTime <= pricingConfig.peak_end_time &&
            pricingConfig.peak_price_per_hour > 0) return pricingConfig.peak_price_per_hour
        return pricingConfig.price_per_hour
    })()
    const courtPrice = (unitPrice / 60) * duration
    const commission = courtPrice * 0.05
    const total = courtPrice + commission

    const formatPrice = (p) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(p)
    const formatDate = (d) => {
        const date = new Date(d)
        return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    }

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
            alert(err.response?.data?.message || 'Đặt sân thất bại')
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
                        <div className={styles.summaryRow}><span>Giá sân ({duration} phút)</span><span>{formatPrice(courtPrice)}</span></div>
                        <div className={styles.summaryRow}><span>Phí dịch vụ (5%)</span><span>{formatPrice(commission)}</span></div>
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
                                ✓ Quét QR code hoặc chuyển khoản trực tiếp<br/>
                                ✓ Hỗ trợ 24/7 qua Napas (liên ngân hàng)<br/>
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
                            qrCode={paymentData.qrCode}
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
