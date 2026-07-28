import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './contexts/AuthContext'
import Navbar from './components/layout/Navbar'
import Footer from './components/layout/Footer'
import Home from './pages/Home'
import MainList from './pages/MainList'
import CommunityList from './pages/CommunityList'
import MainLeaderboard from './pages/MainLeaderboard'
import CommunityLeaderboard from './pages/CommunityLeaderboard'
import Profile from './pages/Profile'
import MyProfile from './pages/MyProfile'
import SubmitRecord from './pages/SubmitRecord'
import Login from './pages/Login'
import Register from './pages/Register'
import AdminDashboard from './pages/admin/AdminDashboard'
import ManageLevels from './pages/admin/ManageLevels'
import ReviewSubmissions from './pages/admin/ReviewSubmissions'
import ManageUsers from './pages/admin/ManageUsers'
import NotFound from './pages/NotFound'

const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Navbar />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/list/main" element={<MainList />} />
            <Route path="/list/community" element={<CommunityList />} />
            <Route path="/leaderboard/main" element={<MainLeaderboard />} />
            <Route path="/leaderboard/community" element={<CommunityLeaderboard />} />
            <Route path="/profile" element={<MyProfile />} />
            <Route path="/profile/:userId" element={<Profile />} />
            <Route path="/submit" element={<SubmitRecord />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/levels" element={<ManageLevels />} />
            <Route path="/admin/submissions" element={<ReviewSubmissions />} />
            <Route path="/admin/users" element={<ManageUsers />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <Footer />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
