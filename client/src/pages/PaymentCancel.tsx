import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../api/axios'

export default function PaymentCancel() {
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const [countdown, setCountdown] = useState(5)

    const orderCode = searchParams.get('orderCode')

    useEffect(() => {
        if (!orderCode) return
        api.patch(`/payments/cancel-by-order?orderCode=${orderCode}`).catch((err) => {
            console.error('Cancel-by-order failed:', err)
        })
    }, [orderCode])

    useEffect(() => {
        const timer = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(timer)
                    navigate('/dashboard')
                    return 0
                }
                return prev - 1
            })
        }, 1000)
        return () => clearInterval(timer)
    }, [navigate])

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            gap: '16px',
            padding: '24px',
            textAlign: 'center'
        }}>
            <div style={{ fontSize: '64px' }}>❌</div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#ef4444' }}>
                Thanh toán đã bị hủy
            </h1>
            <p style={{ color: '#6b7280', maxWidth: '400px' }}>
                Bạn đã hủy thanh toán
                {orderCode ? ` cho đơn hàng #${orderCode}` : ''}.
                Đơn đặt sân sẽ được hủy.
            </p>
            <p style={{ color: '#9ca3af', fontSize: '14px' }}>
                Tự động chuyển về dashboard sau {countdown} giây...
            </p>
            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button
                    onClick={() => navigate('/dashboard')}
                    style={{
                        padding: '10px 24px',
                        borderRadius: '8px',
                        border: 'none',
                        backgroundColor: '#3b82f6',
                        color: 'white',
                        cursor: 'pointer',
                        fontWeight: 600
                    }}
                >
                    Về Dashboard
                </button>
                <button
                    onClick={() => navigate('/facilities')}
                    style={{
                        padding: '10px 24px',
                        borderRadius: '8px',
                        border: '1px solid #d1d5db',
                        backgroundColor: 'white',
                        cursor: 'pointer',
                        fontWeight: 600
                    }}
                >
                    Đặt sân khác
                </button>
            </div>
        </div>
    )
}
