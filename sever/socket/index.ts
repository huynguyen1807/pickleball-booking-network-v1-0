import { Server } from 'socket.io';

let _io: Server;

export const getIO = () => _io;

const initSocket = (io: Server) => {
    _io = io;
    io.on('connection', (socket) => {
        console.log('🔌 User connected:', socket.id);

        // Join chat room
        socket.on('join_room', (roomId) => {
            socket.join(`room_${roomId}`);
        });

        socket.on('leave_room', (roomId) => {
            socket.leave(`room_${roomId}`);
        });

        // Chat message
        socket.on('send_message', (data) => {
            io.to(`room_${data.roomId}`).emit('new_message', {
                chat_room_id: data.roomId,
                user_id: data.userId,
                full_name: data.full_name,
                content: data.content,
                created_at: new Date().toISOString()
            });
        });

        // Typing
        socket.on('typing', (data) => {
            socket.to(`room_${data.roomId}`).emit('user_typing', {
                userId: data.userId,
                full_name: data.full_name
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
        });
    });
};

export default initSocket;
