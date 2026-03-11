import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Navbar from './components/Navbar'
import ProtectedRoute from './components/ProtectedRoute'

// Pages
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import Home from './pages/Home'
import Facilities from './pages/Facilities'
import FacilityDetail from './pages/FacilityDetail'
import CourtDetail from './pages/CourtDetail'
import Booking from './pages/Booking'
import Matchmaking from './pages/Matchmaking'
import MatchDetail from './pages/MatchDetail'
import Chat from './pages/Chat'
import Settings from './pages/Settings'
import UserDashboard from './pages/UserDashboard'
import OwnerDashboard from './pages/OwnerDashboard'
import OwnerCourts from './pages/OwnerCourts'
import OwnerCreateFacility from './pages/OwnerCreateFacility'
import OwnerCreateCourt from './pages/OwnerCreateCourt'
import AdminDashboard from './pages/AdminDashboard'
import PostPhoto from './pages/PostPhoto'

export default function App() {
    const { user } = useAuth()
    const location = useLocation()

    // If navigated from PostCard (has background state), render the background page + modal overlay
    const background = (location.state as any)?.background

    return (
        <>
            {user && <Navbar />}
            <Routes location={background || location}>
                {/* Public */}
                <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
                <Route path="/register" element={user ? <Navigate to="/" /> : <Register />} />
                <Route path="/forgot-password" element={user ? <Navigate to="/" /> : <ForgotPassword />} />
                {/* Photo permalink — accessible without login (when opened directly, no background) */}
                <Route path="/post/:id/photo" element={<PostPhoto />} />

                {/* Protected - All authenticated users */}
                <Route path="/" element={
                    <ProtectedRoute><Home /></ProtectedRoute>
                } />
                <Route path="/facilities" element={
                    <ProtectedRoute><Facilities /></ProtectedRoute>
                } />
                <Route path="/facilities/:id" element={
                    <ProtectedRoute><FacilityDetail /></ProtectedRoute>
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
                <Route path="/owner/facilities/new" element={
                    <ProtectedRoute roles={['owner']}><OwnerCreateFacility /></ProtectedRoute>
                } />
                <Route path="/owner/facilities/:facilityId/courts/new" element={
                    <ProtectedRoute roles={['owner']}><OwnerCreateCourt /></ProtectedRoute>
                } />

                {/* Admin routes */}
                <Route path="/admin" element={
                    <ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute>
                } />

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" />} />
            </Routes>

            {/* Modal overlay: only rendered when navigated FROM the feed (has background state) */}
            {background && (
                <Routes>
                    <Route path="/post/:id/photo" element={<PostPhoto />} />
                </Routes>
            )}
        </>
    )
}
