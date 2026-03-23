import axios from 'axios'

const api = axios.create({
    baseURL: '/api',
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
