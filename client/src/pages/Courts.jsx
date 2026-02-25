import { useState, useEffect } from 'react'
import api from '../api/axios'
import CourtCard from '../components/CourtCard'
import styles from '../styles/Courts.module.css'

export default function Courts() {
    const [search, setSearch] = useState('')
    const [priceFilter, setPriceFilter] = useState('all')
    const [courts, setCourts] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const loadCourts = async () => {
            try {
                const res = await api.get('/courts')
                setCourts(res.data)
            } catch (err) {
                console.error('Failed to load courts:', err)
            } finally {
                setLoading(false)
            }
        }
        loadCourts()
    }, [])

    const filters = [
        { key: 'all', label: 'Tất cả' },
        { key: 'cheap', label: '💰 Giá thấp' },
        { key: 'popular', label: '🔥 Phổ biến' },
        { key: 'rated', label: '⭐ Đánh giá cao' }
    ]

    const filtered = courts
        .filter(c => c.name.toLowerCase().includes(search.toLowerCase()) ||
            c.address.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => {
            if (priceFilter === 'cheap') return a.price_per_hour - b.price_per_hour
            if (priceFilter === 'popular') return (b.booking_count || 0) - (a.booking_count || 0)
            if (priceFilter === 'rated') return (b.avg_rating || 0) - (a.avg_rating || 0)
            return 0
        })

    return (
        <div className={styles.courtsPage}>
            <div className={styles.header}>
                <div>
                    <h1 className="page-title">Sân Pickleball</h1>
                    <p className="page-subtitle">Tìm và đặt sân tại Đà Nẵng</p>
                </div>
            </div>

            <div className={styles.searchBar}>
                <input
                    type="text"
                    className={styles.searchInput}
                    placeholder="🔍 Tìm sân theo tên hoặc địa chỉ..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            <div className={styles.filterChips}>
                {filters.map(f => (
                    <button
                        key={f.key}
                        className={`${styles.chip} ${priceFilter === f.key ? styles.active : ''}`}
                        onClick={() => setPriceFilter(f.key)}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>⏳ Đang tải sân...</div>
            ) : (
                <div className={styles.grid}>
                    {filtered.length > 0 ? filtered.map(court => (
                        <CourtCard key={court.id} court={{ ...court, rating: court.avg_rating, total_bookings: court.booking_count }} />
                    )) : (
                        <div className={styles.emptyState}>
                            <div className={styles.emptyIcon}>🔍</div>
                            <p>Không tìm thấy sân phù hợp</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
