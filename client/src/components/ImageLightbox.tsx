import { useEffect, useCallback, useState, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useDialog } from '../context/DialogContext'
import api from '../api/axios'
import { io as socketIO } from 'socket.io-client'
import UserProfileCard from './UserProfileCard'
import styles from '../styles/ImageLightbox.module.css'

interface LightboxProps {
    imageUrl: string
    post: any
    onClose: () => void
}

export default function ImageLightbox({ imageUrl, post, onClose }: LightboxProps) {
    const { user } = useAuth()
    const { showAlert } = useDialog()
    const [liked, setLiked] = useState(false)
    const [likeCount, setLikeCount] = useState(post?.likes || 0)
    const [commentsList, setCommentsList] = useState<any[]>([])
    const [commentText, setCommentText] = useState('')
    const [commentCount, setCommentCount] = useState(post?.comments || 0)
    const [shareCount, setShareCount] = useState(post?.shares || 0)
    const [showShare, setShowShare] = useState(false)
    const [zoomed, setZoomed] = useState(false)
    const [loadingComments, setLoadingComments] = useState(true)
    const commentsEndRef = useRef<HTMLDivElement>(null)

    // Load comments immediately
    useEffect(() => {
        if (!post?.id) return
        api.get(`/posts/${post.id}/comments`)
            .then(r => { setCommentsList(r.data || []); setLoadingComments(false) })
            .catch(() => setLoadingComments(false))
    }, [post?.id])

    // Socket real-time
    useEffect(() => {
        if (!post?.id) return
        const socket = socketIO('http://localhost:5000', { transports: ['websocket'] })
        socket.emit('join_post', post.id)

        socket.on('post_liked', (data: { postId: number; likes: number }) => {
            if (data.postId === post.id) setLikeCount(data.likes)
        })
        socket.on('post_commented', (data: { postId: number; comment: any; comments: number }) => {
            if (data.postId === post.id) {
                setCommentsList(prev => {
                    // avoid duplicate if it's our own comment already added
                    if (prev.find(c => c.id === data.comment?.id)) return prev
                    return [data.comment, ...prev]
                })
                setCommentCount(data.comments)
            }
        })

        return () => {
            socket.emit('leave_post', post.id)
            socket.disconnect()
        }
    }, [post?.id])

    // ESC to close
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
        document.addEventListener('keydown', handler)
        document.body.style.overflow = 'hidden'
        return () => {
            document.removeEventListener('keydown', handler)
            document.body.style.overflow = ''
        }
    }, [onClose])

    const handleLike = async () => {
        if (!user) return
        try {
            if (!liked) {
                const res = await api.post(`/posts/${post.id}/like`)
                setLikeCount(res.data.likes ?? likeCount + 1)
                setLiked(true)
            } else {
                const res = await api.delete(`/posts/${post.id}/like`)
                setLikeCount(res.data.likes ?? Math.max(0, likeCount - 1))
                setLiked(false)
            }
        } catch { }
    }

    const handleAddComment = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!commentText.trim() || !user) return
        const tempText = commentText
        setCommentText('')
        try {
            const res = await api.post(`/posts/${post.id}/comments`, { content: tempText })
            // Add optimistically (socket also may add, de-dup handled above)
            const newComment = res.data.comment || {
                id: Date.now(),
                user_name: user.full_name,
                content: tempText,
                created_at: new Date().toISOString()
            }
            setCommentsList(prev => {
                if (prev.find(c => c.id === newComment.id)) return prev
                return [newComment, ...prev]
            })
            setCommentCount(res.data.comments || commentCount + 1)
        } catch { setCommentText(tempText) }
    }

    const handleShareFacebook = () => {
        const shareUrl = encodeURIComponent(window.location.origin + `/post/${post?.id}`)
        const shareText = encodeURIComponent(post?.content?.substring(0, 100) || '')
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${shareUrl}&quote=${shareText}`, '_blank', 'width=600,height=400')
        if (user) api.post(`/posts/${post.id}/share`).then(r => setShareCount(r.data.shares)).catch(() => { })
        setShowShare(false)
    }
    const handleCopyLink = () => {
        navigator.clipboard.writeText(window.location.origin + `/post/${post?.id}`)
        if (user) api.post(`/posts/${post.id}/share`).then(r => setShareCount(r.data.shares)).catch(() => { })
        setShowShare(false)
        void showAlert('Đã sao chép link!')
    }

    const getInitials = (name?: string) => {
        if (!name) return '?'
        const parts = name.trim().split(' ')
        return parts.length >= 2
            ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
            : name.slice(0, 2).toUpperCase()
    }
    const timeAgo = (date?: string | null) => {
        if (!date) return ''
        const d = new Date(date)
        const diff = Date.now() - d.getTime()
        if (diff < 0) return 'Vừa xong'
        const mins = Math.floor(diff / 60000)
        if (mins < 1) return 'Vừa xong'
        if (mins < 60) return `${mins} phút trước`
        const hours = Math.floor(mins / 60)
        if (hours < 24) return `${hours} giờ trước`
        if (hours < 48) return `Hôm qua lúc ${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`
        return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    }

    return (
        <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
            <div className={styles.lightbox}>
                {/* Close button */}
                <button className={styles.closeBtn} onClick={onClose} title="Đóng (ESC)">✕</button>

                {/* Image area */}
                <div className={styles.imageArea} onClick={e => e.target === e.currentTarget && setZoomed(false)}>
                    <img
                        src={imageUrl}
                        alt="Post image"
                        className={`${styles.image} ${zoomed ? styles.zoomed : ''}`}
                        onClick={() => setZoomed(z => !z)}
                        title={zoomed ? 'Click để thu nhỏ' : 'Click để phóng to'}
                    />
                    <div className={styles.zoomHint}>
                        {zoomed ? '🔍 Click để thu nhỏ' : '🔍 Click để phóng to'}
                    </div>
                </div>

                {/* Side panel */}
                <div className={styles.sidePanel}>
                    {/* Author */}
                    <div className={styles.postHeader}>
                        {post?.user_id ? (
                            <UserProfileCard userId={post.user_id}>
                                <div className="avatar avatar-sm" style={{ cursor: 'pointer' }}>{getInitials(post?.user_name)}</div>
                            </UserProfileCard>
                        ) : (
                            <div className="avatar avatar-sm">{getInitials(post?.user_name)}</div>
                        )}
                        <div>
                            <div className={styles.authorName}>{post?.user_name}</div>
                            <div className={styles.postTime}>{timeAgo(post?.created_at)}</div>
                        </div>
                    </div>

                    {/* Caption */}
                    {post?.content && (
                        <div className={styles.caption}>{post.content}</div>
                    )}

                    {/* Like / share summary */}
                    <div className={styles.likeSummary}>
                        <span>❤️ {likeCount} lượt thích</span>
                        <span>💬 {commentCount} bình luận • 🔗 {shareCount} chia sẻ</span>
                    </div>

                    {/* Action buttons */}
                    <div className={styles.actions}>
                        <button className={`${styles.actionBtn} ${liked ? styles.liked : ''}`} onClick={handleLike}>
                            <svg width="18" height="18" viewBox="0 0 24 24"
                                fill={liked ? '#ef4444' : 'none'}
                                stroke={liked ? '#ef4444' : 'currentColor'}
                                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                            </svg>
                            Thích
                        </button>

                        <div style={{ position: 'relative' }}>
                            <button className={styles.actionBtn} onClick={() => setShowShare(v => !v)}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                                </svg>
                                Chia sẻ
                            </button>
                            {showShare && (
                                <div className={styles.shareDropdown}>
                                    <button className={styles.shareOption} onClick={handleShareFacebook}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="#1877F2">
                                            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                                        </svg>
                                        Facebook
                                    </button>
                                    <button className={styles.shareOption} onClick={handleCopyLink}>🔗 Sao chép link</button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Comments --- always visible */}
                    <div className={styles.commentsSection}>
                        <div className={styles.commentsHeader}>
                            Bình luận
                            <span style={{ color: '#00e676', fontWeight: 800, marginLeft: 4 }}>● LIVE</span>
                        </div>
                        <div className={styles.commentsList}>
                            {loadingComments ? (
                                <div className={styles.noComments}>⏳ Đang tải...</div>
                            ) : commentsList.length > 0 ? commentsList.map((c: any) => (
                                <div key={c.id || c.created_at} className={styles.commentItem}>
                                    {c.user_id ? (
                                        <UserProfileCard userId={c.user_id}>
                                            <div className="avatar avatar-sm" style={{ flexShrink: 0, fontSize: '0.65rem', cursor: 'pointer' }}>
                                                {getInitials(c.user_name || c.full_name)}
                                            </div>
                                        </UserProfileCard>
                                    ) : (
                                        <div className="avatar avatar-sm" style={{ flexShrink: 0, fontSize: '0.65rem' }}>
                                            {getInitials(c.user_name || c.full_name)}
                                        </div>
                                    )}
                                    <div className={styles.commentBubble}>
                                        <span className={styles.commentUser}>{c.user_name || c.full_name}</span>
                                        <span className={styles.commentText}>{c.content}</span>
                                        <span className={styles.commentTime}>{timeAgo(c.created_at)}</span>
                                    </div>
                                </div>
                            )) : (
                                <div className={styles.noComments}>💬 Chưa có bình luận nào. Hãy là người đầu tiên!</div>
                            )}
                            <div ref={commentsEndRef} />
                        </div>

                        <form className={styles.commentForm} onSubmit={handleAddComment}>
                            <div className="avatar avatar-sm" style={{ fontSize: '0.65rem', flexShrink: 0 }}>
                                {getInitials(user?.full_name)}
                            </div>
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
        </div>
    )
}
