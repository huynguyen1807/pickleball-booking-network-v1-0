import { io, Socket } from 'socket.io-client'

const productionSocketUrl = 'https://pickleball-booking-network-v1-0.onrender.com'

const isLocalhost =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')

/**
 * Resolve the socket URL based on environment:
 * 1. VITE_SOCKET_URL env var (highest priority)
 * 2. VITE_API_URL env var
 * 3. localhost:5000 (if running locally)
 * 4. Production Render URL (fallback)
 */
export const socketUrl: string =
    import.meta.env.VITE_SOCKET_URL ||
    import.meta.env.VITE_API_URL ||
    (isLocalhost ? 'http://localhost:5000' : productionSocketUrl)

/**
 * Shared socket instance used across all components.
 * All components should import this instead of creating their own io() connection.
 */
export const socket: Socket = io(socketUrl, {
    transports: ['websocket'],
    withCredentials: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 10,
})

/**
 * Create a NEW socket connection (for components that need their own lifecycle).
 * Use this when a component needs to connect/disconnect independently.
 */
export const createSocket = (): Socket => {
    return io(socketUrl, {
        transports: ['websocket'],
        withCredentials: true,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 10,
    })
}

export default socket
