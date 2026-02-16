import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import Layout from '@/components/Layout';
import Landing from '@/pages/Landing';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import Invite from '@/pages/Invite';
import AdminDashboard from '@/pages/admin/AdminDashboard';
import VenueManagement from '@/pages/admin/VenueManagement';
import PeopleManagement from '@/pages/admin/PeopleManagement';
import RoomManagement from '@/pages/admin/RoomManagement';
import AdminBookings from '@/pages/admin/AdminBookings';
import VenueList from '@/pages/user/VenueList';
import RoomList from '@/pages/user/RoomList';
import BookingPage from '@/pages/user/BookingPage';
import MyBookings from '@/pages/user/MyBookings';
import Profile from '@/pages/Profile';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return !isAuthenticated ? <>{children}</> : <Navigate to="/app" />;
}

function HomeRoute() {
  const { user, isAuthenticated } = useAuthStore();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  if (user?.role === 'admin') {
    return <AdminDashboard />;
  }

  return <VenueList />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Landing */}
        <Route path="/" element={<Landing />} />

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
        <Route path="/invite/:token" element={<Invite />} />

        {/* Protected routes */}
        <Route
          path="/app"
          element={
            <PrivateRoute>
              <Layout>
                <HomeRoute />
              </Layout>
            </PrivateRoute>
          }
        />

        {/* Admin routes */}
        <Route
          path="/my-venue"
          element={
            <PrivateRoute>
              <Layout>
                <VenueManagement />
              </Layout>
            </PrivateRoute>
          }
        />
        <Route
          path="/people"
          element={
            <PrivateRoute>
              <Layout>
                <PeopleManagement />
              </Layout>
            </PrivateRoute>
          }
        />
        <Route
          path="/rooms"
          element={
            <PrivateRoute>
              <Layout>
                <RoomManagement />
              </Layout>
            </PrivateRoute>
          }
        />
        <Route
          path="/bookings"
          element={
            <PrivateRoute>
              <Layout>
                <AdminBookings />
              </Layout>
            </PrivateRoute>
          }
        />

        {/* User routes */}
        <Route
          path="/venue/:venueId"
          element={
            <PrivateRoute>
              <Layout>
                <RoomList />
              </Layout>
            </PrivateRoute>
          }
        />
        <Route
          path="/room/:roomId"
          element={
            <PrivateRoute>
              <Layout>
                <BookingPage />
              </Layout>
            </PrivateRoute>
          }
        />
        <Route
          path="/my-bookings"
          element={
            <PrivateRoute>
              <Layout>
                <MyBookings />
              </Layout>
            </PrivateRoute>
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
