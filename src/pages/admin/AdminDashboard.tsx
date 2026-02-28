import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, DoorOpen, CalendarDays, CheckCircle2, CircleSlash, Clock3 } from 'lucide-react';
import { useVenueStore } from '@/store/venueStore';
import { useI18n } from '@/i18n/useI18n';
import { getBookingViewStatus } from '@/lib/bookingStatus';

export default function AdminDashboard() {
  const { t } = useI18n();
  const { user, portal } = useAuthStore();
  const navigate = useNavigate();
  const isBusinessPortal = portal === 'business' || user?.role === 'admin';
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

  const todayDate = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = `${now.getMonth() + 1}`.padStart(2, '0');
    const day = `${now.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const activeBookings = useMemo(() => bookings.filter((booking) => getBookingViewStatus(booking) === 'active'), [bookings]);
  const completedBookings = useMemo(() => bookings.filter((booking) => getBookingViewStatus(booking) === 'completed'), [bookings]);
  const cancelledBookings = useMemo(() => bookings.filter((booking) => getBookingViewStatus(booking) === 'cancelled'), [bookings]);
  const todayBookings = useMemo(() => bookings.filter((booking) => booking.bookingDate === todayDate), [bookings, todayDate]);
  const occupiedRoomsNow = useMemo(() => new Set(activeBookings.map((booking) => booking.roomId)).size, [activeBookings]);
  const occupancyPercent = rooms.length > 0 ? Math.round((occupiedRoomsNow / rooms.length) * 100) : 0;
  const uniqueClients = useMemo(() => new Set(bookings.map((booking) => booking.userId)).size, [bookings]);

  const latestBookingCreatedAt = useMemo(() => {
    if (bookings.length === 0) return null;
    return bookings.reduce<string | null>((latest, booking) => {
      if (!latest) return booking.createdAt;
      return booking.createdAt > latest ? booking.createdAt : latest;
    }, null);
  }, [bookings]);

  const formatDateTime = (value: string | null) => {
    if (!value) return t('Нет данных');
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return t('Нет данных');
    return new Intl.DateTimeFormat('ru-RU', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  };

  const stats = [
    {
      label: t('Заведений'),
      value: ownedVenues.length,
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
      sub: t('Занято сейчас: {count}', { count: occupiedRoomsNow }),
      icon: DoorOpen,
    },
    {
      label: t('Активные брони'),
      value: activeBookings.length,
      sub: t('Прямо сейчас'),
      icon: Clock3,
    },
    {
      label: t('Брони сегодня'),
      value: todayBookings.length,
      sub: t('Всего броней: {count}', { count: bookings.length }),
      icon: CalendarDays,
    },
    {
      label: t('Завершённые'),
      value: completedBookings.length,
      sub: t('История выполненных броней'),
      icon: CheckCircle2,
    },
    {
      label: t('Отменённые'),
      value: cancelledBookings.length,
      sub: t('Отмены по вашим комнатам'),
      icon: CircleSlash,
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
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
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

      <Card className="border-border/40 animate-fade-up">
        <CardHeader>
          <CardTitle>{t('Статус бизнеса')}</CardTitle>
          <CardDescription>{t('Оперативная сводка по текущему состоянию')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <div className="rounded-xl border border-border/40 bg-input/20 p-4">
              <p className="text-muted-foreground">{t('Основное заведение')}</p>
              <p className="mt-1 font-medium text-foreground">
                {primaryVenue?.name ?? t('Не создано')}
              </p>
            </div>
            <div className="rounded-xl border border-border/40 bg-input/20 p-4">
              <p className="text-muted-foreground">{t('Загрузка комнат')}</p>
              <p className="mt-1 font-medium text-foreground">
                {rooms.length === 0 ? t('Нет комнат') : `${occupiedRoomsNow}/${rooms.length} (${occupancyPercent}%)`}
              </p>
            </div>
            <div className="rounded-xl border border-border/40 bg-input/20 p-4">
              <p className="text-muted-foreground">{t('Клиентов всего')}</p>
              <p className="mt-1 font-medium text-foreground">{uniqueClients}</p>
            </div>
            <div className="rounded-xl border border-border/40 bg-input/20 p-4">
              <p className="text-muted-foreground">{t('Последнее бронирование')}</p>
              <p className="mt-1 font-medium text-foreground">{formatDateTime(latestBookingCreatedAt)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
