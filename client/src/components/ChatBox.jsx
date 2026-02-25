import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'
import { io } from 'socket.io-client'
import styles from '../styles/Chat.module.css'

const socket = io('http://localhost:5000')

export default function ChatBox({ roomId, roomName }) {
    const { user } = useAuth()
    const [messages, setMessages] = useState([])
    const [newMsg, setNewMsg] = useState('')
    const [loading, setLoading] = useState(true)
    const messagesEndRef = useRef(null)

    useEffect(() => {
        if (!roomId) return

        const loadMessages = async () => {
            try {
                const res = await api.get(`/chat/rooms/${roomId}/messages`)
                setMessages(res.data)
            } catch (err) {
                console.error('Failed to load messages:', err)
            } finally {
                setLoading(false)
            }
        }

        loadMessages()
        socket.emit('join_room', roomId)

        const handleNewMessage = (data) => {
            if (data.chat_room_id === roomId) {
                setMessages(prev => {
                    // Avoid duplicates
                    if (prev.some(m => m.content === data.content && m.user_id === data.user_id && Math.abs(new Date(m.created_at) - new Date(data.created_at)) < 2000)) {
                        return prev
                    }
                    return [...prev, data]
                })
            }
        }

        socket.on('new_message', handleNewMessage)

        return () => {
            socket.emit('leave_room', roomId)
            socket.off('new_message', handleNewMessage)
        }
    }, [roomId])

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    const handleSend = async (e) => {
        e.preventDefault()
        if (!newMsg.trim()) return

        try {
            await api.post(`/chat/rooms/${roomId}/messages`, { content: newMsg })
            socket.emit('send_message', {
                roomId,
                userId: user.id,
                full_name: user.full_name,
                content: newMsg
            })
            setNewMsg('')
        } catch (err) {
            alert(err.response?.data?.message || 'Lỗi gửi tin nhắn')
        }
    }

    const getInitials = (name) => name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '?'
    const formatTime = (dateStr) => {
        if (!dateStr) return ''
        return new Date(dateStr).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    }

    return (
        <div className={styles.chatBox}>
            <div className={styles.chatHeader}>
                <div className={styles.chatRoomInfo}>
                    <div className="avatar avatar-sm">💬</div>
                    <div>
                        <div className={styles.chatRoomName}>{roomName || 'Phòng chat'}</div>
                        <div className={styles.chatOnline}>Đang online</div>
                    </div>
                </div>
            </div>

            <div className={styles.chatMessages}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>⏳ Đang tải tin nhắn...</div>
                ) : messages.length > 0 ? messages.map((msg, idx) => (
                    <div key={msg.id || idx} className={`${styles.message} ${msg.user_id === user?.id ? styles.myMessage : ''}`}>
                        {msg.user_id !== user?.id && <div className="avatar avatar-sm">{getInitials(msg.full_name)}</div>}
                        <div className={styles.messageBubble}>
                            {msg.user_id !== user?.id && <div className={styles.messageAuthor}>{msg.full_name}</div>}
                            <div className={styles.messageText}>{msg.content}</div>
                            <div className={styles.messageTime}>{formatTime(msg.created_at)}</div>
                        </div>
                    </div>
                )) : (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                        💬 Chưa có tin nhắn. Hãy bắt đầu cuộc trò chuyện!
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <form className={styles.chatInput} onSubmit={handleSend}>
                <input
                    type="text"
                    value={newMsg}
                    onChange={(e) => setNewMsg(e.target.value)}
                    placeholder="Nhập tin nhắn..."
                    className="input-field"
                />
                <button type="submit" className="btn btn-primary">Gửi</button>
            </form>
        </div>
    )
}
