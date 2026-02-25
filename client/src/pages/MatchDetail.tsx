import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'
import styles from '../styles/Matchmaking.module.css'

export default function MatchDetail() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { user } = useAuth()
    const [match, setMatch] = useState(null)
    const [loading, setLoading] = useState(true)
    const [joining, setJoining] = useState(false)
    const [leaving, setLeaving] = useState(false)

    useEffect(() => {
        loadMatch()
    }, [id])

    const loadMatch = async () => {
        try {
            const res = await api.get(`/matches/${id}`)
            setMatch(res.data)
        } catch (err) {
            console.error('Failed to load match:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleJoin = async () => {
        setJoining(true)
        try {
            await api.post(`/matches/${id}/join`)
            loadMatch()
        } catch (err) {
            alert(err.response?.data?.message || 'Không thể tham gia')
        } finally {
            setJoining(false)
        }
    }

    const handleLeave = async () => {
        setLeaving(true)
        try {
            await api.post(`/matches/${id}/leave`)
            loadMatch()
        } catch (err) {
            alert(err.response?.data?.message || 'Không thể rời trận')
        } finally {
            setLeaving(false)
        }
    }

    if (loading) return <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>⏳ Đang tải...</div>
    if (!match) return <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>Không tìm thấy trận</div>

    const costPerPerson = Math.round(match.total_cost / match.max_players)
    const commission = Math.round(costPerPerson * 0.05)
    const statusLabels = { waiting: 'Đang chờ ghép', confirmed: 'Đã xác nhận', completed: 'Hoàn thành', cancelled: 'Đã hủy' }

    const isPlayer = match.players?.some(p => p.user_id === user?.id && p.status === 'joined')
    const isCreator = match.creator_id === user?.id
    const spotsLeft = match.max_players - match.current_players

    return (
        <div className={styles.matchDetailPage}>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate(-1)}
                style={{ marginBottom: '20px' }}>← Quay lại</button>

            <div className={styles.matchDetailCard}>
                <div className={styles.matchDetailHeader}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <h2 style={{ fontSize: '1.3rem', fontWeight: 800 }}>Trận #{id}</h2>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                                Tạo bởi {match.creator_name}
                            </p>
                        </div>
                        <span className={`badge badge-${match.status === 'waiting' ? 'yellow' : match.status === 'confirmed' ? 'green' : 'blue'}`}>
                            {statusLabels[match.status]}
                        </span>
                    </div>
                </div>

                <div className={styles.matchDetailBody}>
                    {/* Info */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
                        <div className="glass-card" style={{ padding: '16px', textAlign: 'center' }}>
                            <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>🏟️</div>
                            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{match.court_name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{match.address}</div>
                        </div>
                        <div className="glass-card" style={{ padding: '16px', textAlign: 'center' }}>
                            <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>📅</div>
                            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{match.match_date?.split('T')[0]}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{match.start_time} - {match.end_time}</div>
                        </div>
                    </div>

                    {/* Players */}
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '12px' }}>
                        👥 Người chơi ({match.current_players}/{match.max_players})
                    </h3>
                    <div className={styles.playersList}>
                        {match.players?.filter(p => p.status === 'joined').map((p, i) => (
                            <div key={i} className={styles.playerItem}>
                                <div className="avatar avatar-sm">{p.full_name?.charAt(0) || '?'}</div>
                                <div className={styles.playerInfo}>
                                    <div className={styles.playerName}>{p.full_name}</div>
                                    <div className={styles.playerStatus} style={{ color: 'var(--text-muted)' }}>
                                        {p.user_id === match.creator_id ? 'Người tạo' : 'Đã tham gia'}
                                    </div>
                                </div>
                                <span className={`badge ${p.payment_status === 'paid' ? 'badge-green' : 'badge-yellow'}`}>
                                    {p.payment_status === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán'}
                                </span>
                            </div>
                        ))}
                        {Array.from({ length: spotsLeft }).map((_, i) => (
                            <div key={`empty-${i}`} className={`${styles.playerItem} ${styles.emptySlot}`}>
                                🎯 Đang chờ người chơi...
                            </div>
                        ))}
                    </div>

                    {/* Cost */}
                    <div className={styles.costBreakdown}>
                        <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '10px' }}>💰 Chi phí</h4>
                        <div className={styles.costRow}>
                            <span>Tổng chi phí sân</span>
                            <span>{match.total_cost?.toLocaleString('vi-VN')}đ</span>
                        </div>
                        <div className={styles.costRow}>
                            <span>Chia đều ({match.max_players} người)</span>
                            <span>{costPerPerson.toLocaleString('vi-VN')}đ/người</span>
                        </div>
                        <div className={styles.costRow}>
                            <span>Phí dịch vụ (5%)</span>
                            <span>{commission.toLocaleString('vi-VN')}đ/người</span>
                        </div>
                        <div className={`${styles.costRow} ${styles.costTotal}`}>
                            <span>Mỗi người thanh toán</span>
                            <span>{(costPerPerson + commission).toLocaleString('vi-VN')}đ</span>
                        </div>
                    </div>

                    {/* Action */}
                    <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                        {!isPlayer && spotsLeft > 0 && match.status === 'waiting' && (
                            <button className="btn btn-primary btn-lg" style={{ flex: 1 }}
                                onClick={handleJoin} disabled={joining}>
                                {joining ? '⏳...' : '🎯 Tham gia trận'}
                            </button>
                        )}
                        {isPlayer && !isCreator && (
                            <button className="btn btn-danger btn-lg" style={{ flex: 1 }}
                                onClick={handleLeave} disabled={leaving}>
                                {leaving ? '⏳...' : '🚪 Rời trận'}
                            </button>
                        )}
                        {isPlayer && (
                            <button className="btn btn-secondary btn-lg" onClick={() => navigate('/chat')}>
                                💬 Chat
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
