const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: ['http://localhost:5173', 'http://localhost:3000'], methods: ['GET', 'POST'] }
});

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/users', require('./routes/user.routes'));
app.use('/api/courts', require('./routes/court.routes'));
app.use('/api/posts', require('./routes/post.routes'));
app.use('/api/bookings', require('./routes/booking.routes'));
app.use('/api/matches', require('./routes/match.routes'));
app.use('/api/notifications', require('./routes/notification.routes'));
app.use('/api/payments', require('./routes/payment.routes'));
app.use('/api/chat', require('./routes/chat.routes'));
app.use('/api/admin', require('./routes/admin.routes'));
app.use('/api/stats', require('./routes/stats.routes'));

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Pickleball API is running 🏓' });
});

// Socket.IO
require('./socket/index')(io);

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`\n🏓 Pickleball API Server running on port ${PORT}`);
    console.log(`📡 Socket.IO ready`);
    console.log(`🔗 http://localhost:${PORT}/api/health\n`);
});
