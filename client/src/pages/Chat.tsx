import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'
import ChatBox from '../components/ChatBox'
import styles from '../styles/Chat.module.css'

export default function Chat() {
    const { user } = useAuth()
    const [rooms, setRooms] = useState([])
    const [selectedRoom, setSelectedRoom] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const loadRooms = async () => {
            try {
                const res = await api.get('/chat/rooms')
                setRooms(res.data)
            } catch (err) {
                console.error('Failed to load chat rooms:', err)
            } finally {
                setLoading(false)
            }
        }
        loadRooms()
    }, [])

    const formatTime = (dateStr) => {
        if (!dateStr) return ''
        const date = new Date(dateStr)
        const now = new Date()
        const diffMs = now.getTime() - date.getTime()
        const diffHours = diffMs / (1000 * 60 * 60)
        if (diffHours < 24) return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        if (diffHours < 48) return 'Hôm qua'
        return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
    }

    return (
        <div className={`${styles.chatPage} ${selectedRoom ? styles.chatOpen : ''}`}>
            {/* Sidebar */}
            <div className={styles.chatSidebar}>
                <div className={styles.chatSidebarHeader}>
                    <h2 className={styles.chatSidebarTitle}>💬 Tin nhắn</h2>
                </div>
                <div className={styles.chatRoomList}>
                    {loading ? (
                        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>⏳ Đang tải...</div>
                    ) : rooms.length > 0 ? rooms.map(room => (
                        <div
                            key={room.id}
                            className={`${styles.chatRoomItem} ${selectedRoom === room.id ? styles.activeRoom : ''}`}
                            onClick={() => setSelectedRoom(room.id)}
                        >
                            <div className={styles.chatRoomAvatar}>🏓</div>
                            <div className={styles.chatRoomMeta}>
                                <div className={styles.chatRoomName}>{room.name || `Phòng #${room.id}`}</div>
                                <div className={styles.chatRoomLastMsg}>{room.last_message || 'Chưa có tin nhắn'}</div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                                <div className={styles.chatRoomTime}>{formatTime(room.last_message_time)}</div>
                            </div>
                        </div>
                    )) : (
                        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            💬 Chưa có cuộc trò chuyện nào.<br />Tham gia một trận ghép để bắt đầu chat!
                        </div>
                    )}
                </div>
            </div>

            {/* Main Chat */}
            <div className={styles.chatMain}>
                {selectedRoom ? (
                    <ChatBox roomId={selectedRoom} roomName={rooms.find(r => r.id === selectedRoom)?.name} />
                ) : (
                    <div className={styles.chatEmpty}>
                        <div className={styles.chatEmptyIcon}>💬</div>
                        <p>Chọn một cuộc trò chuyện để bắt đầu</p>
                    </div>
                )}
            </div>
        </div>
    )
}
