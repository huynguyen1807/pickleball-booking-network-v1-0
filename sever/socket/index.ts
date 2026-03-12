import { Server } from 'socket.io';

let _io: Server;
// Track online users: userId -> Set of socketIds
const onlineUsers = new Map<number, Set<string>>();

export const getIO = () => _io;
export const getOnlineUsers = () => [...onlineUsers.keys()];

const initSocket = (io: Server) => {
    _io = io;
    io.on('connection', (socket) => {
        console.log('🔌 User connected:', socket.id);

        // User goes online
        socket.on('user_online', (userId: number) => {
            if (!userId) return;
            if (!onlineUsers.has(userId)) {
                onlineUsers.set(userId, new Set());
            }
            onlineUsers.get(userId)!.add(socket.id);
            (socket as any).userId = userId;
            // Broadcast online status
            io.emit('online_users', getOnlineUsers());
        });

        // Join chat room (works for both match rooms and DM rooms)
        socket.on('join_room', (roomId) => {
            socket.join(`room_${roomId}`);
        });

        socket.on('leave_room', (roomId) => {
            socket.leave(`room_${roomId}`);
        });

        // Chat message (works for both match rooms and DM rooms)
        socket.on('send_message', (data) => {
            io.to(`room_${data.roomId}`).emit('new_message', {
                chat_room_id: data.roomId,
                user_id: data.userId,
                full_name: data.full_name,
                avatar: data.avatar,
                content: data.content,
                created_at: new Date().toISOString()
            });

            // Notify the target user for DM (so their chat list updates)
            if (data.targetUserId) {
                io.to(`user_${data.targetUserId}`).emit('dm_notification', {
                    roomId: data.roomId,
                    senderId: data.userId,
                    senderName: data.full_name,
                    content: data.content
                });
            }
        });

        // Typing indicator
        socket.on('typing', (data) => {
            socket.to(`room_${data.roomId}`).emit('user_typing', {
                userId: data.userId,
                full_name: data.full_name
            });
        });

        socket.on('stop_typing', (data) => {
            socket.to(`room_${data.roomId}`).emit('user_stop_typing', {
                userId: data.userId
            });
        });

        // Notifications
        socket.on('join_notifications', (userId) => {
            socket.join(`user_${userId}`);
        });

        // Post rooms (for real-time like/comment on images)
        socket.on('join_post', (postId) => {
            socket.join(`post_${postId}`);
        });

        socket.on('leave_post', (postId) => {
            socket.leave(`post_${postId}`);
        });

        socket.on('disconnect', () => {
            console.log('❌ User disconnected:', socket.id);
            const userId = (socket as any).userId;
            if (userId && onlineUsers.has(userId)) {
                onlineUsers.get(userId)!.delete(socket.id);
                if (onlineUsers.get(userId)!.size === 0) {
                    onlineUsers.delete(userId);
                }
                io.emit('online_users', getOnlineUsers());
            }
        });
    });
};

export default initSocket;
