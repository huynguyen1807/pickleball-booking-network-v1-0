import { useState, useEffect } from 'react'
import api from '../api/axios'
import FacilityCard from '../components/FacilityCard'
import styles from '../styles/Courts.module.css'

export default function Facilities() {
    const [search, setSearch] = useState('')
    const [facilities, setFacilities] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const loadFacilities = async () => {
            try {
                const res = await api.get('/facilities')
                setFacilities(res.data)
            } catch (err) {
                console.error('Failed to load facilities:', err)
            } finally {
                setLoading(false)
            }
        }
        loadFacilities()
    }, [])

    const filtered = facilities
        .filter(f => f.name.toLowerCase().includes(search.toLowerCase()) ||
            f.address.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => {
            return (b.booking_count || 0) - (a.booking_count || 0)
        })

    return (
        <div className={styles.courtsPage}>
            <div className={styles.header}>
                <div>
                    <h1 className="page-title">Cơ sở Pickleball</h1>
                    <p className="page-subtitle">Tìm cơ sở Pickleball tốt nhất tại Đà Nẵng</p>
                </div>
            </div>

            <div className={styles.searchBar}>
                <input
                    type="text"
                    className={styles.searchInput}
                    placeholder="🔍 Tìm cơ sở theo tên hoặc địa chỉ..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>⏳ Đang tải cơ sở...</div>
            ) : (
                <div className={styles.grid}>
                    {filtered.length > 0 ? filtered.map(fac => (
                        <FacilityCard key={fac.id} facility={fac} />
                    )) : (
                        <div className={styles.emptyState}>
                            <div className={styles.emptyIcon}>🔍</div>
                            <p>Không tìm thấy cơ sở phù hợp</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
