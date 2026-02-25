import express, { Request, Response } from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import courtRoutes from './routes/court.routes';
import postRoutes from './routes/post.routes';
import bookingRoutes from './routes/booking.routes';
import matchRoutes from './routes/match.routes';
import notificationRoutes from './routes/notification.routes';
import paymentRoutes from './routes/payment.routes';
import chatRoutes from './routes/chat.routes';
import adminRoutes from './routes/admin.routes';
import statsRoutes from './routes/stats.routes';
import initSocket from './socket/index';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: ['http://localhost:5173', 'http://localhost:3000'], methods: ['GET', 'POST'] }
});

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/courts', courtRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/stats', statsRoutes);

// Health check
app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'OK', message: 'Pickleball API is running 🏓' });
});

// Socket.IO
initSocket(io);

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`\n🏓 Pickleball API Server running on port ${PORT}`);
    console.log(`📡 Socket.IO ready`);
    console.log(`🔗 http://localhost:${PORT}/api/health\n`);
});
