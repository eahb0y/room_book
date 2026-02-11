import { useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useVenueStore } from '@/store/venueStore';
import { Button } from '@/components/ui/button';
import { CalendarDays, Building2, LogOut, Home, DoorOpen, List } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, isAuthenticated, logout } = useAuthStore();
  const loadAdminData = useVenueStore((state) => state.loadAdminData);
  const loadUserData = useVenueStore((state) => state.loadUserData);
  const loadedFor = useVenueStore((state) => state.loadedFor);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    const key = `${user.role}:${user.id}`;
    if (loadedFor === key) return;
    if (user.role === 'admin') {
      loadAdminData(user.id);
    } else {
      loadUserData(user.id);
    }
  }, [isAuthenticated, user, loadedFor, loadAdminData, loadUserData]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  const navLink = (path: string) =>
    `group relative flex items-center gap-2.5 px-4 py-4 text-sm tracking-wide transition-all duration-300 whitespace-nowrap ${
      isActive(path)
        ? 'text-primary'
        : 'text-muted-foreground hover:text-foreground'
    }`;

  const activeBar = (path: string) =>
    `absolute bottom-0 left-1/2 -translate-x-1/2 h-[2px] rounded-full bg-primary transition-all duration-300 ${
      isActive(path)
        ? 'w-6 opacity-100'
        : 'w-0 opacity-0 group-hover:w-4 group-hover:opacity-40'
    }`;

  return (
    <div className="min-h-screen bg-background">
      {/* Top copper accent line */}
      <div className="h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-60" />

      {/* Header */}
      <header className="border-b border-border/40 bg-[hsl(240,5%,6.5%)]">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/app" className="flex items-center gap-3 group">
              <div className="w-9 h-9 rounded-lg bg-primary/90 flex items-center justify-center transition-all duration-300 group-hover:bg-primary group-hover:shadow-glow">
                <CalendarDays className="h-[18px] w-[18px] text-white" />
              </div>
              <span className="font-display text-xl tracking-tight text-foreground">
                Пространство
              </span>
            </Link>

            {isAuthenticated && (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/50 border border-border/30">
                  <div className="w-2 h-2 rounded-full bg-emerald-500/80" />
                  <span className="text-sm text-muted-foreground font-body">
                    {user?.email}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-all duration-300"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline ml-2">Выйти</span>
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Navigation */}
      {isAuthenticated && (
        <nav className="border-b border-border/20 bg-[hsl(240,5%,5.5%)]">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="flex gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              {user?.role === 'admin' ? (
                <>
                  <Link to="/app" className={navLink('/app')}>
                    <Home className="h-4 w-4" />
                    <span>Главная</span>
                    <span className={activeBar('/app')} />
                  </Link>
                  <Link to="/my-venue" className={navLink('/my-venue')}>
                    <Building2 className="h-4 w-4" />
                    <span>Моё заведение</span>
                    <span className={activeBar('/my-venue')} />
                  </Link>
                  <Link to="/rooms" className={navLink('/rooms')}>
                    <DoorOpen className="h-4 w-4" />
                    <span>Комнаты</span>
                    <span className={activeBar('/rooms')} />
                  </Link>
                  <Link to="/bookings" className={navLink('/bookings')}>
                    <List className="h-4 w-4" />
                    <span>Бронирования</span>
                    <span className={activeBar('/bookings')} />
                  </Link>
                </>
              ) : (
                <>
                  <Link to="/app" className={navLink('/app')}>
                    <Building2 className="h-4 w-4" />
                    <span>Заведения</span>
                    <span className={activeBar('/app')} />
                  </Link>
                  <Link to="/my-bookings" className={navLink('/my-bookings')}>
                    <CalendarDays className="h-4 w-4" />
                    <span>Мои бронирования</span>
                    <span className={activeBar('/my-bookings')} />
                  </Link>
                </>
              )}
            </div>
          </div>
        </nav>
      )}

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-6 lg:px-8 py-10">
        <div className="animate-fade-up">
          {children}
        </div>
      </main>
    </div>
  );
}
