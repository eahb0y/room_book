import { useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, DoorOpen, CalendarDays, ArrowRight } from 'lucide-react';
import { useVenueStore } from '@/store/venueStore';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n/useI18n';
import { getBookingViewStatus } from '@/lib/bookingStatus';

export default function AdminDashboard() {
  const { t } = useI18n();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const venues = useVenueStore((state) => state.venues);
  const allRooms = useVenueStore((state) => state.rooms);
  const allBookings = useVenueStore((state) => state.bookings);

  const venue = useMemo(() => venues.find((v) => v.adminId === user?.id), [venues, user?.id]);
  const rooms = useMemo(() => allRooms.filter((r) => r.venueId === venue?.id), [allRooms, venue?.id]);
  const venueRoomIds = useMemo(() => rooms.map((r) => r.id), [rooms]);
  const bookings = useMemo(() => allBookings.filter((b) => venueRoomIds.includes(b.roomId)), [allBookings, venueRoomIds]);

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/app');
    }
  }, [user, navigate]);

  const activeBookings = bookings.filter((b) => getBookingViewStatus(b) === 'active');

  const stats = [
    {
      label: t('Заведение'),
      value: venue ? venue.name : t('Не создано'),
      sub: venue ? venue.address : t('Добавьте своё заведение'),
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
            <CardTitle className="text-lg">{t('Управление заведением')}</CardTitle>
            <CardDescription>
              {venue
                ? t('Редактируйте информацию о вашем заведении')
                : t('Создайте своё заведение для начала работы')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="group/btn">
              <Link to="/my-venue" className="flex items-center gap-2">
                <span>{venue ? t('Редактировать') : t('Создать заведение')}</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-0.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="card-hover group stagger-5 animate-fade-up">
          <CardHeader>
            <CardTitle className="text-lg">{t('Управление комнатами')}</CardTitle>
            <CardDescription>
              {t('Добавляйте и управляйте переговорными комнатами')}
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
      </div>
    </div>
  );
}
