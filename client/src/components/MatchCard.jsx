import { useNavigate } from 'react-router-dom'
import styles from '../styles/Cards.module.css'

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

    const statusLabels = {
        waiting: { text: 'Đang chờ', class: 'yellow' },
        confirmed: { text: 'Đã xác nhận', class: 'green' },
        completed: { text: 'Hoàn thành', class: 'blue' },
        cancelled: { text: 'Đã hủy', class: 'red' }
    }

    const statusInfo = statusLabels[data.status] || statusLabels.waiting
    const spotsLeft = data.max_players - data.current_players
    const costPerPerson = Math.round(data.total_cost / data.max_players)

    const formatPrice = (price) => new Intl.NumberFormat('vi-VN').format(price) + 'đ'

    return (
        <div className={styles.matchCard} onClick={() => navigate(`/matches/${data.id}`)}>
            <div className={styles.matchHeader}>
                <div className={styles.matchCreator}>
                    <div className="avatar avatar-sm">
                        {data.creator_name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <span>{data.creator_name}</span>
                </div>
                <span className={`badge badge-${statusInfo.class}`}>{statusInfo.text}</span>
            </div>

            <div className={styles.matchDetails}>
                <div className={styles.matchDetail}>
                    <span className={styles.matchDetailIcon}>🏟️</span>
                    <span>{data.court_name}</span>
                </div>
                <div className={styles.matchDetail}>
                    <span className={styles.matchDetailIcon}>📅</span>
                    <span>{data.date} | {data.start_time} - {data.end_time}</span>
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

                {spotsLeft > 0 && data.status === 'waiting' && (
                    <button className="btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); }}>
                        Tham gia ({spotsLeft} chỗ)
                    </button>
                )}
            </div>
        </div>
    )
}
