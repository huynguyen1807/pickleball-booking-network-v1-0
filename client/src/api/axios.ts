import axios from 'axios'

const productionApiUrl = 'https://pickleball-booking-network-v1-0.onrender.com/api'
const rawApiUrl = import.meta.env.VITE_API_URL
const normalizedApiUrl = rawApiUrl
    ? (rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl}/api`)
    : undefined
const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')

const api = axios.create({
    baseURL: normalizedApiUrl || (isLocalhost ? '/api' : productionApiUrl),
    headers: {
        'Content-Type': 'application/json'
    }
})

// Attach JWT token to every request
api.interceptors.request.use(config => {
    const token = localStorage.getItem('token')
    if (token) {
        config.headers.Authorization = `Bearer ${token}`
    }
    
    // Don't set Content-Type for FormData - let browser set it with boundary
    if (config.data instanceof FormData) {
        delete config.headers['Content-Type']
    }
    
    return config
})

// Handle 401 responses (skip redirect for login requests)
api.interceptors.response.use(
    response => response,
    error => {
        if (error.response?.status === 401) {
            const isLoginRequest = error.config?.url?.includes('/auth/login')
            if (!isLoginRequest && localStorage.getItem('token')) {
                localStorage.removeItem('token')
                localStorage.removeItem('user')
                window.location.href = '/login'
            }
        }
        return Promise.reject(error)
    }
)

export default api
