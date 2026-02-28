import { useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useVenueStore } from '@/store/venueStore';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LogOut, Home, DoorOpen, List, Users, UserRound, Sparkles } from 'lucide-react';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useI18n } from '@/i18n/useI18n';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, isAuthenticated, logout, portal } = useAuthStore();
  const { t } = useI18n();
  const loadAdminData = useVenueStore((state) => state.loadAdminData);
  const loadUserData = useVenueStore((state) => state.loadUserData);
  const loadedFor = useVenueStore((state) => state.loadedFor);
  const navigate = useNavigate();
  const location = useLocation();
  const isUserJourneyPath = location.pathname === '/my-bookings' || location.pathname.startsWith('/venue/') || location.pathname.startsWith('/room/');
  const isBusinessPortal = (portal === 'business' || user?.role === 'admin') && !isUserJourneyPath;
  const homePath = isBusinessPortal ? '/my-venue' : '/';
  const showSidebarNavigation = isAuthenticated && isBusinessPortal;

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    const key = `${isBusinessPortal ? 'admin' : 'user'}:${user.id}`;
    if (loadedFor === key) return;
    if (isBusinessPortal) {
      loadAdminData(user.id);
    } else {
      loadUserData(user.id);
    }
  }, [isAuthenticated, isBusinessPortal, user, loadedFor, loadAdminData, loadUserData]);

  const handleLogout = async () => {
    const logoutRedirect = isBusinessPortal ? '/business/login' : '/login';
    await logout();
    navigate(logoutRedirect);
  };

  const isActive = (path: string) => location.pathname === path;

  const fullName = [user?.firstName, user?.lastName]
    .filter((value): value is string => Boolean(value && value.trim()))
    .join(' ')
    .trim();

  const initials = fullName
    ? fullName
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join('')
    : user?.email?.charAt(0).toUpperCase() ?? 'U';

  const navLink = (path: string) =>
    `group flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm tracking-wide transition-all duration-300 ${
      isActive(path)
        ? 'border-primary/40 bg-primary/10 text-primary'
        : 'border-transparent text-muted-foreground hover:border-border/60 hover:bg-secondary/40 hover:text-foreground'
    }`;

  return (
    <div className="min-h-screen bg-background">
      {/* Top copper accent line */}
      <div className="h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-60" />

      {/* Header */}
      <header className="border-b border-border/40 bg-[hsl(240,5%,6.5%)]">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to={homePath} className="flex items-center gap-3 group">
              <img
                src="/favicon.svg"
                alt=""
                aria-hidden="true"
                className="h-9 w-9 rounded-lg transition-all duration-300 group-hover:shadow-glow"
              />
              <span className="font-display text-xl tracking-tight text-foreground">
                {t('Пространство')}
              </span>
            </Link>

            {isAuthenticated && (
              <div className="flex items-center gap-3">
                <LanguageSwitcher className="shrink-0" />
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/50 border border-border/30">
                  <Avatar className="h-7 w-7 border border-border/50">
                    {user?.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={fullName || user.email} /> : null}
                    <AvatarFallback className="text-[11px]">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="leading-tight">
                    {fullName && <p className="text-xs text-foreground">{fullName}</p>}
                    <p className="text-xs text-muted-foreground font-body">{user?.email}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-all duration-300"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline ml-2">{t('Выйти')}</span>
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        {showSidebarNavigation ? (
          <div className="flex flex-col gap-6 lg:flex-row">
            <aside className="lg:w-64 lg:shrink-0">
              <div className="rounded-2xl border border-border/40 bg-[hsl(240,5%,5.8%)] p-3 lg:sticky lg:top-24">
                <nav className="space-y-1">
                  <Link to="/my-venue" className={navLink('/my-venue')}>
                    <Home className="h-4 w-4" />
                    <span>{t('Главная')}</span>
                  </Link>
                  <Link to="/people" className={navLink('/people')}>
                    <Users className="h-4 w-4" />
                    <span>{t('Резиденты')}</span>
                  </Link>
                  <Link to="/rooms" className={navLink('/rooms')}>
                    <DoorOpen className="h-4 w-4" />
                    <span>{t('Комнаты')}</span>
                  </Link>
                  <Link to="/services" className={navLink('/services')}>
                    <Sparkles className="h-4 w-4" />
                    <span>{t('Услуги')}</span>
                  </Link>
                  <Link to="/bookings" className={navLink('/bookings')}>
                    <List className="h-4 w-4" />
                    <span>{t('Бронирования')}</span>
                  </Link>
                  <Link to="/profile" className={navLink('/profile')}>
                    <UserRound className="h-4 w-4" />
                    <span>{t('Профиль')}</span>
                  </Link>
                </nav>
              </div>
            </aside>

            <main className="min-w-0 flex-1">
              <div className="animate-fade-up">
                {children}
              </div>
            </main>
          </div>
        ) : (
          <main>
            <div className="animate-fade-up">
              {children}
            </div>
          </main>
        )}
      </div>
    </div>
  );
}
