import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'
import UserProfileCard from '../components/UserProfileCard'
import { PayOSPayment } from '../components/PayOSPayment'
import { useDialog } from '../context/DialogContext'
import styles from '../styles/Matchmaking.module.css'
import { formatDateVN, formatTimeHHmm } from '../utils/dateTime'

const STATUS_LABELS: Record<string, { text: string; cls: string }> = {
    waiting: { text: 'Đang tìm người', cls: 'yellow' },
    open:    { text: 'Đang tìm người', cls: 'yellow' },
    full:    { text: 'Đã đủ người',    cls: 'blue' },
    confirmed: { text: 'Đã xác nhận', cls: 'green' },
    completed: { text: 'Hoàn thành',  cls: 'blue' },
    finished:  { text: 'Hoàn thành',  cls: 'blue' },
    cancelled: { text: 'Đã hủy',      cls: 'red' }
}

const SKILL_LABELS: Record<string, string> = {
    all: '🎯 Mọi trình độ', beginner: '🟢 Mới bắt đầu',
    intermediate: '🟡 Trung bình', advanced: '🔴 Nâng cao'
}

const toId = (value: any): number | null => {
    const id = Number(value)
    return Number.isInteger(id) && id > 0 ? id : null
}

export default function MatchDetail() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { user } = useAuth()
    const { showAlert, showConfirm } = useDialog()

    const [match, setMatch] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [joining, setJoining] = useState(false)
    const [leaving, setLeaving] = useState(false)
    const [payosData, setPayosData] = useState<any>(null)
    const [initiatingPayment, setInitiatingPayment] = useState(false)
    const [cancelling, setCancelling] = useState(false)

    const loadMatch = useCallback(async () => {
        try {
            const res = await api.get(`/matches/${id}`)
            setMatch(res.data)
        } catch (err) {
            console.error('Failed to load match:', err)
        } finally {
            setLoading(false)
        }
    }, [id])

    useEffect(() => { loadMatch() }, [loadMatch])

    // Derived state
    const currentUserId = toId(user?.id)
    const creatorId = toId(match?.creator_id)
    const isCreatorByFlag = Number(match?.is_creator) === 1
    const myPlayer = [...(match?.players || [])]
        .reverse()
        .find((p: any) => toId(p.user_id) === currentUserId && ['joined', 'waitlist'].includes(p.status))
    const isPlayer = myPlayer?.status === 'joined'
    const isWaitlisted = myPlayer?.status === 'waitlist'
    const isCreator = isCreatorByFlag || (!!currentUserId && !!creatorId && creatorId === currentUserId)
    const spotsLeft = match ? match.max_players - match.current_players : 0
    const canJoin = !isPlayer && !isWaitlisted && ['waiting', 'open', 'full'].includes(match?.status)
    const canCancelMatch = isCreator && !['cancelled', 'completed', 'finished'].includes(match?.status)

    const handleJoin = async () => {
        setJoining(true)
        try {
            const res = await api.post(`/matches/${id}/join`)
            if (res.data.isWaitlist) {
                await showAlert(`✅ ${res.data.message}`)
            } else {
                await showAlert(`✅ ${res.data.message}\n\n💰 Số tiền cần thanh toán: ${new Intl.NumberFormat('vi-VN').format(res.data.price_per_player)}đ`)
            }
            loadMatch()
        } catch (err: any) {
            await showAlert(err.response?.data?.message || 'Không thể tham gia')
        } finally {
            setJoining(false)
        }
    }

    const handlePayment = async () => {
        setInitiatingPayment(true)
        try {
            const res = await api.post('/payments/payos-init', { match_id: parseInt(id!) })
            setPayosData(res.data.data)
        } catch (err: any) {
            await showAlert(err.response?.data?.message || 'Không thể khởi tạo thanh toán')
        } finally {
            setInitiatingPayment(false)
        }
    }

    const handleLeave = async () => {
        const isConfirm = await showConfirm('Bạn có chắc muốn rời trận này?')
        if (!isConfirm) return
        setLeaving(true)
        try {
            const res = await api.post(`/matches/${id}/leave`)
            const refundAmount = Number(res.data?.refundedAmount || 0)
            const balanceAfter = res.data?.balanceAfter
            const detailLines = [res.data.message]
            if (res.data?.refundMessage) detailLines.push(res.data.refundMessage)
            if (refundAmount > 0) detailLines.push(`Số tiền hoàn: ${refundAmount.toLocaleString('vi-VN')}đ`)
            if (balanceAfter !== null && balanceAfter !== undefined) {
                detailLines.push(`Số dư hiện tại: ${Number(balanceAfter).toLocaleString('vi-VN')}đ`)
            }
            await showAlert(detailLines.join('\n'))
            loadMatch()
        } catch (err: any) {
            await showAlert(err.response?.data?.message || 'Không thể rời trận')
        } finally {
            setLeaving(false)
        }
    }

    const handleCancelMatch = async () => {
        const isConfirm = await showConfirm('Hủy trận sẽ hoàn tiền cho tất cả người đã thanh toán. Xác nhận hủy?')
        if (!isConfirm) return
        setCancelling(true)
        try {
            const res = await api.post(`/matches/${id}/cancel`)
            const refundedCount = Number(res.data?.refundedCount || 0)
            const refundedAmount = Number(res.data?.refundedAmount || 0)
            const detailLines = [res.data.message]
            if (refundedCount > 0) detailLines.push(`Đã hoàn cho ${refundedCount} giao dịch`) 
            if (refundedAmount > 0) detailLines.push(`Tổng tiền hoàn: ${refundedAmount.toLocaleString('vi-VN')}đ`)
            await showAlert(detailLines.join('\n'))
            loadMatch()
        } catch (err: any) {
            await showAlert(err.response?.data?.message || 'Không thể hủy trận')
        } finally {
            setCancelling(false)
        }
    }

    if (loading) return <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>⏳ Đang tải...</div>
    if (!match) return <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>Không tìm thấy trận</div>

    const costPerPerson = Math.round(match.total_cost / match.max_players)
    const statusInfo = STATUS_LABELS[match.status] || STATUS_LABELS.waiting
    const joinedPlayers = match.players?.filter((p: any) => p.status === 'joined') || []
    const waitlistPlayers = match.players?.filter((p: any) => p.status === 'waitlist') || []
    const displayDate = formatDateVN(match.match_date)
    const displayStartTime = formatTimeHHmm(match.start_time)
    const displayEndTime = formatTimeHHmm(match.end_time)

    return (
        <div className={styles.matchDetailPage}>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate(-1)}
                style={{ marginBottom: '20px' }}>← Quay lại</button>

            <div className={styles.matchDetailCard}>
                {/* Header */}
                <div className={styles.matchDetailHeader}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <h2 style={{ fontSize: '1.3rem', fontWeight: 800 }}>Trận #{id}</h2>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '4px' }}>
                                Tạo bởi {match.creator_name}
                            </p>
                            <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                                {match.format && (
                                    <span className={styles.formatBadge}>
                                        {match.format === '1v1' ? '⚔️' : '🤝'} {match.format?.toUpperCase()}
                                    </span>
                                )}
                                {match.skill_level && match.skill_level !== 'all' && (
                                    <span className={styles.skillBadge}>
                                        {SKILL_LABELS[match.skill_level] || match.skill_level}
                                    </span>
                                )}
                            </div>
                        </div>
                        <span className={`badge badge-${statusInfo.cls}`}>{statusInfo.text}</span>
                    </div>

                    {match.description && (
                        <p style={{ marginTop: '12px', fontSize: '0.875rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                            💬 {match.description}
                        </p>
                    )}
                </div>

                <div className={styles.matchDetailBody}>
                    {/* Court + Date info */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
                        <div className="glass-card" style={{ padding: '16px', textAlign: 'center' }}>
                            <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>🏟️</div>
                            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{match.court_name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{match.address}</div>
                        </div>
                        <div className="glass-card" style={{ padding: '16px', textAlign: 'center' }}>
                            <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>📅</div>
                            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                                {displayDate}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {displayStartTime} – {displayEndTime}
                            </div>
                        </div>
                    </div>

                    {/* Joined Players */}
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '12px' }}>
                        👥 Người chơi ({match.current_players}/{match.max_players})
                    </h3>
                    <div className={styles.playersList}>
                        {joinedPlayers.map((p: any, i: number) => (
                            <div key={i} className={styles.playerItem}>
                                <UserProfileCard userId={p.user_id}>
                                    <div className="avatar avatar-sm" style={{ cursor: 'pointer' }}>
                                        {p.full_name?.charAt(0) || '?'}
                                    </div>
                                </UserProfileCard>
                                <div className={styles.playerInfo}>
                                    <div className={styles.playerName}>{p.full_name}</div>
                                    <div className={styles.playerStatus} style={{ color: 'var(--text-muted)' }}>
                                        {p.user_id === match.creator_id ? '👑 Người tạo' : '✅ Đã tham gia'}
                                    </div>
                                </div>
                                <span className={`badge ${p.payment_status === 'paid' ? 'badge-green' : 'badge-yellow'}`}>
                                    {p.payment_status === 'paid' ? '✓ Đã TT' : '⏳ Chưa TT'}
                                </span>
                            </div>
                        ))}
                        {Array.from({ length: Math.max(0, spotsLeft) }).map((_, i) => (
                            <div key={`empty-${i}`} className={`${styles.playerItem} ${styles.emptySlot}`}>
                                🎯 Đang chờ người chơi...
                            </div>
                        ))}
                    </div>

                    {/* Waitlist */}
                    {waitlistPlayers.length > 0 && (
                        <div className={styles.waitlistSection}>
                            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '10px' }}>
                                ⏳ Danh sách chờ ({waitlistPlayers.length})
                            </h4>
                            {waitlistPlayers.map((p: any, i: number) => (
                                <div key={i} className={styles.waitlistItem}>
                                    <div className="avatar avatar-sm" style={{ width: '28px', height: '28px', fontSize: '0.75rem' }}>
                                        {p.full_name?.charAt(0)}
                                    </div>
                                    <span style={{ fontSize: '0.85rem' }}>{p.full_name}</span>
                                    <span className="badge badge-yellow" style={{ marginLeft: 'auto' }}>Chờ #{i + 1}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Cost Breakdown */}
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
                        <div className={`${styles.costRow} ${styles.costTotal}`}>
                            <span>Mỗi người thanh toán</span>
                            <span>{costPerPerson.toLocaleString('vi-VN')}đ</span>
                        </div>
                    </div>

                    {/* Payment instruction for joined but unpaid */}
                    {isPlayer && myPlayer?.payment_status === 'pending' && match?.status !== 'cancelled' && (
                        <div className={styles.paymentPrompt}>
                            <div style={{ fontWeight: 700, marginBottom: '6px' }}>💳 Thanh toán để xác nhận chỗ</div>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 12px' }}>
                                Số tiền: <strong>{costPerPerson.toLocaleString('vi-VN')}đ</strong>
                            </p>
                            <button className="btn btn-primary" style={{ width: '100%' }}
                                onClick={handlePayment} disabled={initiatingPayment}>
                                {initiatingPayment ? '⏳ Đang khởi tạo...' : '💳 Thanh toán ngay'}
                            </button>
                        </div>
                    )}

                    {/* Waitlist status */}
                    {isWaitlisted && (
                        <div className={styles.paymentPrompt} style={{ background: 'rgba(59,130,246,0.1)', borderColor: 'rgba(59,130,246,0.3)' }}>
                            <div style={{ fontWeight: 700, marginBottom: '4px' }}>⏳ Bạn đang trong danh sách chờ</div>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                                Bạn sẽ được thêm vào trận khi có chỗ trống.
                            </p>
                        </div>
                    )}

                    {/* Refund policy */}
                    <div className={styles.refundPolicy}>
                        <div style={{ fontWeight: 600, marginBottom: '6px', fontSize: '0.85rem' }}>📋 Chính sách hoàn tiền</div>
                        <div className={styles.refundRow}><span>🟢</span><span>Hủy trước 4 giờ → Hoàn tiền 100%</span></div>
                        <div className={styles.refundRow}><span>🟡</span><span>Hủy 2–4 giờ trước trận → Không hoàn tiền</span></div>
                        <div className={styles.refundRow}><span>🔴</span><span>Hủy trong vòng 2 giờ → Không hoàn tiền</span></div>
                        <div className={styles.refundRow}><span>🔵</span><span>Trận bị hủy do thiếu người → Hoàn tiền 100%</span></div>
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: '12px', marginTop: '24px', flexWrap: 'wrap' }}>
                        {canJoin && (
                            <button className="btn btn-primary btn-lg" style={{ flex: 1 }}
                                onClick={handleJoin} disabled={joining}>
                                {joining ? '⏳...' : spotsLeft > 0 ? '🎯 Tham gia trận' : '⏳ Vào danh sách chờ'}
                            </button>
                        )}
                        {(isPlayer || isWaitlisted) && !isCreator && (
                            <button className="btn btn-danger btn-lg" style={{ flex: canJoin ? undefined : 1 }}
                                onClick={handleLeave} disabled={leaving}>
                                {leaving ? '⏳...' : '🚪 Rời trận'}
                            </button>
                        )}
                        {canCancelMatch && (
                            <button className="btn btn-danger btn-lg" style={{ flex: canJoin ? undefined : 1 }}
                                onClick={handleCancelMatch} disabled={cancelling}>
                                {cancelling ? '⏳...' : '🚫 Hủy trận'}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* PayOS payment modal */}
            {payosData && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 3000,
                    background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
                }}>
                    <div style={{ position: 'relative', width: '100%', maxWidth: '480px' }}>
                        <button onClick={() => setPayosData(null)} style={{
                            position: 'absolute', top: '-12px', right: '-12px',
                            background: 'none', border: 'none', fontSize: '28px',
                            cursor: 'pointer', color: '#aaa', zIndex: 10
                        }}>×</button>
                        <PayOSPayment
                            checkoutUrl={payosData.checkoutUrl}
                            orderCode={payosData.orderCode}
                            paymentLinkId={payosData.paymentLinkId}
                            amount={payosData.amount ?? costPerPerson}
                            onSuccess={() => { setPayosData(null); loadMatch() }}
                            onCancel={() => setPayosData(null)}
                        />
                    </div>
                </div>
            )}
        </div>
    )
}
