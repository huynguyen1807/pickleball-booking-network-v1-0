import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useDialog } from '../context/DialogContext'
import api from '../api/axios'
import { io as socketIO } from 'socket.io-client'
import PostCard from '../components/PostCard'
import CameraModal from '../components/CameraModal'
import styles from '../styles/Home.module.css'
import { formatDateVN, formatTimeHHmm } from '../utils/dateTime'

const HOME_SCROLL_KEY = 'home_feed_scroll_y'

export default function Home() {
    const { user } = useAuth()
    const { showAlert } = useDialog()
    const navigate = useNavigate()
    const [filter, setFilter] = useState('latest')
    const [posts, setPosts] = useState([])
    const [hiddenPosts, setHiddenPosts] = useState(() => {
        try { return JSON.parse(localStorage.getItem('hiddenPosts') || '[]') } catch { return [] }
    })
    const [matches, setMatches] = useState([])
    const [facilities, setFacilities] = useState([])
    const [stats, setStats] = useState<any>({ total_users: 0, total_courts: 0, today_matches: 0 })
    const [loading, setLoading] = useState(true)
    const [postContent, setPostContent] = useState('')
    const [postType, setPostType] = useState('share')
    const [posting, setPosting] = useState(false)
    const [postImage, setPostImage] = useState<string | null>(null)
    const [showCamera, setShowCamera] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        loadData()
    }, [])

    useEffect(() => {
        const socket = socketIO('http://localhost:5000', { transports: ['websocket'] })

        socket.on('post_created', (newPost: any) => {
            if (!newPost?.id) return
            setPosts(prev => {
                if (prev.some((p: any) => p.id === newPost.id)) return prev
                return [newPost, ...prev]
            })
        })

        socket.on('post_deleted', ({ postId }: { postId: number }) => {
            if (!postId) return
            setPosts(prev => prev.filter((p: any) => p.id !== postId))
        })

        socket.on('post_liked', ({ postId, likes }: { postId: number; likes: number }) => {
            if (!postId) return
            setPosts(prev => prev.map((p: any) => p.id === postId ? { ...p, likes } : p))
        })

        socket.on('post_commented', ({ postId, comments }: { postId: number; comments: number }) => {
            if (!postId) return
            setPosts(prev => prev.map((p: any) => p.id === postId ? { ...p, comments } : p))
        })

        return () => {
            socket.disconnect()
        }
    }, [])

    useEffect(() => {
        if (loading) return
        const savedY = sessionStorage.getItem(HOME_SCROLL_KEY)
        if (!savedY) return

        const y = Number(savedY)
        if (!Number.isNaN(y)) {
            requestAnimationFrame(() => {
                window.scrollTo({ top: y, behavior: 'auto' })
            })
        }
        sessionStorage.removeItem(HOME_SCROLL_KEY)
    }, [loading, posts.length])

   const loadData = async () => {
        try {
            const [postsRes, matchesRes, facilitiesRes] = await Promise.all([
                api.get('/posts'),
                api.get('/matches?status=waiting').catch(() => ({ data: [] })),
                api.get('/facilities')
            ])
            setPosts(postsRes.data)
            setMatches(matchesRes.data?.slice(0, 3) || [])
            setFacilities(facilitiesRes.data?.slice(0, 3) || [])

            // Try to get stats (may fail if not admin, that's ok)
            try {
                const statsRes = await api.get('/stats/admin')
                setStats(statsRes.data)
            } catch {
                // Fallback: count from loaded data
                setStats({
                    total_users: '-',
                    total_facilities: facilitiesRes.data?.length || 0,
                    today_matches: matchesRes.data?.length || 0
                })
            }
        } catch (err) {
            console.error('Load data error:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        if (file.size > 5 * 1024 * 1024) {
            void showAlert('Ảnh quá lớn! Vui lòng chọn ảnh nhỏ hơn 5MB.')
            return
        }
        const reader = new FileReader()
        reader.onload = (ev) => setPostImage(ev.target?.result as string)
        reader.readAsDataURL(file)
        // reset input value so same file can be re-selected
        e.target.value = ''
    }

    const handleCaptured = (base64: string) => {
        setPostImage(base64)
        setShowCamera(false)
    }

    const handleCreatePost = async () => {
        if (!postContent.trim() && !postImage) return
        setPosting(true)
        try {
            const res = await api.post('/posts', {
                content: postContent,
                post_type: postType,
                image: postImage || null
            })

            if (res.data?.post?.id) {
                setPosts(prev => {
                    const post = res.data.post
                    if (prev.some((p: any) => p.id === post.id)) return prev
                    return [post, ...prev]
                })
            }

            setPostContent('')
            setPostType('share')
            setPostImage(null)
        } catch (err: any) {
            await showAlert(err.response?.data?.message || 'Lỗi khi đăng bài')
        } finally {
            setPosting(false)
        }
    }

    // filter out hidden posts and optionally by type
    // include hidden posts but mark them so we can render a placeholder
    const postsWithFlag = posts.map(p => ({ ...p, isHidden: hiddenPosts.includes(p.id) }))
    const filteredPosts = postsWithFlag
        .filter(p => ['share', 'find_player', 'ad', 'event'].includes(filter) ? p.post_type === filter : true)

    const filters = [
        { key: 'latest', label: '🕐 Mới nhất' },
        { key: 'popular', label: '🔥 Phổ biến' },
        { key: 'share', label: '📸 Chia sẻ' },
        { key: 'find_player', label: '🎯 Tìm người chơi' },
        { key: 'event', label: '🎉 Sự kiện' },
        { key: 'ad', label: '📢 Quảng cáo' }
    ]

    const formatPrice = (p) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(p)

    if (loading) return <div className={styles.homePage} style={{ textAlign: 'center', padding: '60px 20px' }}>⏳ Đang tải...</div>

    const handleHide = (id) => {
        setHiddenPosts(prev => {
            let updated
            if (prev.includes(id)) {
                // unhide
                updated = prev.filter(x => x !== id)
            } else {
                updated = [...prev, id]
            }
            localStorage.setItem('hiddenPosts', JSON.stringify(updated))
            return updated
        })
    }

    const handleDelete = (id) => {
        setPosts(prev => prev.filter(p => p.id !== id))
    }

    return (
        <div className={styles.homePage}>
            {/* Hero */}
            <div className={styles.hero}>
                <div className={styles.heroContent}>
                    <h1 className={styles.heroTitle}>
                        Chào {user?.full_name}! 🏓
                    </h1>
                    <p className={styles.heroSubtitle}>
                        Khám phá cộng đồng Pickleball sôi động nhất Đà Nẵng
                    </p>
                    <div className={styles.heroStats}>
                        <div className={styles.heroStat}>
                            <div className={styles.heroStatValue}>{stats.total_users}</div>
                            <div className={styles.heroStatLabel}>Người chơi</div>
                        </div>
                        <div className={styles.heroStat}>
                            <div className={styles.heroStatValue}>{stats.total_facilities || stats.total_courts}</div>
                            <div className={styles.heroStatLabel}>Cơ sở</div>
                        </div>
                        <div className={styles.heroStat}>
                            <div className={styles.heroStatValue}>{stats.today_matches}</div>
                            <div className={styles.heroStatLabel}>Trận hôm nay</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Create Post */}
            <div className={styles.createPost}>
                <div className="avatar" style={{ overflow: 'hidden' }}>
                    {user?.avatar ? (
                        <img src={user.avatar} alt={user.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                    ) : (user?.full_name?.charAt(0) || '?')}
                </div>
                <div style={{ flex: 1 }}>
                    <textarea
                        className={styles.createPostInput}
                        placeholder="Bạn đang nghĩ gì? Chia sẻ với cộng đồng..."
                        value={postContent}
                        onChange={e => setPostContent(e.target.value)}
                        rows={2}
                        style={{ width: '100%', resize: 'vertical', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '10px 14px', color: 'var(--text-primary)', fontSize: '0.875rem' }}
                    />

                    {/* Image Preview */}
                    {postImage && (
                        <div className={styles.imagePreview}>
                            <img src={postImage} alt="preview" className={styles.previewImg} />
                            <button
                                className={styles.removeImageBtn}
                                onClick={() => setPostImage(null)}
                                title="Xóa ảnh"
                            >✕</button>
                        </div>
                    )}

                    <div className={styles.createPostActions}>
                        {/* Image tools */}
                        <div className={styles.imageTools}>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                style={{ display: 'none' }}
                                onChange={handleImageChange}
                            />
                            <button
                                type="button"
                                className={styles.imageTool}
                                onClick={() => fileInputRef.current?.click()}
                                title="Chọn ảnh từ thư mục"
                            >
                                🖼️ Ảnh
                            </button>
                            <button
                                type="button"
                                className={styles.imageTool}
                                onClick={() => setShowCamera(true)}
                                title="Chụp ảnh bằng webcam"
                            >
                                📸 Chụp
                            </button>
                        </div>

                        <select value={postType} onChange={e => setPostType(e.target.value)} className={styles.postTypeSelect}>
                            <option value="share">📸 Chia sẻ</option>
                            <option value="find_player">🎯 Tìm bạn chơi</option>
                            <option value="event">🎉 Sự kiện</option>
                            <option value="ad">📢 Quảng cáo</option>
                        </select>
                        <button className="btn btn-primary btn-sm" onClick={handleCreatePost}
                            disabled={posting || (!postContent.trim() && !postImage)}>
                            {posting ? '⏳...' : '📤 Đăng'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Camera Modal */}
            {showCamera && (
                <CameraModal onCapture={handleCaptured} onClose={() => setShowCamera(false)} />
            )}

            {/* Filters */}
            <div className={styles.filters}>
                {filters.map(f => (
                    <button
                        key={f.key}
                        className={`${styles.filterBtn} ${filter === f.key ? styles.active : ''}`}
                        onClick={() => setFilter(f.key)}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {/* Main Layout */}
            <div className={styles.mainLayout}>
                {/* Feed */}
                <div className={styles.feed}>
                    {filteredPosts.length > 0 ? filteredPosts.map(post => (
                        <PostCard key={post.id} post={post} isHidden={post.isHidden} onHide={handleHide} onDeleted={handleDelete} />
                    )) : (
                        <div className="glass-card" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
                            📝 Chưa có bài viết nào. Hãy là người đầu tiên chia sẻ!
                        </div>
                    )}
                </div>

                {/* Sidebar */}
                <div className={styles.sidebar}>
                    {/* Matches */}
                    <div className={styles.sidebarCard}>
                        <h3 className={styles.sidebarTitle}>🎯 Trận đang chờ ghép</h3>
                        {matches.length > 0 ? matches.map((m) => (
                            <div key={m.id} className={styles.matchItem} onClick={() => navigate(`/matches/${m.id}`)} style={{ cursor: 'pointer' }}>
                                <div className={styles.matchItemInfo}>
                                    <div className={styles.matchItemName}>{m.court_name}</div>
                                    <div className={styles.matchItemTime}>{formatDateVN(m.match_date)} {formatTimeHHmm(m.start_time)}</div>
                                </div>
                                <div className={styles.matchItemSpots}>{m.max_players - m.current_players} chỗ trống</div>
                            </div>
                        )) : (
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', padding: '8px 0' }}>
                                Chưa có trận nào đang chờ
                            </div>
                        )}
                        <button className="btn btn-primary btn-sm" style={{ width: '100%', marginTop: '12px' }}
                            onClick={() => navigate('/matchmaking')}>
                            Xem tất cả
                        </button>
                    </div>

                    {/* Facilities */}
                    <div className={styles.sidebarCard}>
                        <h3 className={styles.sidebarTitle}>🏟️ Cơ sở nổi bật</h3>
                        {facilities.length > 0 ? facilities.map((f: any) => (
                            <div key={f.id} className={styles.courtItem} onClick={() => navigate(`/facilities/${f.id}`)} style={{ cursor: 'pointer' }}>
                                <div className={styles.courtItemIcon}>🏟️</div>
                                <div className={styles.courtItemInfo}>
                                    <div className={styles.courtItemName}>{f.name}</div>
                                    <div className={styles.courtItemPrice}>Từ {formatPrice(f.min_price)}/h</div>
                                </div>
                            </div>
                        )) : (
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', padding: '8px 0' }}>
                                Chưa có cơ sở nào
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
