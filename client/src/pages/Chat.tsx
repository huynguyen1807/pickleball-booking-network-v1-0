import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useSearchParams } from 'react-router-dom'
import api from '../api/axios'
import ChatBox from '../components/ChatBox'
import UserProfileCard from '../components/UserProfileCard'
import styles from '../styles/Chat.module.css'

export default function Chat() {
    const { user } = useAuth()
    const [searchParams, setSearchParams] = useSearchParams()
    const [rooms, setRooms] = useState<any[]>([])
    const [selectedRoom, setSelectedRoom] = useState<number | null>(null)
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<'all' | 'dm' | 'match'>('all')

    useEffect(() => {
        loadRooms()
    }, [])

    useEffect(() => {
        // Auto-select room from URL param
        const roomParam = searchParams.get('room')
        if (roomParam) {
            setSelectedRoom(parseInt(roomParam))
        }
    }, [searchParams])

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

    const handleSelectRoom = (roomId: number) => {
        setSelectedRoom(roomId)
        setSearchParams({ room: roomId.toString() })
    }

    const formatTime = (dateStr: string) => {
        if (!dateStr) return ''
        const date = new Date(dateStr)
        const now = new Date()
        const diffMs = now.getTime() - date.getTime()
        const diffHours = diffMs / (1000 * 60 * 60)
        if (diffHours < 24) return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        if (diffHours < 48) return 'Hôm qua'
        return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
    }

    const getInitials = (name: string) =>
        name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'

    const filteredRooms = rooms.filter(room => {
        if (filter === 'dm') return room.room_type === 'dm'
        if (filter === 'match') return room.room_type === 'match' || room.match_id
        return true
    })

    const getSelectedRoom = () => rooms.find(r => r.id === selectedRoom)

    const getRoomDisplayInfo = (room: any) => {
        if (room.room_type === 'dm' && room.other_user) {
            return {
                name: room.other_user.full_name,
                avatar: room.other_user.avatar,
                icon: null,
                userId: room.other_user.id
            }
        }
        return {
            name: room.name || `Phòng #${room.id}`,
            avatar: null,
            icon: '🏓',
            userId: null
        }
    }

    const selectedRoomData = getSelectedRoom()

    return (
        <div className={`${styles.chatPage} ${selectedRoom ? styles.chatOpen : ''}`}>
            {/* Sidebar */}
            <div className={styles.chatSidebar}>
                <div className={styles.chatSidebarHeader}>
                    <h2 className={styles.chatSidebarTitle}>💬 Tin nhắn</h2>
                    <div className={styles.chatFilters}>
                        {[
                            { key: 'all' as const, label: 'Tất cả' },
                            { key: 'dm' as const, label: 'Cá nhân' },
                            { key: 'match' as const, label: 'Ghép trận' }
                        ].map(f => (
                            <button key={f.key}
                                className={`${styles.filterBtn} ${filter === f.key ? styles.filterActive : ''}`}
                                onClick={() => setFilter(f.key)}>
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>
                <div className={styles.chatRoomList}>
                    {loading ? (
                        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>⏳ Đang tải...</div>
                    ) : filteredRooms.length > 0 ? filteredRooms.map(room => {
                        const info = getRoomDisplayInfo(room)
                        return (
                            <div
                                key={room.id}
                                className={`${styles.chatRoomItem} ${selectedRoom === room.id ? styles.activeRoom : ''}`}
                                onClick={() => handleSelectRoom(room.id)}
                            >
                                <div className={styles.chatRoomAvatar}>
                                    {info.avatar ? (
                                        <img src={info.avatar} alt={info.name}
                                            style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                                    ) : info.icon ? info.icon : (
                                        <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>{getInitials(info.name)}</span>
                                    )}
                                </div>
                                <div className={styles.chatRoomMeta}>
                                    <div className={styles.chatRoomName}>
                                        {info.name}
                                        {room.room_type === 'dm' && (
                                            <span className={styles.dmBadge}>DM</span>
                                        )}
                                    </div>
                                    <div className={styles.chatRoomLastMsg}>{room.last_message || 'Chưa có tin nhắn'}</div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                                    <div className={styles.chatRoomTime}>{formatTime(room.last_message_time)}</div>
                                    {room.unread_count > 0 && (
                                        <div className={styles.chatUnread}>{room.unread_count}</div>
                                    )}
                                </div>
                            </div>
                        )
                    }) : (
                        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            💬 Chưa có cuộc trò chuyện nào.
                            {filter === 'all' && <><br />Tham gia trận ghép hoặc nhắn tin cho người chơi khác!</>}
                        </div>
                    )}
                </div>
            </div>

            {/* Main Chat */}
            <div className={styles.chatMain}>
                {selectedRoom && selectedRoomData ? (
                    <ChatBox
                        roomId={selectedRoom}
                        roomName={getRoomDisplayInfo(selectedRoomData).name}
                        otherUser={selectedRoomData.room_type === 'dm' ? selectedRoomData.other_user : null}
                    />
                ) : selectedRoom ? (
                    <ChatBox roomId={selectedRoom} />
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
