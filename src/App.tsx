import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import Layout from '@/components/Layout';
import Landing from '@/pages/Landing';
import Marketplace from '@/pages/Marketplace';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import BusinessLogin from '@/pages/BusinessLogin';
import BusinessRegister from '@/pages/BusinessRegister';
import Invite from '@/pages/Invite';
import AdminDashboard from '@/pages/admin/AdminDashboard';
import PeopleManagement from '@/pages/admin/PeopleManagement';
import RoomManagement from '@/pages/admin/RoomManagement';
import ServicesManagement from '@/pages/admin/ServicesManagement';
import AdminBookings from '@/pages/admin/AdminBookings';
import RoomList from '@/pages/user/RoomList';
import BookingPage from '@/pages/user/BookingPage';
import MyBookings from '@/pages/user/MyBookings';
import Profile from '@/pages/Profile';
import SeoRouteManager from '@/components/SeoRouteManager';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function UserRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const location = useLocation();

  if (!isAuthenticated) {
    const nextPath = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?next=${encodeURIComponent(nextPath)}`} replace />;
  }

  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, portal, user } = useAuthStore();
  const isBusinessPortal = portal === 'business' || user?.role === 'admin';
  if (!isAuthenticated) return <Navigate to="/business/login" replace />;
  if (!isBusinessPortal) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, portal, user } = useAuthStore();
  if (!isAuthenticated) return <>{children}</>;

  const defaultPath = portal === 'business' || user?.role === 'admin' ? '/my-venue' : '/';
  return <Navigate to={defaultPath} replace />;
}

function App() {
  return (
    <BrowserRouter>
      <SeoRouteManager />
      <Routes>
        {/* Public marketplace */}
        <Route path="/" element={<Marketplace />} />

        {/* Public routes */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicRoute>
              <Register />
            </PublicRoute>
          }
        />
        <Route
          path="/business/login"
          element={<BusinessLogin />}
        />
        <Route
          path="/business/register"
          element={<BusinessRegister />}
        />
        <Route path="/invite/:token" element={<Invite />} />
        <Route
          path="/business/landing"
          element={<Landing />}
        />

        {/* Protected routes */}
        <Route path="/app" element={<Navigate to="/" replace />} />

        {/* Admin routes */}
        <Route
          path="/my-venue"
          element={
            <AdminRoute>
              <Layout>
                <AdminDashboard />
              </Layout>
            </AdminRoute>
          }
        />
        <Route
          path="/people"
          element={
            <AdminRoute>
              <Layout>
                <PeopleManagement />
              </Layout>
            </AdminRoute>
          }
        />
        <Route
          path="/rooms"
          element={
            <AdminRoute>
              <Layout>
                <RoomManagement />
              </Layout>
            </AdminRoute>
          }
        />
        <Route
          path="/services"
          element={
            <AdminRoute>
              <Layout>
                <ServicesManagement />
              </Layout>
            </AdminRoute>
          }
        />
        <Route
          path="/bookings"
          element={
            <AdminRoute>
              <Layout>
                <AdminBookings />
              </Layout>
            </AdminRoute>
          }
        />

        {/* User routes */}
        <Route
          path="/venue/:venueId"
          element={
            <UserRoute>
              <Layout>
                <RoomList />
              </Layout>
            </UserRoute>
          }
        />
        <Route
          path="/room/:roomId"
          element={
            <UserRoute>
              <Layout>
                <BookingPage />
              </Layout>
            </UserRoute>
          }
        />
        <Route
          path="/my-bookings"
          element={
            <UserRoute>
              <Layout>
                <MyBookings />
              </Layout>
            </UserRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <PrivateRoute>
              <Layout>
                <Profile />
              </Layout>
            </PrivateRoute>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
