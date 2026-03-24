import { useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useVenueStore } from '@/store/venueStore';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LogOut, Home, DoorOpen, List, Users, UserRound, Sparkles, Building2 } from 'lucide-react';
import PreferenceControls from '@/components/PreferenceControls';
import { useI18n } from '@/i18n/useI18n';
import { canManageBusinessStaff, isBusinessPortalActive } from '@/lib/businessAccess';

interface LayoutProps {
  children: React.ReactNode;
}

interface BusinessNavItem {
  path: string;
  icon: typeof Home;
  label: string;
}

const HIDDEN_BUSINESS_NAV_PATHS = new Set(['/people', '/rooms', '/bookings']);

export default function Layout({ children }: LayoutProps) {
  const { user, isAuthenticated, logout, portal } = useAuthStore();
  const { t } = useI18n();
  const loadAdminData = useVenueStore((state) => state.loadAdminData);
  const loadUserData = useVenueStore((state) => state.loadUserData);
  const loadedFor = useVenueStore((state) => state.loadedFor);
  const navigate = useNavigate();
  const location = useLocation();
  const isUserJourneyPath =
    location.pathname === '/my-bookings'
    || location.pathname.startsWith('/venue/')
    || location.pathname.startsWith('/room/')
    || location.pathname.startsWith('/service/');
  const isBusinessPortal = isBusinessPortalActive(user, portal) && !isUserJourneyPath;
  const homePath = isBusinessPortal ? '/my-venue' : '/';
  const showSidebarNavigation = isAuthenticated && isBusinessPortal;

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    const key = isBusinessPortal ? `admin:${user.id}:${user.businessAccess?.isOwner ? 'owner' : user.businessAccess?.venueId ?? 'none'}` : `user:${user.id}`;
    if (loadedFor === key) return;
    if (isBusinessPortal) {
      loadAdminData(user);
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
    `group flex items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-sm tracking-wide transition-all duration-300 ${
      isActive(path)
        ? 'border-primary/30 bg-primary/[0.08] text-foreground shadow-[0_12px_28px_-22px_hsl(var(--primary)/0.42)]'
        : 'border-transparent text-muted-foreground hover:border-border/70 hover:bg-background/70 hover:text-foreground'
    }`;

  const businessNavItems = [
    { path: '/my-venue', icon: Home, label: t('Главная') },
    { path: '/my-venues', icon: Building2, label: t('Мои заведения') },
    { path: '/people', icon: Users, label: t('Резиденты') },
    canManageBusinessStaff(user)
      ? { path: '/employees', icon: Users, label: t('Сотрудники') }
      : null,
    { path: '/rooms', icon: DoorOpen, label: t('Комнаты') },
    { path: '/services', icon: Sparkles, label: t('Услуги') },
    { path: '/bookings', icon: List, label: t('Бронирования') },
    { path: '/profile', icon: UserRound, label: t('Профиль') },
  ].filter((item): item is BusinessNavItem => item !== null && !HIDDEN_BUSINESS_NAV_PATHS.has(item.path));

  return (
    <div className="min-h-screen bg-transparent">
      <div className="h-[3px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-70" />

      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/72 backdrop-blur-2xl supports-[backdrop-filter]:bg-background/68">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link to={homePath} className="flex items-center gap-3 group">
              <img
                src="/favicon.svg"
                alt=""
                aria-hidden="true"
                className="h-9 w-9 rounded-2xl border border-border/40 bg-card/70 p-1.5 transition-all duration-300 group-hover:shadow-glow"
              />
              <span className="brand-wordmark text-xl text-foreground">
                TezBron
              </span>
            </Link>

            {isAuthenticated && (
              <div className="flex items-center gap-3">
                <PreferenceControls className="shrink-0" />
                <div className="hidden items-center gap-2 rounded-2xl border border-border/50 bg-card/65 px-3 py-1.5 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.28)] backdrop-blur sm:flex">
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
                  className="rounded-2xl text-muted-foreground transition-all duration-300 hover:bg-card/70 hover:text-foreground"
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
      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
        {showSidebarNavigation ? (
          <div className="flex flex-col gap-6 lg:flex-row">
            <aside className="lg:w-64 lg:shrink-0">
              <div className="rounded-[2rem] border border-border/55 bg-card/74 p-3 shadow-[0_20px_44px_-32px_rgba(15,23,42,0.28)] backdrop-blur-xl lg:sticky lg:top-24">
                <nav className="space-y-1">
                  {businessNavItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link key={item.path} to={item.path} className={navLink(item.path)}>
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
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
