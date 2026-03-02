import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Navbar from './components/Navbar'
import ProtectedRoute from './components/ProtectedRoute'

// Pages
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import Home from './pages/Home'
import Courts from './pages/Courts'
import CourtDetail from './pages/CourtDetail'
import Booking from './pages/Booking'
import Matchmaking from './pages/Matchmaking'
import MatchDetail from './pages/MatchDetail'
import Chat from './pages/Chat'
import Settings from './pages/Settings'
import UserDashboard from './pages/UserDashboard'
import OwnerDashboard from './pages/OwnerDashboard'
import OwnerCourts from './pages/OwnerCourts'
import AdminDashboard from './pages/AdminDashboard'
import OwnerCourtDetail from './pages/OwnerCourtDetail'


export default function App() {
    const { user } = useAuth()

    return (
        <>
            {user && <Navbar />}
            <Routes>
                {/* Public */}
                <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
                <Route path="/register" element={user ? <Navigate to="/" /> : <Register />} />
                <Route path="/forgot-password" element={user ? <Navigate to="/" /> : <ForgotPassword />} />

                {/* Protected - All authenticated users */}
                <Route path="/" element={
                    <ProtectedRoute><Home /></ProtectedRoute>
                } />
                <Route path="/courts" element={
                    <ProtectedRoute><Courts /></ProtectedRoute>
                } />
                <Route path="/courts/:id" element={
                    <ProtectedRoute><CourtDetail /></ProtectedRoute>
                } />
                <Route path="/booking/:id" element={
                    <ProtectedRoute><Booking /></ProtectedRoute>
                } />
                <Route path="/matchmaking" element={
                    <ProtectedRoute><Matchmaking /></ProtectedRoute>
                } />
                <Route path="/matches/:id" element={
                    <ProtectedRoute><MatchDetail /></ProtectedRoute>
                } />
                <Route path="/chat" element={
                    <ProtectedRoute><Chat /></ProtectedRoute>
                } />
                <Route path="/settings" element={
                    <ProtectedRoute><Settings /></ProtectedRoute>
                } />
                <Route path="/dashboard" element={
                    <ProtectedRoute roles={['user']}><UserDashboard /></ProtectedRoute>
                } />

                {/* Owner routes */}
                <Route path="/owner/dashboard" element={
                    <ProtectedRoute roles={['owner']}><OwnerDashboard /></ProtectedRoute>
                } />
                <Route path="/owner/courts" element={
                    <ProtectedRoute roles={['owner']}><OwnerCourts /></ProtectedRoute>
                } />
                <Route path="/owner/courtDetail/:id" element={
                    <ProtectedRoute roles={['owner']}><OwnerCourtDetail /></ProtectedRoute>
                } />

                {/* Admin routes */}
                <Route path="/admin" element={
                    <ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute>
                } />

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" />} />
            </Routes>
        </>
    )
}
