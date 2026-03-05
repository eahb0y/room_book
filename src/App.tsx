import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import Layout from '@/components/Layout';
import Landing from '@/pages/Landing';
import ClientLanding from '@/pages/ClientLanding';
import Marketplace from '@/pages/Marketplace';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import BusinessLogin from '@/pages/BusinessLogin';
import BusinessRegister from '@/pages/BusinessRegister';
import Invite from '@/pages/Invite';
import AdminDashboard from '@/pages/admin/AdminDashboard';
import EmployeesManagement from '@/pages/admin/EmployeesManagement';
import PeopleManagement from '@/pages/admin/PeopleManagement';
import RoomManagement from '@/pages/admin/RoomManagement';
import ServicesManagement from '@/pages/admin/ServicesManagement';
import AdminBookings from '@/pages/admin/AdminBookings';
import VenueManagement from '@/pages/admin/VenueManagement';
import RoomList from '@/pages/user/RoomList';
import BookingPage from '@/pages/user/BookingPage';
import ServiceBookingPage from '@/pages/user/ServiceBookingPage';
import MyBookings from '@/pages/user/MyBookings';
import Profile from '@/pages/Profile';
import SeoRouteManager from '@/components/SeoRouteManager';
import { isBusinessPortalActive } from '@/lib/businessAccess';
import { getOAuthCallbackErrorMessage } from '@/lib/authApi';
import { getSupabaseEnvironment } from '@/lib/supabaseConfig';

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
  const isBusinessPortal = isBusinessPortalActive(user, portal);
  if (!isAuthenticated) return <Navigate to="/business/login" replace />;
  if (!isBusinessPortal) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, portal, user } = useAuthStore();
  if (!isAuthenticated) return <>{children}</>;

  const defaultPath = isBusinessPortalActive(user, portal) ? '/my-venue' : '/';
  return <Navigate to={defaultPath} replace />;
}

function OAuthCallbackBridge() {
  const location = useLocation();
  const navigate = useNavigate();
  const completeGoogleAuth = useAuthStore((state) => state.completeGoogleAuth);
  const isProdEnvironment = getSupabaseEnvironment() === 'prod';

  useEffect(() => {
    const preBootstrapWindow = window as Window & { __TEZBRON_OAUTH_HASH__?: string };
    const preBootstrapHash = preBootstrapWindow.__TEZBRON_OAUTH_HASH__ ?? '';
    const isAuthPage = location.pathname === '/login' || location.pathname === '/register';
    if (isAuthPage && !preBootstrapHash) return;

    const oauthHash = preBootstrapHash || location.hash || '';
    const hasOAuthPayload = oauthHash.includes('access_token') || oauthHash.includes('refresh_token');
    const oauthError = getOAuthCallbackErrorMessage(oauthHash) ?? getOAuthCallbackErrorMessage(location.search);

    if (!hasOAuthPayload && !oauthError) return;

    if (location.hash) {
      window.history.replaceState(null, '', `${location.pathname}${location.search}`);
    }

    if (!hasOAuthPayload && oauthError) {
      navigate(`/login?oauth_error=${encodeURIComponent(oauthError)}`, { replace: true });
      return;
    }

    let isActive = true;

    void (async () => {
      try {
        const success = await completeGoogleAuth(oauthHash);
        if (!success || !isActive) return;

        const params = new URLSearchParams(location.search);
        const isProdRegisterOAuth = isProdEnvironment && params.get('oauth_register') === '1';
        const inviteToken = params.get('invite');
        const nextPathParam = params.get('next');
        const nextPath =
          nextPathParam && nextPathParam.startsWith('/') && !nextPathParam.startsWith('//') ? nextPathParam : null;
        if (isProdRegisterOAuth) {
          window.history.replaceState(null, '', location.pathname);
          return;
        }
        const { portal, user } = useAuthStore.getState();
        const destination = inviteToken
          ? `/invite/${inviteToken}`
          : nextPath ?? (isBusinessPortalActive(user, portal) ? '/my-venue' : '/');

        navigate(destination, { replace: true });
      } catch (error) {
        if (!isActive) return;
        const message = error instanceof Error ? error.message : 'Произошла ошибка при входе';
        navigate(`/login?oauth_error=${encodeURIComponent(message)}`, { replace: true });
      } finally {
        if (preBootstrapHash) {
          delete preBootstrapWindow.__TEZBRON_OAUTH_HASH__;
        }
      }
    })();

    return () => {
      isActive = false;
    };
  }, [completeGoogleAuth, isProdEnvironment, location.hash, location.pathname, location.search, navigate]);

  return null;
}

function App() {
  return (
    <BrowserRouter>
      <SeoRouteManager />
      <OAuthCallbackBridge />
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
        <Route
          path="/about"
          element={<ClientLanding />}
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
          path="/my-venues"
          element={
            <AdminRoute>
              <Layout>
                <VenueManagement />
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
          path="/employees"
          element={
            <AdminRoute>
              <Layout>
                <EmployeesManagement />
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
            <Layout>
              <RoomList />
            </Layout>
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
          path="/service/:serviceId"
          element={
            <UserRoute>
              <Layout>
                <ServiceBookingPage />
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
