import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useDialog } from '../context/DialogContext'
import api from '../api/axios'
import { io } from 'socket.io-client'
import UserProfileCard from './UserProfileCard'
import styles from '../styles/Chat.module.css'

const socket = io('http://localhost:5000')

interface ChatBoxProps {
    roomId: number
    roomName?: string
    otherUser?: { id: number; full_name: string; avatar?: string; role?: string } | null
}

export default function ChatBox({ roomId, roomName, otherUser }: ChatBoxProps) {
    const { user } = useAuth()
    const { showAlert } = useDialog()
    const [messages, setMessages] = useState<any[]>([])
    const [newMsg, setNewMsg] = useState('')
    const [loading, setLoading] = useState(true)
    const [typing, setTyping] = useState<string | null>(null)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const typingTimeoutRef = useRef<any>(null)

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

        const handleNewMessage = (data: any) => {
            if (data.chat_room_id === roomId) {
                setMessages(prev => {
                    if (prev.some(m => m.content === data.content && m.user_id === data.user_id && Math.abs(new Date(m.created_at).getTime() - new Date(data.created_at).getTime()) < 2000)) {
                        return prev
                    }
                    return [...prev, data]
                })
                setTyping(null)
            }
        }

        const handleTyping = (data: any) => {
            if (data.userId !== user?.id) {
                setTyping(data.full_name)
            }
        }

        const handleStopTyping = (data: any) => {
            if (data.userId !== user?.id) setTyping(null)
        }

        socket.on('new_message', handleNewMessage)
        socket.on('user_typing', handleTyping)
        socket.on('user_stop_typing', handleStopTyping)

        return () => {
            socket.emit('leave_room', roomId)
            socket.off('new_message', handleNewMessage)
            socket.off('user_typing', handleTyping)
            socket.off('user_stop_typing', handleStopTyping)
        }
    }, [roomId])

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setNewMsg(e.target.value)
        socket.emit('typing', { roomId, userId: user?.id, full_name: user?.full_name })
        clearTimeout(typingTimeoutRef.current)
        typingTimeoutRef.current = setTimeout(() => {
            socket.emit('stop_typing', { roomId, userId: user?.id })
        }, 1500)
    }

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newMsg.trim()) return

        try {
            await api.post(`/chat/rooms/${roomId}/messages`, { content: newMsg })
            socket.emit('send_message', {
                roomId,
                userId: user?.id,
                full_name: user?.full_name,
                avatar: user?.avatar,
                content: newMsg,
                targetUserId: otherUser?.id
            })
            setNewMsg('')
            socket.emit('stop_typing', { roomId, userId: user?.id })
        } catch (err: any) {
            await showAlert(err.response?.data?.message || 'Lỗi gửi tin nhắn')
        }
    }

    const getInitials = (name: string) => name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '?'
    const formatTime = (dateStr: string) => {
        if (!dateStr) return ''
        return new Date(dateStr).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    }

    const displayName = otherUser?.full_name || roomName || 'Phòng chat'

    return (
        <div className={styles.chatBox}>
            <div className={styles.chatHeader}>
                <div className={styles.chatRoomInfo}>
                    {otherUser ? (
                        <UserProfileCard userId={otherUser.id}>
                            <div className="avatar avatar-sm" style={{ cursor: 'pointer' }}>
                                {otherUser.avatar ? (
                                    <img src={otherUser.avatar} alt={otherUser.full_name}
                                        style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                                ) : getInitials(otherUser.full_name)}
                            </div>
                        </UserProfileCard>
                    ) : (
                        <div className="avatar avatar-sm">💬</div>
                    )}
                    <div>
                        <div className={styles.chatRoomName}>{displayName}</div>
                        <div className={styles.chatOnline}>
                            {typing ? `${typing} đang nhập...` : 'Đang online'}
                        </div>
                    </div>
                </div>
            </div>

            <div className={styles.chatMessages}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>⏳ Đang tải tin nhắn...</div>
                ) : messages.length > 0 ? messages.map((msg, idx) => (
                    <div key={msg.id || idx} className={`${styles.message} ${msg.user_id === user?.id ? styles.myMessage : ''}`}>
                        {msg.user_id !== user?.id && (
                            <UserProfileCard userId={msg.user_id}>
                                <div className="avatar avatar-sm" style={{ cursor: 'pointer' }}>
                                    {msg.avatar ? (
                                        <img src={msg.avatar} alt={msg.full_name}
                                            style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                                    ) : getInitials(msg.full_name)}
                                </div>
                            </UserProfileCard>
                        )}
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
                {typing && (
                    <div className={styles.message}>
                        <div className="avatar avatar-sm">✍️</div>
                        <div className={styles.messageBubble} style={{ fontStyle: 'italic', opacity: 0.7 }}>
                            <div className={styles.messageText}>{typing} đang nhập...</div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <form className={styles.chatInput} onSubmit={handleSend}>
                <input
                    type="text"
                    value={newMsg}
                    onChange={handleInputChange}
                    placeholder="Nhập tin nhắn..."
                    className="input-field"
                />
                <button type="submit" className="btn btn-primary">Gửi</button>
            </form>
        </div>
    )
}
