import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Route, Routes, useSearchParams, useNavigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './contexts/AuthContext'
import { SiteConfigProvider } from './contexts/SiteConfigContext'
import AppErrorBoundary from './components/layout/AppErrorBoundary'
import Footer from './components/layout/Footer'
import Navbar from './components/layout/Navbar'
import RouteLoader from './components/layout/RouteLoader'
import ScrollToTop from './components/layout/ScrollToTop'
import MaintenanceBanner from './components/guards/MaintenanceBanner'
import RequireAuth from './components/guards/RequireAuth'
import RequireMaintenanceAccess from './components/guards/RequireMaintenanceAccess'
import RequireRole from './components/guards/RequireRole'
import RequireVerifiedEmail from './components/guards/RequireVerifiedEmail'

const Home = lazy(() => import('./pages/Home'))
const MainList = lazy(() => import('./pages/MainList'))
const CommunityList = lazy(() => import('./pages/CommunityList'))
const LevelDetail = lazy(() => import('./pages/LevelDetail'))
const MainLeaderboard = lazy(() => import('./pages/MainLeaderboard'))
const CommunityLeaderboard = lazy(() => import('./pages/CommunityLeaderboard'))
const Profile = lazy(() => import('./pages/Profile'))
const MyProfile = lazy(() => import('./pages/MyProfile'))
const SubmitRecord = lazy(() => import('./pages/SubmitRecord'))
const SubmitLevel = lazy(() => import('./pages/SubmitLevel'))
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'))
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'))
const ManageLevels = lazy(() => import('./pages/admin/ManageLevels'))
const ReviewSubmissions = lazy(() => import('./pages/admin/ReviewSubmissions'))
const ApprovalHistory = lazy(() => import('./pages/admin/ApprovalHistory'))
const ManageUsers = lazy(() => import('./pages/admin/ManageUsers'))
const ManageReports = lazy(() => import('./pages/admin/ManageReports'))
const ManageTags = lazy(() => import('./pages/admin/ManageTags'))
const SiteSettings = lazy(() => import('./pages/admin/SiteSettings'))
const MergeMainLevels = lazy(() => import('./pages/admin/MergeMainLevels'))
const NotFound = lazy(() => import('./pages/NotFound'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
})

const routerBase = import.meta.env.BASE_URL === '/'
  ? undefined
  : import.meta.env.BASE_URL.replace(/\/$/, '')

function AdminRoute({ children, minRole = 'admin' }) {
  return <RequireRole minRole={minRole}>{children}</RequireRole>
}

function DiscordTokenRedirect() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  useEffect(() => {
    const token = searchParams.get('discord_token')
    if (token) {
      navigate('/profile' + window.location.search, { replace: true })
    }
  }, [searchParams, navigate])
  return null
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={routerBase}>
        <AuthProvider>
          <SiteConfigProvider>
            <DiscordTokenRedirect />
            <ScrollToTop />
            <Navbar />
            <MaintenanceBanner />
            <AppErrorBoundary>
              <Suspense fallback={<RouteLoader />}>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/list/main" element={<RequireMaintenanceAccess><MainList /></RequireMaintenanceAccess>} />
                  <Route path="/list/community" element={<RequireMaintenanceAccess><CommunityList /></RequireMaintenanceAccess>} />
                  <Route path="/levels/:levelId" element={<RequireMaintenanceAccess><LevelDetail /></RequireMaintenanceAccess>} />
                  <Route path="/leaderboard/main" element={<RequireMaintenanceAccess><MainLeaderboard /></RequireMaintenanceAccess>} />
                  <Route path="/leaderboard/community" element={<RequireMaintenanceAccess><CommunityLeaderboard /></RequireMaintenanceAccess>} />
                  <Route path="/profile" element={<RequireAuth><MyProfile /></RequireAuth>} />
                  <Route path="/profile/:userId" element={<Profile />} />
                  <Route path="/submit" element={<RequireMaintenanceAccess><RequireVerifiedEmail><SubmitRecord /></RequireVerifiedEmail></RequireMaintenanceAccess>} />
                  <Route path="/submit-level" element={<RequireMaintenanceAccess><RequireVerifiedEmail><SubmitLevel /></RequireVerifiedEmail></RequireMaintenanceAccess>} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/verify-email" element={<VerifyEmail />} />
                  <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
                  <Route path="/admin/levels" element={<AdminRoute><ManageLevels /></AdminRoute>} />
                  <Route path="/admin/submissions" element={<AdminRoute><ReviewSubmissions /></AdminRoute>} />
                  <Route path="/admin/approval-history" element={<AdminRoute><ApprovalHistory /></AdminRoute>} />
                  <Route path="/admin/users" element={<AdminRoute><ManageUsers /></AdminRoute>} />
                  <Route path="/admin/reports" element={<AdminRoute minRole="owner"><ManageReports /></AdminRoute>} />
                  <Route path="/admin/tags" element={<AdminRoute><ManageTags /></AdminRoute>} />
                  <Route path="/admin/settings" element={<AdminRoute><SiteSettings /></AdminRoute>} />
                  <Route path="/admin/merge" element={<AdminRoute><MergeMainLevels /></AdminRoute>} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </AppErrorBoundary>
            <Footer />
          </SiteConfigProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
