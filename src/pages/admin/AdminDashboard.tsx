import { useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, DoorOpen, CalendarDays, ArrowRight, Users } from 'lucide-react';
import { useVenueStore } from '@/store/venueStore';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n/useI18n';
import { getBookingViewStatus } from '@/lib/bookingStatus';

export default function AdminDashboard() {
  const { t } = useI18n();
  const { user, portal } = useAuthStore();
  const navigate = useNavigate();
  const isBusinessPortal = portal === 'business';
  const venues = useVenueStore((state) => state.venues);
  const allRooms = useVenueStore((state) => state.rooms);
  const allBookings = useVenueStore((state) => state.bookings);

  const ownedVenues = useMemo(() => venues.filter((v) => v.adminId === user?.id), [venues, user?.id]);
  const ownedVenueIds = useMemo(() => new Set(ownedVenues.map((venue) => venue.id)), [ownedVenues]);
  const rooms = useMemo(() => allRooms.filter((room) => ownedVenueIds.has(room.venueId)), [allRooms, ownedVenueIds]);
  const venueRoomIds = useMemo(() => new Set(rooms.map((room) => room.id)), [rooms]);
  const bookings = useMemo(() => allBookings.filter((booking) => venueRoomIds.has(booking.roomId)), [allBookings, venueRoomIds]);
  const primaryVenue = ownedVenues[0];

  useEffect(() => {
    if (!user || !isBusinessPortal) {
      navigate('/');
    }
  }, [isBusinessPortal, user, navigate]);

  const activeBookings = bookings.filter((b) => getBookingViewStatus(b) === 'active');

  const stats = [
    {
      label: t('Заведение'),
      value:
        ownedVenues.length === 0
          ? t('Не создано')
          : ownedVenues.length === 1
            ? primaryVenue?.name ?? t('Заведение')
            : t('Заведений: {count}', { count: ownedVenues.length }),
      sub:
        ownedVenues.length === 0
          ? t('Добавьте своё заведение')
          : ownedVenues.length === 1
            ? primaryVenue?.address ?? ''
            : t('Управляйте всеми своими заведениями'),
      icon: Building2,
    },
    {
      label: t('Комнат'),
      value: rooms.length,
      sub: t('Переговорных комнат'),
      icon: DoorOpen,
    },
    {
      label: t('Бронирования'),
      value: activeBookings.length,
      sub: t('Активных сейчас'),
      icon: CalendarDays,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Hero heading */}
      <div>
        <h1 className="text-4xl font-semibold text-foreground tracking-tight">
          {t('Панель управления')}
        </h1>
        <p className="text-muted-foreground mt-2 text-lg">
          {t('Добро пожаловать, {email}', { email: user?.email ?? '' })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {stats.map((stat, i) => (
          <Card key={stat.label} className={`card-hover border-t-2 border-t-primary/20 stagger-${i + 1} animate-fade-up`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium font-body text-muted-foreground tracking-wide uppercase">
                {stat.label}
              </CardTitle>
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <stat.icon className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground font-display">
                {stat.value}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {stat.sub}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Card className="card-hover group stagger-4 animate-fade-up">
          <CardHeader>
            <CardTitle className="text-lg">{t('Управление комнатами')}</CardTitle>
            <CardDescription>
              {t('Добавляйте и редактируйте комнаты вашего бизнеса')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="group/btn">
              <Link to="/rooms" className="flex items-center gap-2">
                <span>{t('Управление комнатами')}</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-0.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="card-hover group stagger-5 animate-fade-up">
          <CardHeader>
            <CardTitle className="text-lg">{t('Люди и доступ')}</CardTitle>
            <CardDescription>
              {t('Отправляйте приглашения и управляйте доступом команды')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="group/btn">
              <Link to="/people" className="flex items-center gap-2">
                <span>{t('Управление доступом')}</span>
                <Users className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="card-hover group stagger-6 animate-fade-up md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">{t('Бронирования')}</CardTitle>
            <CardDescription>{t('Просматривайте активные брони и историю отмен')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="group/btn">
              <Link to="/bookings" className="flex items-center gap-2">
                <span>{t('Открыть бронирования')}</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-0.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
