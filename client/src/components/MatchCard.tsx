import { useNavigate } from 'react-router-dom'
import UserProfileCard from './UserProfileCard'
import styles from '../styles/Cards.module.css'
import { formatDateVN, formatTimeHHmm } from '../utils/dateTime'

export default function MatchCard({ match }) {
    const navigate = useNavigate()
    const data = match || {
        id: 1,
        creator_name: 'Trần Văn B',
        court_name: 'Sân Pickleball Hòa Xuân',
        max_players: 4,
        current_players: 2,
        total_cost: 600000,
        date: '2026-02-25',
        start_time: '18:00',
        end_time: '20:00',
        status: 'waiting'
    }

    const statusLabels: Record<string, { text: string; class: string }> = {
        waiting:   { text: 'Đang tìm người', class: 'yellow' },
        open:      { text: 'Đang tìm người', class: 'yellow' },
        full:      { text: 'Đã đủ người',    class: 'blue' },
        confirmed: { text: 'Đã xác nhận',   class: 'green' },
        completed: { text: 'Hoàn thành',    class: 'blue' },
        finished:  { text: 'Hoàn thành',    class: 'blue' },
        cancelled: { text: 'Đã hủy',        class: 'red' }
    }

    const statusInfo = statusLabels[data.status] || statusLabels.waiting
    const spotsLeft = data.max_players - data.current_players
    const costPerPerson = Math.round(data.total_cost / data.max_players)

    const formatPrice = (price) => new Intl.NumberFormat('vi-VN').format(price) + 'đ'

    const displayDate = formatDateVN(data.match_date || data.date)
    const displayStartTime = formatTimeHHmm(data.start_time)
    const displayEndTime = formatTimeHHmm(data.end_time)

    return (
        <div className={styles.matchCard} onClick={() => navigate(`/matches/${data.id}`)}>
            <div className={styles.matchHeader}>
                <div className={styles.matchCreator}>
                    {data.creator_id ? (
                        <UserProfileCard userId={data.creator_id}>
                            <div className="avatar avatar-sm" style={{ cursor: 'pointer' }}>
                                {data.creator_name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </div>
                        </UserProfileCard>
                    ) : (
                        <div className="avatar avatar-sm">
                            {data.creator_name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                    )}
                    <span>{data.creator_name}</span>
                </div>
                <span className={`badge badge-${statusInfo.class}`}>{statusInfo.text}</span>
            </div>

            {data.format && (
                <div style={{ marginBottom: '10px' }}>
                    <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        padding: '3px 10px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700,
                        background: 'rgba(0,230,118,0.12)', border: '1px solid rgba(0,230,118,0.3)', color: 'var(--accent-green)'
                    }}>
                        {data.format === '1v1' ? '⚔️' : '🤝'} {data.format?.toUpperCase()}
                    </span>
                </div>
            )}

            <div className={styles.matchDetails}>
                <div className={styles.matchDetail}>
                    <span className={styles.matchDetailIcon}>🏟️</span>
                    <span>{data.court_name}</span>
                </div>
                <div className={styles.matchDetail}>
                    <span className={styles.matchDetailIcon}>📅</span>
                    <span>{displayDate} | {displayStartTime} - {displayEndTime}</span>
                </div>
                <div className={styles.matchDetail}>
                    <span className={styles.matchDetailIcon}>💰</span>
                    <span>{formatPrice(costPerPerson)} / người</span>
                </div>
            </div>

            <div className={styles.matchFooter}>
                <div className={styles.matchPlayers}>
                    <div className={styles.playerDots}>
                        {Array.from({ length: data.max_players }).map((_, i) => (
                            <div key={i} className={`${styles.playerDot} ${i < data.current_players ? styles.filled : ''}`} />
                        ))}
                    </div>
                    <span>{data.current_players}/{data.max_players} người chơi</span>
                </div>

                {spotsLeft > 0 && ['waiting', 'open'].includes(data.status) && (
                    <button className="btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); }}>
                        Tham gia ({spotsLeft} chỗ)
                    </button>
                )}
            </div>
        </div>
    )
}
