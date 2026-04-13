import { useState, useEffect } from 'react'
import { createSocket } from '../api/socket'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function BanListener() {
    const { user, logout } = useAuth()
    const navigate = useNavigate()
    const [banMessage, setBanMessage] = useState<string | null>(null)

    useEffect(() => {
        if (!user) return

        const socket = createSocket()

        socket.on('connect', () => {
            // Join user-specific notification room
            socket.emit('join_notifications', user.id)
        })

        socket.on('account_banned', (data: { message: string }) => {
            setBanMessage(data.message || 'Tài khoản của bạn đã bị khóa. Liên hệ thangkhaiyt24@gmail.com để được hỗ trợ.')
        })

        return () => {
            socket.disconnect()
        }
    }, [user])

    const handleClose = () => {
        setBanMessage(null)
        logout()
        navigate('/login')
    }

    if (!banMessage) return null

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            animation: 'fadeIn 0.3s ease'
        }}>
            <div style={{
                background: 'linear-gradient(145deg, #1a1a2e, #16213e)',
                border: '1px solid rgba(255, 82, 82, 0.3)',
                borderRadius: '20px',
                padding: '40px 32px',
                maxWidth: '440px',
                width: '100%',
                textAlign: 'center',
                boxShadow: '0 25px 60px rgba(255, 82, 82, 0.15), 0 0 0 1px rgba(255, 82, 82, 0.1)',
                animation: 'slideUp 0.4s ease'
            }}>
                {/* Ban Icon */}
                <div style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '50%',
                    background: 'rgba(255, 82, 82, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 20px',
                    fontSize: '40px',
                    border: '2px solid rgba(255, 82, 82, 0.3)'
                }}>
                    🚫
                </div>

                {/* Title */}
                <h2 style={{
                    fontSize: '1.5rem',
                    fontWeight: 800,
                    color: '#FF5252',
                    margin: '0 0 12px',
                    letterSpacing: '-0.02em'
                }}>
                    Tài khoản đã bị khóa
                </h2>

                {/* Message */}
                <p style={{
                    fontSize: '0.95rem',
                    color: '#a0aec0',
                    lineHeight: 1.7,
                    margin: '0 0 24px'
                }}>
                    {banMessage}
                </p>

                {/* Contact Info */}
                <div style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '12px',
                    padding: '16px',
                    marginBottom: '24px',
                    border: '1px solid rgba(255, 255, 255, 0.08)'
                }}>
                    <p style={{
                        fontSize: '0.85rem',
                        color: '#8b949e',
                        margin: '0 0 8px'
                    }}>
                        📧 Email hỗ trợ:
                    </p>
                    <a
                        href="mailto:thangkhaiyt24@gmail.com"
                        style={{
                            color: '#00E676',
                            fontWeight: 700,
                            fontSize: '1rem',
                            textDecoration: 'none'
                        }}
                    >
                        thangkhaiyt24@gmail.com
                    </a>
                </div>

                {/* Close Button */}
                <button
                    onClick={handleClose}
                    style={{
                        width: '100%',
                        padding: '14px',
                        background: 'linear-gradient(135deg, #FF5252, #D32F2F)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '12px',
                        fontSize: '1rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        letterSpacing: '0.02em'
                    }}
                >
                    Đã hiểu
                </button>
            </div>

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(30px) scale(0.95); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
            `}</style>
        </div>
    )
}
