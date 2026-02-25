import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'
import MatchCard from '../components/MatchCard'
import styles from '../styles/Matchmaking.module.css'

export default function Matchmaking() {
    const { user } = useAuth()
    const [tab, setTab] = useState('all')
    const [showCreate, setShowCreate] = useState(false)
    const [matches, setMatches] = useState([])
    const [courts, setCourts] = useState([])
    const [loading, setLoading] = useState(true)
    const [creating, setCreating] = useState(false)
    const [createForm, setCreateForm] = useState({
        court_id: '', date: '', start_time: '', end_time: '', max_players: 4
    })

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        try {
            const [matchesRes, courtsRes] = await Promise.all([
                api.get('/matches'),
                api.get('/courts')
            ])
            setMatches(matchesRes.data)
            setCourts(courtsRes.data)
        } catch (err) {
            console.error('Failed to load data:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleCreateMatch = async () => {
        if (!createForm.court_id || !createForm.date || !createForm.start_time || !createForm.end_time) {
            alert('Vui lòng điền đầy đủ thông tin')
            return
        }
        setCreating(true)
        try {
            await api.post('/matches', {
                court_id: parseInt(createForm.court_id),
                match_date: createForm.date,
                start_time: createForm.start_time,
                end_time: createForm.end_time,
                max_players: createForm.max_players
            })
            setShowCreate(false)
            setCreateForm({ court_id: '', date: '', start_time: '', end_time: '', max_players: 4 })
            loadData()
        } catch (err) {
            alert(err.response?.data?.message || 'Tạo trận thất bại')
        } finally {
            setCreating(false)
        }
    }

    const filtered = tab === 'all' ? matches :
        tab === 'waiting' ? matches.filter(m => m.status === 'waiting') :
            tab === 'mine' ? matches.filter(m => m.creator_name === user?.full_name) :
                matches.filter(m => m.status === 'completed')

    const formatPrice = (p) => new Intl.NumberFormat('vi-VN').format(p) + 'đ'

    if (loading) return <div className={styles.matchPage} style={{ textAlign: 'center', padding: '60px 20px' }}>⏳ Đang tải...</div>

    return (
        <div className={styles.matchPage}>
            <div className={styles.header}>
                <div>
                    <h1 className="page-title">Ghép trận</h1>
                    <p className="page-subtitle">Tìm đối thủ và ghép trận Pickleball</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
                    + Tạo trận mới
                </button>
            </div>

            <div className={styles.tabs}>
                {[
                    { key: 'all', label: 'Tất cả' },
                    { key: 'waiting', label: 'Đang chờ' },
                    { key: 'mine', label: 'Của tôi' },
                    { key: 'completed', label: 'Đã xong' }
                ].map(t => (
                    <button key={t.key} className={`${styles.tab} ${tab === t.key ? styles.active : ''}`}
                        onClick={() => setTab(t.key)}>
                        {t.label}
                    </button>
                ))}
            </div>

            <div className={styles.matchGrid}>
                {filtered.length > 0 ? filtered.map(match => (
                    <MatchCard key={match.id} match={{
                        ...match,
                        date: match.match_date?.split('T')[0]
                    }} />
                )) : (
                    <div className="glass-card" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)', gridColumn: '1 / -1' }}>
                        🎯 Chưa có trận nào. Hãy tạo trận mới!
                    </div>
                )}
            </div>

            {/* Create Match Modal */}
            {showCreate && (
                <div className={styles.createModal}>
                    <div className={styles.modalOverlay} onClick={() => setShowCreate(false)} />
                    <div className={styles.modalContent}>
                        <div className={styles.modalHeader}>
                            <h2 className={styles.modalTitle}>🎯 Tạo trận mới</h2>
                            <button className={styles.modalClose} onClick={() => setShowCreate(false)}>✕</button>
                        </div>

                        <div className={styles.modalForm}>
                            <div className="input-group">
                                <label>Chọn sân</label>
                                <select className="input-field" value={createForm.court_id}
                                    onChange={e => setCreateForm(p => ({ ...p, court_id: e.target.value }))}>
                                    <option value="">-- Chọn sân --</option>
                                    {courts.map(c => (
                                        <option key={c.id} value={c.id}>
                                            {c.name} - {formatPrice(c.price_per_hour)}/h
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="input-group">
                                <label>Ngày chơi</label>
                                <input type="date" className="input-field" value={createForm.date}
                                    onChange={e => setCreateForm(p => ({ ...p, date: e.target.value }))} />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div className="input-group">
                                    <label>Giờ bắt đầu</label>
                                    <input type="time" className="input-field" value={createForm.start_time}
                                        onChange={e => setCreateForm(p => ({ ...p, start_time: e.target.value }))} />
                                </div>
                                <div className="input-group">
                                    <label>Giờ kết thúc</label>
                                    <input type="time" className="input-field" value={createForm.end_time}
                                        onChange={e => setCreateForm(p => ({ ...p, end_time: e.target.value }))} />
                                </div>
                            </div>

                            <div className="input-group">
                                <label>Số người chơi</label>
                                <div className={styles.playerCount}>
                                    {[2, 3, 4].map(n => (
                                        <button key={n} type="button"
                                            className={`${styles.playerBtn} ${createForm.max_players === n ? styles.selected : ''}`}
                                            onClick={() => setCreateForm(p => ({ ...p, max_players: n }))}>
                                            {n} người
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <button className="btn btn-primary btn-lg" style={{ width: '100%' }}
                                onClick={handleCreateMatch} disabled={creating}>
                                {creating ? '⏳ Đang tạo...' : '🚀 Tạo trận & Tìm người chơi'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
