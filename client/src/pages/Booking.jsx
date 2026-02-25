import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import api from '../api/axios'
import styles from '../styles/Booking.module.css'

export default function Booking() {
    const { id } = useParams()
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const [step, setStep] = useState(1)
    const [payment, setPayment] = useState('')
    const [court, setCourt] = useState(null)
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [bookingResult, setBookingResult] = useState(null)

    const bookingDate = searchParams.get('date') || new Date().toISOString().split('T')[0]
    const startTime = searchParams.get('start') || '18:00'
    const endTime = searchParams.get('end') || '20:00'

    useEffect(() => {
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
        loadCourt()
    }, [id])

    const hours = parseInt(endTime) - parseInt(startTime)
    const courtPrice = court ? court.price_per_hour * hours : 0
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
                booking_date: bookingDate,
                start_time: startTime,
                end_time: endTime,
                payment_method: payment
            })
            setBookingResult(res.data)
            setStep(3)
        } catch (err) {
            alert(err.response?.data?.message || 'Đặt sân thất bại')
        } finally {
            setSubmitting(false)
        }
    }

    const steps = [
        { num: 1, label: 'Xác nhận' },
        { num: 2, label: 'Thanh toán' },
        { num: 3, label: 'Hoàn tất' }
    ]

    const paymentMethods = [
        { key: 'momo', icon: '📱', name: 'MoMo', desc: 'Ví điện tử MoMo' },
        { key: 'vnpay', icon: '🏦', name: 'VNPay', desc: 'Thẻ ATM / Internet Banking' },
        { key: 'card', icon: '💳', name: 'Visa/Mastercard', desc: 'Thẻ quốc tế' },
        { key: 'cash', icon: '💵', name: 'Thanh toán tại sân', desc: 'Thanh toán khi đến sân' }
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
                        <div className={styles.summaryRow}><span>Giá sân ({hours}h)</span><span>{formatPrice(courtPrice)}</span></div>
                        <div className={styles.summaryRow}><span>Phí dịch vụ (5%)</span><span>{formatPrice(commission)}</span></div>
                        <div className={`${styles.summaryRow} ${styles.summaryTotal}`}><span>Tổng cộng</span><span>{formatPrice(total)}</span></div>
                    </div>
                    <button className="btn btn-primary btn-lg" style={{ width: '100%' }} onClick={() => setStep(2)}>
                        Tiếp tục →
                    </button>
                </div>
            )}

            {step === 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className="glass-card">
                        <h3 className={styles.sectionTitle}>💳 Chọn phương thức thanh toán</h3>
                        <div className={styles.paymentMethods}>
                            {paymentMethods.map(pm => (
                                <div
                                    key={pm.key}
                                    className={`${styles.paymentOption} ${payment === pm.key ? styles.selectedPayment : ''}`}
                                    onClick={() => setPayment(pm.key)}
                                >
                                    <span className={styles.paymentIcon}>{pm.icon}</span>
                                    <div>
                                        <div className={styles.paymentName}>{pm.name}</div>
                                        <div className={styles.paymentDesc}>{pm.desc}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setStep(1)}>← Quay lại</button>
                        <button className="btn btn-primary" style={{ flex: 2 }} disabled={!payment || submitting}
                            onClick={handleConfirmBooking}>
                            {submitting ? '⏳ Đang xử lý...' : `Thanh toán ${formatPrice(total)}`}
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
        </div>
    )
}
