import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'
import { X } from 'lucide-react'
import PostCard from '../components/PostCard'
import styles from '../styles/PostDetail.module.css'

export default function PostDetail() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { user } = useAuth()
    const [post, setPost] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!id) return

        const loadPost = async () => {
            try {
                const res = await api.get(`/posts/${id}`)
                setPost(res.data)
            } catch (err) {
                console.error('Load post error:', err)
            } finally {
                setLoading(false)
            }
        }

        loadPost()
    }, [id])

    if (loading) {
        return (
            <div className={styles.container}>
                <div className={styles.close} onClick={() => navigate('/')}>
                    <X size={24} />
                </div>
                <div className={styles.loading}>⏳ Đang tải...</div>
            </div>
        )
    }

    if (!post) {
        return (
            <div className={styles.container}>
                <div className={styles.close} onClick={() => navigate('/')}>
                    <X size={24} />
                </div>
                <div className={styles.notFound}>
                    <p>😕 Không tìm thấy bài viết</p>
                    <button className="btn btn-primary" onClick={() => navigate('/')}>
                        Quay lại trang chủ
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className={styles.container}>
            <div className={styles.close} onClick={() => navigate('/')}>
                <X size={24} />
            </div>

            <div className={styles.overlay} onClick={() => navigate('/')}></div>

            <div className={styles.modal}>
                <div className={styles.header}>
                    <h2>🎯 Chi tiết bài viết</h2>
                    <button
                        className={styles.closeBtn}
                        onClick={() => navigate('/')}
                        title="Đóng"
                    >
                        <X size={24} />
                    </button>
                </div>

                <div className={styles.content}>
                    <PostCard post={post} onDeleted={() => navigate('/')} />
                </div>
            </div>
        </div>
    )
}
