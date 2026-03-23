import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useDialog } from '../context/DialogContext'
import api from '../api/axios'
import MatchCard from '../components/MatchCard'
import styles from '../styles/Matchmaking.module.css'
import { getTodayYMD } from '../utils/dateTime'

const FORMATS = [
    { key: '1v1', label: '1 vs 1', players: 2, icon: '⚔️' },
    { key: '2v2', label: '2 vs 2', players: 4, icon: '🤝' }
]
const SKILL_OPTIONS = [
    { value: 'all', label: '🎯 Mọi trình độ' },
    { value: 'beginner', label: '🟢 Mới bắt đầu' },
    { value: 'intermediate', label: '🟡 Trung bình' },
    { value: 'advanced', label: '🔴 Nâng cao' }
]

export default function Matchmaking() {
    const { user } = useAuth()
    const { showAlert } = useDialog()
    const [tab, setTab] = useState('all')
    const [filterSkill, setFilterSkill] = useState('all')
    const [showCreate, setShowCreate] = useState(false)
    const [matches, setMatches] = useState([])
    const [loading, setLoading] = useState(true)
    const [creating, setCreating] = useState(false)
    const [createForm, setCreateForm] = useState({
        date: '', start_time: '', end_time: '',
        format: '2v2', skill_level: 'all', description: ''
    })
    const [modalStep, setModalStep] = useState<1 | 2>(1)
    const [availableCourts, setAvailableCourts] = useState<any[]>([])
    const [searchingCourts, setSearchingCourts] = useState(false)
    const [selectedCourt, setSelectedCourt] = useState<any | null>(null)
    const [courtPage, setCourtPage] = useState(1)
    const [cardsPerPage, setCardsPerPage] = useState(4)
    const courtSliderRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => { loadData() }, [])

    const loadData = async () => {
        try {
            const matchesRes = await api.get('/matches')
            setMatches(matchesRes.data)
        } catch (err) {
            console.error('Failed to load data:', err)
        } finally {
            setLoading(false)
        }
    }

    const resetModal = () => {
        setShowCreate(false)
        setModalStep(1)
        setAvailableCourts([])
        setSelectedCourt(null)
        setCourtPage(1)
        setCreateForm({ date: '', start_time: '', end_time: '', format: '2v2', skill_level: 'all', description: '' })
    }

    const handleSearchCourts = async () => {
        if (!createForm.date || !createForm.start_time || !createForm.end_time) {
            await showAlert('Vui lòng chọn ngày và khoảng thời gian')
            return
        }
        if (createForm.start_time >= createForm.end_time) {
            await showAlert('Giờ kết thúc phải sau giờ bắt đầu')
            return
        }
        setSearchingCourts(true)
        try {
            const res = await api.get('/courts/available', {
                params: { date: createForm.date, start_time: createForm.start_time, end_time: createForm.end_time }
            })
            setAvailableCourts(res.data)
            setSelectedCourt(null)
            setCourtPage(1)
            setModalStep(2)
        } catch (err) {
            console.error('Lỗi tìm sân:', err)
            await showAlert('Không thể tải danh sách sân. Vui lòng thử lại.')
        } finally {
            setSearchingCourts(false)
        }
    }

    const handleCreateMatch = async () => {
        if (!selectedCourt) {
            await showAlert('Vui lòng chọn sân')
            return
        }
        setCreating(true)
        try {
            const fmt = FORMATS.find(f => f.key === createForm.format)
            await api.post('/matches', {
                court_id: selectedCourt.id,
                match_date: createForm.date,
                start_time: createForm.start_time,
                end_time: createForm.end_time,
                format: createForm.format,
                max_players: fmt?.players ?? 4,
                skill_level: createForm.skill_level,
                description: createForm.description || undefined
            })
            resetModal()
            loadData()
        } catch (err: any) {
            await showAlert(err.response?.data?.message || 'Tạo trận thất bại')
        } finally {
            setCreating(false)
        }
    }

    const filtered = (matches as any[]).filter(m => {
        if (tab === 'all' && ['cancelled', 'completed', 'finished'].includes(m.status)) return false
        if (tab === 'waiting' && !['waiting', 'open', 'full'].includes(m.status)) return false
        if (tab === 'mine' && !(m.is_creator || m.is_joined)) return false
        if (tab === 'completed' && !['completed', 'finished'].includes(m.status)) return false
        if (tab === 'cancelled' && m.status !== 'cancelled') return false
        if (tab !== 'cancelled' && filterSkill !== 'all' && m.skill_level && m.skill_level !== filterSkill && m.skill_level !== 'all') return false
        return true
    })

    const totalCourtPages = Math.max(1, Math.ceil(availableCourts.length / cardsPerPage))

    const handleCourtSliderScroll = () => {
        const el = courtSliderRef.current
        if (!el || el.clientWidth === 0) return
        const pageWidth = el.clientWidth
        const page = Math.round(el.scrollLeft / pageWidth) + 1
        setCourtPage(Math.min(totalCourtPages, Math.max(1, page)))
    }

    const goToCourtPage = (page: number) => {
        const el = courtSliderRef.current
        if (!el) return
        const targetPage = Math.min(totalCourtPages, Math.max(1, page))
        el.scrollTo({ left: (targetPage - 1) * el.clientWidth, behavior: 'smooth' })
        setCourtPage(targetPage)
    }

    useEffect(() => {
        const el = courtSliderRef.current
        if (modalStep === 2 && el) {
            el.scrollTo({ left: 0, behavior: 'auto' })
            setCourtPage(1)
        }
    }, [modalStep, availableCourts.length])

    useEffect(() => {
        const updateCardsPerPage = () => {
            if (window.innerWidth <= 992) {
                setCardsPerPage(2)
                return
            }
            setCardsPerPage(4)
        }

        updateCardsPerPage()
        window.addEventListener('resize', updateCardsPerPage)
        return () => window.removeEventListener('resize', updateCardsPerPage)
    }, [])

    useEffect(() => {
        setCourtPage(1)
        const el = courtSliderRef.current
        if (el) el.scrollTo({ left: 0, behavior: 'auto' })
    }, [cardsPerPage])

    const formatPrice = (p: number) => new Intl.NumberFormat('vi-VN').format(p) + 'đ'

    if (loading) return <div className={styles.matchPage} style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>⏳ Đang tải...</div>

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

            {/* Tabs + Skill filter */}
            <div className={styles.filterBar}>
                <div className={styles.tabs}>
                    {[
                        { key: 'all', label: 'Tất cả' },
                        { key: 'waiting', label: '🔍 Đang chờ' },
                        { key: 'mine', label: '👤 Của tôi' },
                        { key: 'completed', label: '✅ Đã xong' },
                        { key: 'cancelled', label: '🚫 Đã hủy' }
                    ].map(t => (
                        <button key={t.key} className={`${styles.tab} ${tab === t.key ? styles.active : ''}`}
                            onClick={() => setTab(t.key)}>
                            {t.label}
                        </button>
                    ))}
                </div>
                <select className={styles.skillFilter}
                    value={filterSkill} onChange={e => setFilterSkill(e.target.value)}>
                    {SKILL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
            </div>

            <div className={styles.matchGrid}>
                {filtered.length > 0 ? filtered.map((match: any) => (
                    <MatchCard key={match.id} match={{
                        ...match,
                        date: match.match_date,
                        start_time: match.start_time,
                        end_time: match.end_time
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
                    <div className={styles.modalOverlay} onClick={resetModal} />
                    <div className={styles.modalContent}>
                        <div className={styles.modalHeader}>
                            <h2 className={styles.modalTitle}>
                                {modalStep === 1 ? '🎯 Tạo trận mới' : '🏟️ Chọn sân'}
                            </h2>
                            <button className={styles.modalClose} onClick={resetModal}>✕</button>
                        </div>

                        <div className={styles.modalForm}>
                            {modalStep === 1 ? (
                                <>
                                    {/* Format */}
                                    <div className="input-group">
                                        <label>Hình thức thi đấu</label>
                                        <div className={styles.playerCount}>
                                            {FORMATS.map(f => (
                                                <button key={f.key} type="button"
                                                    className={`${styles.playerBtn} ${createForm.format === f.key ? styles.selected : ''}`}
                                                    onClick={() => setCreateForm(p => ({ ...p, format: f.key }))}>
                                                    <div style={{ fontSize: '1.4rem', marginBottom: '4px' }}>{f.icon}</div>
                                                    <div style={{ fontWeight: 700, fontSize: '1rem' }}>{f.label}</div>
                                                    <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>{f.players} người chơi</div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Skill level */}
                                    <div className="input-group">
                                        <label>Yêu cầu trình độ</label>
                                        <select className={`input-field ${styles.timeSelect}`} value={createForm.skill_level}
                                            onChange={e => setCreateForm(p => ({ ...p, skill_level: e.target.value }))}>
                                            {SKILL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                        </select>
                                    </div>

                                    {/* Date */}
                                    <div className="input-group">
                                        <label>Ngày chơi</label>
                                        <input type="date" className="input-field" value={createForm.date}
                                            min={getTodayYMD()}
                                            onChange={e => setCreateForm(p => ({ ...p, date: e.target.value }))} />
                                    </div>

                                    {/* Time range */}
                                    <div className={styles.timeRangeGrid}>
                                        <div className="input-group">
                                            <label>Giờ bắt đầu</label>
                                            <select className={`input-field ${styles.timeSelect}`} value={createForm.start_time}
                                                onChange={e => setCreateForm(p => ({ ...p, start_time: e.target.value }))}>
                                                <option value="">-- Chọn giờ --</option>
                                                {Array.from({ length: 36 }, (_, i) => {
                                                    const h = Math.floor(i / 2) + 5
                                                    const m = i % 2 === 0 ? '00' : '30'
                                                    const val = `${String(h).padStart(2, '0')}:${m}`
                                                    return <option key={val} value={val}>{val}</option>
                                                })}
                                            </select>
                                        </div>
                                        <div className="input-group">
                                            <label>Giờ kết thúc</label>
                                            <select className={`input-field ${styles.timeSelect}`} value={createForm.end_time}
                                                onChange={e => setCreateForm(p => ({ ...p, end_time: e.target.value }))}>
                                                <option value="">-- Chọn giờ --</option>
                                                {Array.from({ length: 36 }, (_, i) => {
                                                    const h = Math.floor(i / 2) + 5
                                                    const m = i % 2 === 0 ? '00' : '30'
                                                    const val = `${String(h).padStart(2, '0')}:${m}`
                                                    const isDisabled = !!createForm.start_time && val <= createForm.start_time
                                                    return (
                                                        <option
                                                            key={val}
                                                            value={val}
                                                            disabled={isDisabled}
                                                            style={{ color: isDisabled ? '#9ca3af' : '#000000b1' }}
                                                        >
                                                            {val}
                                                        </option>
                                                    )
                                                })}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Description */}
                                    <div className="input-group">
                                        <label>Mô tả thêm (tùy chọn)</label>
                                        <textarea className="input-field" rows={3}
                                            placeholder="VD: Mang theo paddle, tập hợp trước 10 phút..."
                                            value={createForm.description}
                                            onChange={e => setCreateForm(p => ({ ...p, description: e.target.value }))}
                                            style={{ resize: 'none' }} />
                                    </div>

                                    <button className="btn btn-primary btn-lg" style={{ width: '100%' }}
                                        onClick={handleSearchCourts} disabled={searchingCourts}>
                                        {searchingCourts ? '⏳ Đang tìm sân...' : '🔍 Tìm sân khả dụng'}
                                    </button>
                                </>
                            ) : (
                                <>
                                    {/* Step 2: Court selection */}
                                    <button className="btn btn-secondary" style={{ marginBottom: '16px', alignSelf: 'flex-start' }}
                                        onClick={() => { setModalStep(1); setSelectedCourt(null) }}>
                                        ← Chọn lại thời gian
                                    </button>

                                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                                        📅 {createForm.date} &nbsp;|&nbsp; ⏰ {createForm.start_time} – {createForm.end_time}
                                    </div>

                                    {availableCourts.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-secondary)' }}>
                                            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>😔</div>
                                            <div>Không có sân trống trong khung giờ này</div>
                                            <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>Hãy thử chọn giờ khác</div>
                                        </div>
                                    ) : (
                                        <div className={styles.availableCourtsGrid}>
                                            <div
                                                className={styles.availableCourtsViewport}
                                                ref={courtSliderRef}
                                                onScroll={handleCourtSliderScroll}
                                            >
                                                <div className={styles.availableCourtsTrack}>
                                                    {availableCourts.map((court: any) => (
                                                        <div key={court.id}
                                                            className={`${styles.courtPickerCard} ${selectedCourt?.id === court.id ? styles.courtPickerSelected : ''}`}
                                                            onClick={() => setSelectedCourt(court)}>
                                                            {court.image_url ? (
                                                                <img src={court.image_url} alt={court.name}
                                                                    className={styles.courtPickerImage} />
                                                            ) : (
                                                                <div className={styles.courtPickerImagePlaceholder}>🏓</div>
                                                            )}
                                                            <div className={styles.courtPickerInfo}>
                                                                <div className={styles.courtPickerName}>{court.name}</div>
                                                                <div className={styles.courtPickerFacility}>{court.facility_name}</div>
                                                                <div className={styles.courtPickerAddress}>📍 {court.address}</div>
                                                                <div className={styles.courtPickerFooter}>
                                                                    <span className={styles.courtPickerPrice}>{formatPrice(court.price_per_hour)}/h</span>
                                                                    {court.avg_rating > 0 && (
                                                                        <span className={styles.courtPickerRating}>⭐ {Number(court.avg_rating).toFixed(1)}</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            {selectedCourt?.id === court.id && (
                                                                <div className={styles.courtPickerCheck}>✓</div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {availableCourts.length > 4 && (
                                                <div className={styles.courtPager}>
                                                    <button
                                                        type="button"
                                                        className="btn btn-secondary"
                                                        onClick={() => goToCourtPage(courtPage - 1)}
                                                        disabled={courtPage <= 1}
                                                    >
                                                        ← Trang trước
                                                    </button>
                                                    <span className={styles.courtPagerText}>Trang {courtPage}/{totalCourtPages}</span>
                                                    <button
                                                        type="button"
                                                        className="btn btn-secondary"
                                                        onClick={() => goToCourtPage(courtPage + 1)}
                                                        disabled={courtPage >= totalCourtPages}
                                                    >
                                                        Trang sau →
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Price preview when court selected */}
                                    {selectedCourt && createForm.start_time && createForm.end_time && (() => {
                                        const dur = (new Date(`2000-01-01T${createForm.end_time}`).getTime() - new Date(`2000-01-01T${createForm.start_time}`).getTime()) / 60000
                                        if (dur <= 0) return null
                                        const total = Math.ceil((selectedCourt.price_per_hour / 60) * dur)
                                        const fmt = FORMATS.find(f => f.key === createForm.format)
                                        const perPerson = Math.ceil(total / (fmt?.players ?? 4))
                                        return (
                                            <div className={styles.pricePreview}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                                                    <span>Tổng tiền sân ({dur} phút)</span>
                                                    <span>{formatPrice(total)}</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: 'var(--accent-green)', marginTop: '6px' }}>
                                                    <span>Mỗi người ({fmt?.players} người)</span>
                                                    <span>{formatPrice(perPerson)}</span>
                                                </div>
                                            </div>
                                        )
                                    })()}

                                    <button className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: '8px' }}
                                        onClick={handleCreateMatch} disabled={creating || !selectedCourt}>
                                        {creating ? '⏳ Đang tạo...' : '🚀 Tạo trận & Tìm người chơi'}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
