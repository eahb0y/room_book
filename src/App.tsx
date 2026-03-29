import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import Layout from '@/components/Layout';
import SeoRouteManager from '@/components/SeoRouteManager';
import ContactTelegramWidget from '@/components/ContactTelegramWidget';
import { isBusinessPortalActive } from '@/lib/businessAccess';
import { getOAuthCallbackErrorMessage } from '@/lib/authApi';
import { getSupabaseEnvironment } from '@/lib/supabaseConfig';

const Login = lazy(() => import('@/pages/Login'));
const Register = lazy(() => import('@/pages/Register'));
const BusinessLogin = lazy(() => import('@/pages/BusinessLogin'));
const BusinessRegister = lazy(() => import('@/pages/BusinessRegister'));
const Invite = lazy(() => import('@/pages/Invite'));
const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard'));
const EmployeesManagement = lazy(() => import('@/pages/admin/EmployeesManagement'));
const PeopleManagement = lazy(() => import('@/pages/admin/PeopleManagement'));
const AdminBookings = lazy(() => import('@/pages/admin/AdminBookings'));
const VenueManagement = lazy(() => import('@/pages/admin/VenueManagement'));
const FloorPlanManagement = lazy(() => import('@/pages/admin/FloorPlanManagement'));
const RoomList = lazy(() => import('@/pages/user/RoomList'));
const BookingPage = lazy(() => import('@/pages/user/BookingPage'));
const VenueTableBookingPage = lazy(() => import('@/pages/user/VenueTableBookingPage'));
const ServiceBookingPage = lazy(() => import('@/pages/user/ServiceBookingPage'));
const MyBookings = lazy(() => import('@/pages/user/MyBookings'));
const Profile = lazy(() => import('@/pages/Profile'));
const B2BHome = lazy(() => import('@/pages/B2BHome'));
const B2BPricing = lazy(() => import('@/pages/B2BPricing'));
const B2BAbout = lazy(() => import('@/pages/B2BAbout'));
const B2BBlog = lazy(() => import('@/pages/B2BBlog'));

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

  const defaultPath = isBusinessPortalActive(user, portal) ? '/my-venue' : '/profile';
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
          : nextPath ?? (isBusinessPortalActive(user, portal) ? '/my-venue' : '/profile');

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
      <Suspense fallback={<div className="min-h-screen bg-background" />}>
        <Routes>
          {/* Public B2B site */}
          <Route path="/" element={<B2BHome />} />
          <Route path="/features" element={<Navigate to="/" replace />} />
          <Route path="/pricing" element={<B2BPricing />} />
          <Route path="/about" element={<B2BAbout />} />
          <Route path="/blog" element={<B2BBlog />} />

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
            element={<Navigate to="/business/register" replace />}
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
                <Navigate to="/my-venue" replace />
              </AdminRoute>
            }
          />
          <Route
            path="/services"
            element={
              <AdminRoute>
                <Navigate to="/my-venue" replace />
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
          <Route
            path="/floor-plans"
            element={
              <AdminRoute>
                <Layout>
                  <FloorPlanManagement />
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
            path="/venue/:venueId/tables"
            element={
              <Layout>
                <VenueTableBookingPage />
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
      </Suspense>
      <ContactTelegramWidget />
    </BrowserRouter>
  );
}

export default App;
