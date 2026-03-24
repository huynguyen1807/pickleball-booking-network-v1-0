import React, { useState, useEffect, FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'
import { io as socketIO } from 'socket.io-client'
import UserProfileCard from './UserProfileCard'
import ReportModal from './ReportModal'
import { useDialog } from '../context/DialogContext'
import styles from '../styles/Cards.module.css'

type PostType = any
type CommentType = any

interface PostCardProps {
    post?: PostType
    isHidden?: boolean
    onDeleted?: (id: number) => void
    onHide?: (id: number) => void
}

const HOME_SCROLL_KEY = 'home_feed_scroll_y'

const parseFindPlayerPost = (content?: string) => {
    if (!content) return null

    const lines = content
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean)

    const titleLine = lines.find(l => l.includes('Tìm người chơi')) || ''
    const dateLine = lines.find(l => l.includes('🗓️') || l.includes('📅')) || ''
    const priceLine = lines.find(l => l.includes('💰')) || ''
    const noteLine = lines.find(l => l.toLowerCase().startsWith('ghi chú:')) || ''

    const formatMatch = titleLine.match(/\b(1v1|2v2)\b/i)
    const courtMatch = titleLine.match(/tại\s+(.+?)\s*\((.+?)\)/i)
    const dateTimeMatch = dateLine.match(/(\d{1,2}\/\d{1,2}\/\d{4}).*?(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/)
    const priceMatch = priceLine.match(/([\d.,]+)\s*đ?\s*\/\s*người/i)
    const skillMatch = dateLine.match(/trình độ\s+(.+)$/i)
    const matchIdMatch = content.match(/(?:Trận|Match)\s*#(\d+)/i)

    if (!formatMatch && !courtMatch && !dateTimeMatch && !priceMatch) return null

    return {
        format: formatMatch?.[1]?.toUpperCase() || null,
        courtName: courtMatch?.[1]?.trim() || null,
        facilityName: courtMatch?.[2]?.trim() || null,
        dateText: dateTimeMatch?.[1] || null,
        startTime: dateTimeMatch?.[2] || null,
        endTime: dateTimeMatch?.[3] || null,
        pricePerPlayer: priceMatch?.[1] || null,
        skillLevel: skillMatch?.[1]?.trim() || null,
        note: noteLine ? noteLine.replace(/^ghi chú:\s*/i, '') : null,
        matchId: matchIdMatch ? Number(matchIdMatch[1]) : null
    }
}

export default function PostCard({ post, isHidden = false, onDeleted, onHide }: PostCardProps) {
    const { user } = useAuth()
    const navigate = useNavigate()
    const { showAlert, showConfirm } = useDialog()
    // normalize post object: prefer `user_name`, fallback to `full_name`
    const normalizedPost = post ? { ...post, user_name: post.user_name || post.full_name } : null
    const data = normalizedPost || {
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
    const [, setTick] = useState(0)
    const [likeCount, setLikeCount] = useState(data.likes || 0)
    const [showShare, setShowShare] = useState(false)
    const [showComments, setShowComments] = useState(false)
    const [commentsList, setCommentsList] = useState<CommentType[]>([])
    const [commentText, setCommentText] = useState('')
    const [commentCount, setCommentCount] = useState(data.comments || 0)
    const [shareCount, setShareCount] = useState(data.shares || 0)

    useEffect(() => {
        // initialize counts if props changed
        setLikeCount(data.likes || 0)
        setCommentCount(data.comments || 0)
        setShareCount(data.shares || 0)
    }, [post?.id])

    // Auto-refresh time display every 30 seconds
    useEffect(() => {
        const timer = setInterval(() => setTick(t => t + 1), 30000)
        return () => clearInterval(timer)
    }, [])

    // Real-time socket updates for this post
    useEffect(() => {
        if (!data.id) return
        const socket = socketIO('http://localhost:5000', { transports: ['websocket'] })
        socket.emit('join_post', data.id)
        socket.on('post_liked', (ev: { postId: number; likes: number }) => {
            if (ev.postId === data.id) setLikeCount(ev.likes)
        })
        socket.on('post_commented', (ev: { postId: number; comments: number }) => {
            if (ev.postId === data.id) setCommentCount(ev.comments)
        })
        return () => {
            socket.emit('leave_post', data.id)
            socket.disconnect()
        }
    }, [data.id])

    useEffect(() => {
        if (showComments) {
            // load comments from server
            (async () => {
                try {
                    const res = await api.get(`/posts/${data.id}/comments`)
                    setCommentsList(res.data)
                } catch (err) {
                    console.error('Load comments error', err)
                }
            })()
        }
    }, [showComments, data.id])

    const getInitials = (name?: string | null) => name ? name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) : '?'
    const timeAgo = (date?: string | Date | null) => {
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

    const typeLabels: Record<string, { text: string; class: string }> = {
        find_player: { text: '🎯 Tìm người chơi', class: 'green' },
        share: { text: '📸 Chia sẻ', class: 'blue' },
        ad: { text: '📢 Quảng cáo', class: 'yellow' },
        event: { text: '🎉 Sự kiện', class: 'purple' }
    }
    const typeInfo = (typeLabels[(data.post_type as string) || 'share'] || typeLabels.share)
    const findPlayerMeta = data.post_type === 'find_player' ? parseFindPlayerPost(data.content) : null

    const handleLike = async () => {
        if (!user) return await showAlert('Thông báo', 'Vui lòng đăng nhập để tương tác')
        try {
            if (!liked) {
                const res = await api.post(`/posts/${data.id}/like`)
                setLikeCount(res.data.likes ?? (likeCount + 1))
                setLiked(true)
            } else {
                const res = await api.delete(`/posts/${data.id}/like`)
                setLikeCount(res.data.likes ?? Math.max(0, likeCount - 1))
                setLiked(false)
            }
        } catch (err: any) {
            console.error('Like error', err)
            await showAlert('Lỗi', err?.response?.data?.message || 'Lỗi khi tương tác')
        }
    }

    const shareUrl = encodeURIComponent(window.location.origin + `/post/${data.id}`)
    const shareText = encodeURIComponent(data.content?.substring(0, 100) || 'Xem bài đăng trên PickleBall Đà Nẵng')

    const handleShareFacebook = () => {
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${shareUrl}&quote=${shareText}`, '_blank', 'width=600,height=400')
        setShowShare(false)
        // record share (only if logged in)
        if (user) api.post(`/posts/${data.id}/share`).then(r => setShareCount(r.data.shares)).catch(() => { })
    }

    const handleShareMessenger = () => {
        window.open(`https://www.facebook.com/dialog/send?link=${shareUrl}&app_id=0&redirect_uri=${encodeURIComponent(window.location.href)}`, '_blank', 'width=600,height=400')
        setShowShare(false)
        if (user) api.post(`/posts/${data.id}/share`).then(r => setShareCount(r.data.shares)).catch(() => { })
    }

    const handleCopyLink = async () => {
        navigator.clipboard.writeText(window.location.origin + `/post/${data.id}`)
        setShowShare(false)
        await showAlert('Thành công', 'Đã sao chép link!')
        if (user) api.post(`/posts/${data.id}/share`).then(r => setShareCount(r.data.shares)).catch(() => { })
    }

    const handleAddComment = async (e: FormEvent) => {
        e.preventDefault()
        if (!user) return await showAlert('Thông báo', 'Vui lòng đăng nhập để bình luận')
        if (!commentText.trim()) return
        try {
            const res = await api.post(`/posts/${data.id}/comments`, { content: commentText })
            // server returns created comment
            setCommentsList(prev => [res.data.comment, ...prev])
            setCommentCount(res.data.comments || (commentCount + 1))
            setCommentText('')
        } catch (err) {
            const eErr: any = err
            console.error('Comment error', eErr)
            await showAlert('Lỗi', eErr?.response?.data?.message || 'Lỗi khi gửi bình luận')
        }
    }

    const canDelete = user && (user.id === data.user_id || user.role === 'admin')
    const [showMenu, setShowMenu] = useState(false)
    const [showReportModal, setShowReportModal] = useState(false)

    const toggleMenu = () => setShowMenu(prev => !prev)

    const handleActionHide = () => {
        onHide && onHide(data.id)
        setShowMenu(false)
    }

    const handleActionDelete = async () => {
        const isConfirm = await showConfirm('Xác nhận', 'Bạn có chắc muốn xóa bài viết này?')
        if (!isConfirm) return
        try {
            await api.delete(`/posts/${data.id}`)
            onDeleted && onDeleted(data.id)
        } catch (err: any) {
            console.error('Delete error', err)
            await showAlert('Lỗi', err.response?.data?.message || 'Lỗi khi xóa bài viết')
        }
        setShowMenu(false)
    }

    const handleOpenPhoto = () => {
        sessionStorage.setItem(HOME_SCROLL_KEY, String(window.scrollY || 0))
        navigate(`/post/${data.id}/photo`)
    }

    // show minimal card when hidden
    if (isHidden) {
        return (
            <div className={`${styles.postCard} ${data.is_promoted ? styles.promoted : ''}`}>
                {/* still render menu so user can unhide or delete */}
                <div style={{ position: 'absolute', top: 8, right: 8 }}>
                    <button className={styles.menuBtn} onClick={toggleMenu} title="Tùy chọn">
                        ⋮
                    </button>
                    {showMenu && (
                        <div className={styles.menuDropdown} onMouseLeave={() => setShowMenu(false)}>
                            <button className={styles.menuItem} onClick={handleActionHide}>Bỏ ẩn bài viết</button>
                            {canDelete && <button className={styles.menuItem} onClick={handleActionDelete}>Xóa bài viết</button>}
                        </div>
                    )}
                </div>
                <div className={styles.hiddenNotice}>Bài viết đã bị ẩn</div>
            </div>
        )
    }

    return (
        <div className={`${styles.postCard} ${data.is_promoted ? styles.promoted : ''}`}>
            {data.is_promoted && <div className={styles.promotedBadge}>⚡ Được tài trợ</div>}
            {/* overflow menu */}
            <div style={{ position: 'absolute', top: 8, right: 8 }}>
                <button className={styles.menuBtn} onClick={toggleMenu} title="Tùy chọn">
                    ⋯
                </button>
                {showMenu && (
                    <div className={styles.menuDropdown} onMouseLeave={() => setShowMenu(false)}>
                        {!isHidden && (
                            <button className={styles.menuItem} onClick={handleActionHide}>Ẩn bài viết</button>
                        )}
                        {isHidden && (
                            <button className={styles.menuItem} onClick={handleActionHide}>Bỏ ẩn bài viết</button>
                        )}
                        {canDelete && <button className={styles.menuItem} onClick={handleActionDelete}>Xóa bài viết</button>}
                        {user?.id !== data.user_id && (
                            <button 
                                className={styles.menuItem} 
                                style={{ color: 'var(--accent-red)' }}
                                onClick={() => { setShowReportModal(true); setShowMenu(false) }}
                            >
                                🚩 Báo cáo bài viết
                            </button>
                        )}
                    </div>
                )}
            </div>

            <div className={styles.postHeader}>
                {data.user_id ? (
                    <UserProfileCard userId={data.user_id}>
                        <div className="avatar" style={{ cursor: 'pointer', overflow: 'hidden' }}>
                            {data.avatar ? (
                                <img src={data.avatar} alt={data.user_name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                            ) : getInitials(data.user_name)}
                        </div>
                    </UserProfileCard>
                ) : (
                    <div className="avatar" style={{ overflow: 'hidden' }}>
                        {data.avatar ? (
                            <img src={data.avatar} alt={data.user_name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                        ) : getInitials(data.user_name)}
                    </div>
                )}
                <div className={styles.postMeta}>
                    <div className={styles.postAuthor}>
                        {data.user_name}
                        {data.user_role === 'owner' && <span className={`badge badge-yellow`}>Owner</span>}
                    </div>
                    <div className={styles.postTime}>{timeAgo(data.created_at)}</div>
                </div>
                <span className={`badge badge-${typeInfo.class}`}>{typeInfo.text}</span>
            </div>

            {findPlayerMeta ? (
                <div className={styles.findPlayerCard}>
                    {findPlayerMeta.format && (
                        <div className={styles.findPlayerTopRow}>
                            <span className={styles.findPlayerFormatBadge}>⚔️ {findPlayerMeta.format}</span>
                            {findPlayerMeta.skillLevel && (
                                <span className={styles.findPlayerSkill}>Trình độ: {findPlayerMeta.skillLevel}</span>
                            )}
                        </div>
                    )}

                    <div className={styles.findPlayerMainInfo}>
                        <div className={styles.findPlayerLine}>🏟️ {findPlayerMeta.courtName || 'Sân đang cập nhật'}</div>
                        {findPlayerMeta.facilityName && (
                            <div className={styles.findPlayerSubLine}>📍 {findPlayerMeta.facilityName}</div>
                        )}
                        {(findPlayerMeta.dateText || findPlayerMeta.startTime || findPlayerMeta.endTime) && (
                            <div className={styles.findPlayerLine}>
                                📅 {findPlayerMeta.dateText || '--/--/----'} | {findPlayerMeta.startTime || '--:--'} - {findPlayerMeta.endTime || '--:--'}
                            </div>
                        )}
                        {findPlayerMeta.pricePerPlayer && (
                            <div className={styles.findPlayerLine}>💰 {findPlayerMeta.pricePerPlayer}đ / người</div>
                        )}
                        {findPlayerMeta.note && (
                            <div className={styles.findPlayerNote}>📝 {findPlayerMeta.note}</div>
                        )}
                    </div>

                    {findPlayerMeta.matchId && (
                        <div className={styles.findPlayerFooter}>
                            <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={() => navigate(`/matches/${findPlayerMeta.matchId}`)}
                            >
                                Xem trận #{findPlayerMeta.matchId}
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                <div className={styles.postContent}>{data.content}</div>
            )}

            {data.image && (
                <>
                    <button
                        onClick={handleOpenPhoto}
                        style={{ display: 'block', width: '100%', padding: 0, border: 'none', background: 'none', cursor: 'zoom-in' }}
                        title="Click để xem ảnh phóng to"
                    >
                        <img src={data.image} alt="" className={styles.postImage} style={{ pointerEvents: 'none' }} />
                    </button>
                    <div className={styles.imageHint}>🔍 Click ảnh để xem toàn màn hình</div>
                </>
            )}

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
                            {commentsList.map((c: any) => {
                                const commenterName = c.user_name || c.full_name || 'Người dùng'
                                return (
                                    <div key={c.id} className={styles.commentItem}>
                                        {c.user_id ? (
                                            <UserProfileCard userId={c.user_id}>
                                                <div className={`avatar avatar-sm ${styles.commentAvatar}`} style={{ cursor: 'pointer', overflow: 'hidden' }}>
                                                    {c.avatar ? (
                                                        <img src={c.avatar} alt={commenterName} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                                                    ) : getInitials(commenterName)}
                                                </div>
                                            </UserProfileCard>
                                        ) : (
                                            <div className={`avatar avatar-sm ${styles.commentAvatar}`} style={{ overflow: 'hidden' }}>
                                                {c.avatar ? (
                                                    <img src={c.avatar} alt={commenterName} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                                                ) : getInitials(commenterName)}
                                            </div>
                                        )}
                                        <div className={styles.commentBubble}>
                                            <span className={styles.commentUser}>{commenterName}</span>
                                            <span className={styles.commentText}>{c.content}</span>
                                            <span className={styles.commentTime}>{timeAgo(c.created_at)}</span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {/* Comment input */}
                    <form className={styles.commentForm} onSubmit={handleAddComment}>
                        <div className={`avatar avatar-sm`} style={{ overflow: 'hidden' }}>
                            {user?.avatar ? (
                                <img src={user.avatar} alt={user.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                            ) : getInitials(user?.full_name)}
                        </div>
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

            <ReportModal
                isOpen={showReportModal}
                targetId={data.id}
                targetType="post"
                targetName={`Bài viết của ${data.user_name}`}
                onClose={() => setShowReportModal(false)}
            />
        </div>
    )
}
