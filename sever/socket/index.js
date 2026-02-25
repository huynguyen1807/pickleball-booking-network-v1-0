module.exports = (io) => {
    io.on('connection', (socket) => {
        console.log('🔌 User connected:', socket.id);

        // Join a chat room
        socket.on('join_room', (roomId) => {
            socket.join(`room_${roomId}`);
            console.log(`Socket ${socket.id} joined room_${roomId}`);
        });

        // Leave a chat room
        socket.on('leave_room', (roomId) => {
            socket.leave(`room_${roomId}`);
        });

        // Send message
        socket.on('send_message', (data) => {
            // data = { roomId, userId, full_name, content }
            io.to(`room_${data.roomId}`).emit('new_message', {
                chat_room_id: data.roomId,
                user_id: data.userId,
                full_name: data.full_name,
                content: data.content,
                created_at: new Date().toISOString()
            });
        });

        // Typing indicator
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

        socket.on('disconnect', () => {
            console.log('❌ User disconnected:', socket.id);
        });
    });
};
