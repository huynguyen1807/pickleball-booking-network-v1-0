import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import styles from '../styles/Cards.module.css'

export default function PostCard({ post }) {
    const { user } = useAuth()
    const data = post || {
        id: 1,
        user_name: 'Nguyễn Văn A',
        user_role: 'user',
        content: 'Tìm 2 bạn chơi pickleball tối nay tại sân Hòa Xuân!',
        image: null,
        post_type: 'find_player',
        is_promoted: false,
        created_at: new Date().toISOString(),
        likes: 12,
        comments: 5
    }

    const [liked, setLiked] = useState(false)
    const [likeCount, setLikeCount] = useState(data.likes || 0)
    const [showShare, setShowShare] = useState(false)
    const [showComments, setShowComments] = useState(false)
    const [commentsList, setCommentsList] = useState([])
    const [commentText, setCommentText] = useState('')
    const [commentCount, setCommentCount] = useState(data.comments || 0)

    const getInitials = (name) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?'
    const timeAgo = (date) => {
        const diff = Date.now() - new Date(date).getTime()
        const mins = Math.floor(diff / 60000)
        if (mins < 60) return `${mins} phút trước`
        const hours = Math.floor(mins / 60)
        if (hours < 24) return `${hours} giờ trước`
        return `${Math.floor(hours / 24)} ngày trước`
    }

    const typeLabels = {
        find_player: { text: '🎯 Tìm người chơi', class: 'green' },
        share: { text: '📸 Chia sẻ', class: 'blue' },
        ad: { text: '📢 Quảng cáo', class: 'yellow' },
        event: { text: '🎉 Sự kiện', class: 'purple' }
    }

    const typeInfo = typeLabels[data.post_type] || typeLabels.share

    const handleLike = () => {
        setLiked(prev => !prev)
        setLikeCount(prev => liked ? prev - 1 : prev + 1)
    }

    const shareUrl = encodeURIComponent(window.location.origin + `/post/${data.id}`)
    const shareText = encodeURIComponent(data.content?.substring(0, 100) || 'Xem bài đăng trên PickleBall Đà Nẵng')

    const handleShareFacebook = () => {
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${shareUrl}&quote=${shareText}`, '_blank', 'width=600,height=400')
        setShowShare(false)
    }

    const handleShareMessenger = () => {
        window.open(`https://www.facebook.com/dialog/send?link=${shareUrl}&app_id=0&redirect_uri=${encodeURIComponent(window.location.href)}`, '_blank', 'width=600,height=400')
        setShowShare(false)
    }

    const handleCopyLink = () => {
        navigator.clipboard.writeText(window.location.origin + `/post/${data.id}`)
        setShowShare(false)
        alert('Đã sao chép link!')
    }

    const handleAddComment = (e) => {
        e.preventDefault()
        if (!commentText.trim()) return
        setCommentsList(prev => [...prev, {
            id: Date.now(),
            user_name: user?.full_name || 'Bạn',
            content: commentText,
            created_at: new Date().toISOString()
        }])
        setCommentCount(prev => prev + 1)
        setCommentText('')
    }

    return (
        <div className={`${styles.postCard} ${data.is_promoted ? styles.promoted : ''}`}>
            {data.is_promoted && <div className={styles.promotedBadge}>⚡ Được tài trợ</div>}

            <div className={styles.postHeader}>
                <div className="avatar">{getInitials(data.user_name)}</div>
                <div className={styles.postMeta}>
                    <div className={styles.postAuthor}>
                        {data.user_name}
                        {data.user_role === 'owner' && <span className={`badge badge-yellow`}>Owner</span>}
                    </div>
                    <div className={styles.postTime}>{timeAgo(data.created_at)}</div>
                </div>
                <span className={`badge badge-${typeInfo.class}`}>{typeInfo.text}</span>
            </div>

            <div className={styles.postContent}>{data.content}</div>

            {data.image && <img src={data.image} alt="" className={styles.postImage} />}

            {/* Like / Comment / Share Actions */}
            <div className={styles.postActions}>
                {/* LIKE button — SVG heart */}
                <button className={`${styles.actionBtn} ${liked ? styles.likedBtn : ''}`} onClick={handleLike}>
                    <svg
                        className={styles.heartIcon}
                        width="18" height="18"
                        viewBox="0 0 24 24"
                        fill={liked ? '#ef4444' : 'none'}
                        stroke={liked ? '#ef4444' : 'currentColor'}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                    <span className={liked ? styles.likedText : ''}>{likeCount}</span>
                </button>

                {/* COMMENT button */}
                <button className={styles.actionBtn} onClick={() => setShowComments(prev => !prev)}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    <span>{commentCount}</span>
                </button>

                {/* SHARE button */}
                <div style={{ position: 'relative', flex: 1 }}>
                    <button className={styles.actionBtn} style={{ width: '100%' }} onClick={() => setShowShare(prev => !prev)}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="18" cy="5" r="3" />
                            <circle cx="6" cy="12" r="3" />
                            <circle cx="18" cy="19" r="3" />
                            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                        </svg>
                        <span>Chia sẻ</span>
                    </button>

                    {/* Share dropdown */}
                    {showShare && (
                        <div className={styles.shareDropdown}>
                            <button className={styles.shareOption} onClick={handleShareFacebook}>
                                <span className={styles.shareOptionIcon} style={{ color: '#1877F2' }}>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2">
                                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                                    </svg>
                                </span>
                                Facebook
                            </button>
                            <button className={styles.shareOption} onClick={handleShareMessenger}>
                                <span className={styles.shareOptionIcon} style={{ color: '#0099FF' }}>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="#0099FF">
                                        <path d="M12 0C5.373 0 0 4.974 0 11.111c0 3.498 1.744 6.614 4.469 8.654V24l4.088-2.242c1.092.3 2.246.464 3.443.464 6.627 0 12-4.975 12-11.111S18.627 0 12 0zm1.191 14.963l-3.055-3.26-5.963 3.26L10.732 8.2l3.131 3.259L19.752 8.2l-6.561 6.763z" />
                                    </svg>
                                </span>
                                Messenger
                            </button>
                            <button className={styles.shareOption} onClick={handleCopyLink}>
                                <span className={styles.shareOptionIcon}>🔗</span>
                                Sao chép link
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Comments Section */}
            {showComments && (
                <div className={styles.commentsSection}>
                    {/* Comment list */}
                    {commentsList.length > 0 && (
                        <div className={styles.commentsList}>
                            {commentsList.map(c => (
                                <div key={c.id} className={styles.commentItem}>
                                    <div className={`avatar avatar-sm ${styles.commentAvatar}`}>{getInitials(c.user_name)}</div>
                                    <div className={styles.commentBubble}>
                                        <span className={styles.commentUser}>{c.user_name}</span>
                                        <span className={styles.commentText}>{c.content}</span>
                                        <span className={styles.commentTime}>{timeAgo(c.created_at)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Comment input */}
                    <form className={styles.commentForm} onSubmit={handleAddComment}>
                        <div className={`avatar avatar-sm`}>{getInitials(user?.full_name)}</div>
                        <input
                            type="text"
                            className={styles.commentInput}
                            placeholder="Viết bình luận..."
                            value={commentText}
                            onChange={e => setCommentText(e.target.value)}
                        />
                        <button type="submit" className={styles.commentSendBtn} disabled={!commentText.trim()}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="22" y1="2" x2="11" y2="13" />
                                <polygon points="22 2 15 22 11 13 2 9 22 2" />
                            </svg>
                        </button>
                    </form>
                </div>
            )}
        </div>
    )
}
