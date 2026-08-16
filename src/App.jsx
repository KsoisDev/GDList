import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './contexts/AuthContext'
import { SiteConfigProvider } from './contexts/SiteConfigContext'
import Navbar from './components/layout/Navbar'
import Footer from './components/layout/Footer'
import RequireMaintenanceAccess from './components/guards/RequireMaintenanceAccess'
import MaintenanceBanner from './components/guards/MaintenanceBanner'
import Home from './pages/Home'
import MainList from './pages/MainList'
import CommunityList from './pages/CommunityList'
import LevelDetail from './pages/LevelDetail'
import MainLeaderboard from './pages/MainLeaderboard'
import CommunityLeaderboard from './pages/CommunityLeaderboard'
import Profile from './pages/Profile'
import MyProfile from './pages/MyProfile'
import SubmitRecord from './pages/SubmitRecord'
import SubmitLevel from './pages/SubmitLevel'
import Login from './pages/Login'
import Register from './pages/Register'
import AdminDashboard from './pages/admin/AdminDashboard'
import ManageLevels from './pages/admin/ManageLevels'
import ReviewSubmissions from './pages/admin/ReviewSubmissions'
import ManageUsers from './pages/admin/ManageUsers'
import ManageReports from './pages/admin/ManageReports'
import ManageTags from './pages/admin/ManageTags'
import SiteSettings from './pages/admin/SiteSettings'
import MergeMainLevels from './pages/admin/MergeMainLevels'
import NotFound from './pages/NotFound'

const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <SiteConfigProvider>
            <Navbar />
            <MaintenanceBanner />
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/list/main" element={<RequireMaintenanceAccess><MainList /></RequireMaintenanceAccess>} />
              <Route path="/list/community" element={<RequireMaintenanceAccess><CommunityList /></RequireMaintenanceAccess>} />
              <Route path="/levels/:levelId" element={<RequireMaintenanceAccess><LevelDetail /></RequireMaintenanceAccess>} />
              <Route path="/leaderboard/main" element={<RequireMaintenanceAccess><MainLeaderboard /></RequireMaintenanceAccess>} />
              <Route path="/leaderboard/community" element={<RequireMaintenanceAccess><CommunityLeaderboard /></RequireMaintenanceAccess>} />
              <Route path="/profile" element={<MyProfile />} />
              <Route path="/profile/:userId" element={<Profile />} />
              <Route path="/submit" element={<RequireMaintenanceAccess><SubmitRecord /></RequireMaintenanceAccess>} />
              <Route path="/submit-level" element={<RequireMaintenanceAccess><SubmitLevel /></RequireMaintenanceAccess>} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/levels" element={<ManageLevels />} />
              <Route path="/admin/submissions" element={<ReviewSubmissions />} />
              <Route path="/admin/users" element={<ManageUsers />} />
              <Route path="/admin/reports" element={<ManageReports />} />
              <Route path="/admin/tags" element={<ManageTags />} />
              <Route path="/admin/settings" element={<SiteSettings />} />
              <Route path="/admin/merge" element={<MergeMainLevels />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            <Footer />
          </SiteConfigProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
