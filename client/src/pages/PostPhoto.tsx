import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useDialog } from '../context/DialogContext'
import api from '../api/axios'
import { io as socketIO } from 'socket.io-client'
import UserProfileCard from '../components/UserProfileCard'
import styles from '../styles/PostPhoto.module.css'

export default function PostPhoto() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const { user } = useAuth()
    const { showAlert } = useDialog()

    const [post, setPost] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [notFound, setNotFound] = useState(false)

    const [liked, setLiked] = useState(false)
    const [likeCount, setLikeCount] = useState(0)
    const [commentsList, setCommentsList] = useState<any[]>([])
    const [commentCount, setCommentCount] = useState(0)
    const [shareCount, setShareCount] = useState(0)
    const [commentText, setCommentText] = useState('')
    const [showShare, setShowShare] = useState(false)
    const [zoomed, setZoomed] = useState(false)
    const [loadingComments, setLoadingComments] = useState(true)
    const commentsEndRef = useRef<HTMLDivElement>(null)

    // Load post
    useEffect(() => {
        if (!id) return
        api.get(`/posts/${id}`)
            .then(r => {
                setPost(r.data)
                setLikeCount(r.data.likes || 0)
                setCommentCount(r.data.comments || 0)
                setShareCount(r.data.shares || 0)
                setLoading(false)
                // Update page title & meta
                document.title = `Ảnh của ${r.data.user_name} | PickleBall`
            })
            .catch(() => { setNotFound(true); setLoading(false) })
    }, [id])

    // Load comments
    useEffect(() => {
        if (!id) return
        api.get(`/posts/${id}/comments`)
            .then(r => { setCommentsList(r.data || []); setLoadingComments(false) })
            .catch(() => setLoadingComments(false))
    }, [id])

    // Socket real-time
    useEffect(() => {
        if (!id) return
        const socket = socketIO('http://localhost:5000', { transports: ['websocket'] })
        socket.emit('join_post', parseInt(id))
        socket.on('post_liked', (ev: { postId: number; likes: number }) => {
            if (ev.postId === parseInt(id!)) setLikeCount(ev.likes)
        })
        socket.on('post_commented', (ev: { postId: number; comment: any; comments: number }) => {
            if (ev.postId === parseInt(id!)) {
                setCommentsList(prev => {
                    if (prev.find(c => c.id === ev.comment?.id)) return prev
                    return [ev.comment, ...prev]
                })
                setCommentCount(ev.comments)
            }
        })
        return () => { socket.emit('leave_post', parseInt(id)); socket.disconnect() }
    }, [id])

    // ESC to go home
    useEffect(() => {
        const h = (e: KeyboardEvent) => { if (e.key === 'Escape') navigate(-1 as any) }
        document.addEventListener('keydown', h)
        document.body.style.overflow = 'hidden'
        return () => { document.removeEventListener('keydown', h); document.body.style.overflow = '' }
    }, [navigate])

    const handleLike = async () => {
        if (!user) return
        try {
            if (!liked) {
                const res = await api.post(`/posts/${id}/like`)
                setLikeCount(res.data.likes ?? likeCount + 1)
                setLiked(true)
            } else {
                const res = await api.delete(`/posts/${id}/like`)
                setLikeCount(res.data.likes ?? Math.max(0, likeCount - 1))
                setLiked(false)
            }
        } catch { }
    }

    const handleAddComment = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!commentText.trim() || !user) return
        const tmp = commentText; setCommentText('')
        try {
            const res = await api.post(`/posts/${id}/comments`, { content: tmp })
            const nc = res.data.comment || { id: Date.now(), user_name: user.full_name, content: tmp, created_at: new Date().toISOString() }
            setCommentsList(prev => prev.find(c => c.id === nc.id) ? prev : [nc, ...prev])
            setCommentCount(res.data.comments || commentCount + 1)
        } catch { setCommentText(tmp) }
    }

    const handleCopyLink = () => {
        navigator.clipboard.writeText(window.location.href)
        void showAlert('Đã sao chép link ảnh!')
        setShowShare(false)
    }
    const handleShareFb = () => {
        const url = encodeURIComponent(window.location.href)
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank', 'width=600,height=400')
        if (user) api.post(`/posts/${id}/share`).then(r => setShareCount(r.data.shares)).catch(() => { })
        setShowShare(false)
    }

    const getInitials = (name?: string) => {
        if (!name) return '?'
        const p = name.trim().split(' ')
        return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase()
    }
    const timeAgo = (date?: string | null) => {
        if (!date) return ''
        const d = new Date(date)
        const diff = Date.now() - d.getTime()
        if (diff < 0) return 'Vừa xong'
        const m = Math.floor(diff / 60000)
        if (m < 1) return 'Vừa xong'
        if (m < 60) return `${m} phút trước`
        const h = Math.floor(m / 60)
        if (h < 24) return `${h} giờ trước`
        if (h < 48) return `Hôm qua lúc ${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`
        return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    }

    if (loading) return (
        <div className={styles.loadingScreen}>
            <div className={styles.spinner} />
            <p>Đang tải ảnh...</p>
        </div>
    )

    if (notFound || !post?.image) return (
        <div className={styles.loadingScreen}>
            <div style={{ fontSize: '4rem', marginBottom: 16 }}>🖼️</div>
            <p style={{ color: '#b0b3b8', marginBottom: 20 }}>
                {notFound ? 'Không tìm thấy bài viết này.' : 'Bài viết này không có ảnh.'}
            </p>
            <button className={styles.backBtn} onClick={() => navigate(-1 as any)}>← Về trang chủ</button>
        </div>
    )

    return (
        <div className={styles.page}>
            {/* Close / Back to Home button */}
            <button
                className={styles.closeBtn}
                onClick={() => navigate(-1 as any)}
                title="Về trang chủ (ESC)"
            >
                ✕
            </button>

            {/* Left: Image */}
            <div className={styles.imageArea} onClick={e => { if (e.target === e.currentTarget) setZoomed(false) }}>
                <img
                    src={post.image}
                    alt="Post photo"
                    className={`${styles.image} ${zoomed ? styles.zoomed : ''}`}
                    onClick={() => setZoomed(z => !z)}
                    title={zoomed ? 'Click để thu nhỏ' : 'Click để phóng to'}
                />
                <div className={styles.zoomHint}>
                    {zoomed ? '🔍 Click để thu nhỏ' : '🔍 Click để phóng to'}
                </div>
            </div>

            {/* Right: Panel */}
            <div className={styles.panel}>
                <div className={styles.panelHeader}>
                    <div className={styles.logo} onClick={() => navigate(-1 as any)}>🏓 PickleBall</div>
                    <button className={styles.viewPostBtn} onClick={() => navigate(-1 as any)}
                        title="Quay về trang chủ">
                        ← Trang chủ
                    </button>
                </div>

                {/* Author info */}
                <div className={styles.authorRow}>
                    {post.user_id ? (
                        <UserProfileCard userId={post.user_id}>
                            <div className={styles.avatar} style={{ cursor: 'pointer' }}>{getInitials(post.user_name)}</div>
                        </UserProfileCard>
                    ) : (
                        <div className={styles.avatar}>{getInitials(post.user_name)}</div>
                    )}
                    <div>
                        <div className={styles.authorName}>{post.user_name}</div>
                        <div className={styles.postTime}>{timeAgo(post.created_at)}</div>
                    </div>
                    {/* share button */}
                    <div style={{ marginLeft: 'auto', position: 'relative' }}>
                        <button className={styles.moreBtn} onClick={() => setShowShare(v => !v)}>···</button>
                        {showShare && (
                            <div className={styles.shareDropdown}>
                                <button className={styles.shareOption} onClick={handleShareFb}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                                    Chia sẻ lên Facebook
                                </button>
                                <button className={styles.shareOption} onClick={handleCopyLink}>🔗 Sao chép link ảnh</button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Caption */}
                {post.content && <div className={styles.caption}>{post.content}</div>}

                {/* Like/comment summary */}
                <div className={styles.summary}>
                    {likeCount > 0 && <span>❤️ {likeCount}</span>}
                    {commentCount > 0 && <span>💬 {commentCount} bình luận</span>}
                </div>

                {/* Action bar */}
                <div className={styles.actions}>
                    <button className={`${styles.actionBtn} ${liked ? styles.liked : ''}`} onClick={handleLike}>
                        <svg width="18" height="18" viewBox="0 0 24 24"
                            fill={liked ? '#ef4444' : 'none'} stroke={liked ? '#ef4444' : 'currentColor'}
                            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                        </svg>
                        Thích
                    </button>
                    <button className={styles.actionBtn}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                        Bình luận
                    </button>
                </div>

                {/* Comments */}
                <div className={styles.comments}>
                    <div className={styles.commentsList}>
                        {loadingComments ? (
                            <div className={styles.noComments}>⏳ Đang tải...</div>
                        ) : commentsList.length > 0 ? commentsList.map((c: any) => (
                            <div key={c.id || c.created_at} className={styles.commentItem}>
                                {c.user_id ? (
                                    <UserProfileCard userId={c.user_id}>
                                        <div className={styles.commentAvatar} style={{ cursor: 'pointer' }}>{getInitials(c.user_name || c.full_name)}</div>
                                    </UserProfileCard>
                                ) : (
                                    <div className={styles.commentAvatar}>{getInitials(c.user_name || c.full_name)}</div>
                                )}
                                <div className={styles.commentBubble}>
                                    <span className={styles.commentUser}>{c.user_name || c.full_name}</span>
                                    <span className={styles.commentText}>{c.content}</span>
                                    <span className={styles.commentTime}>{timeAgo(c.created_at)}</span>
                                </div>
                            </div>
                        )) : (
                            <div className={styles.noComments}>
                                <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>📋</div>
                                <div style={{ fontWeight: 600, color: '#ccc', marginBottom: 4 }}>Chưa có bình luận nào</div>
                                <div style={{ fontSize: '0.8rem', color: '#888' }}>Hãy là người đầu tiên bình luận.</div>
                            </div>
                        )}
                        <div ref={commentsEndRef} />
                    </div>

                    {/* Comment input */}
                    <form className={styles.commentForm} onSubmit={handleAddComment}>
                        <div className={styles.commentAvatar} style={{ flexShrink: 0 }}>{getInitials(user?.full_name)}</div>
                        <input
                            className={styles.commentInput}
                            placeholder="Viết bình luận..."
                            value={commentText}
                            onChange={e => setCommentText(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment(e as any) } }}
                        />
                        <button type="submit" className={styles.sendBtn} disabled={!commentText.trim()}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                            </svg>
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}
