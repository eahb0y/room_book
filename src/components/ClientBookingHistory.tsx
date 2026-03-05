import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  DoorOpen,
  Sparkles,
  UserRound,
  XCircle,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useVenueStore } from '@/store/venueStore';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getBookingStartDateTime, getBookingViewStatus } from '@/lib/bookingStatus';
import type { Booking, ServiceBooking } from '@/types';
import { useI18n } from '@/i18n/useI18n';

interface ClientBookingHistoryProps {
  showHeader?: boolean;
}

type BookingHistoryItem = {
  id: string;
  kind: 'room' | 'service';
  title: string;
  subtitle?: string;
  venueName: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  status: 'active' | 'cancelled';
  viewStatus: ReturnType<typeof getBookingViewStatus>;
  sortStartAt: number;
};

const getSortStartAt = (
  booking: Pick<Booking, 'bookingDate' | 'startTime'> | Pick<ServiceBooking, 'bookingDate' | 'startTime'>,
) => {
  const startAt = getBookingStartDateTime(booking).getTime();
  return Number.isNaN(startAt) ? 0 : startAt;
};

export default function ClientBookingHistory({ showHeader = true }: ClientBookingHistoryProps) {
  const { t, dateLocale } = useI18n();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const cancelBooking = useVenueStore((state) => state.cancelBooking);
  const cancelServiceBooking = useVenueStore((state) => state.cancelServiceBooking);
  const allBookings = useVenueStore((state) => state.bookings);
  const allServiceBookings = useVenueStore((state) => state.serviceBookings);
  const allRooms = useVenueStore((state) => state.rooms);
  const allVenues = useVenueStore((state) => state.venues);

  const [cancelTarget, setCancelTarget] = useState<BookingHistoryItem | null>(null);
  const [successMessage, setSuccessMessage] = useState('');

  const bookings = useMemo<BookingHistoryItem[]>(() => {
    if (!user) return [];

    const roomItems = allBookings
      .filter((booking) => booking.userId === user.id)
      .map<BookingHistoryItem>((booking) => {
        const room = allRooms.find((item) => item.id === booking.roomId);
        const venue = room ? allVenues.find((item) => item.id === room.venueId) : undefined;

        return {
          id: booking.id,
          kind: 'room',
          title: room?.name ?? t('Комната'),
          venueName: venue?.name ?? t('Заведение'),
          bookingDate: booking.bookingDate,
          startTime: booking.startTime,
          endTime: booking.endTime,
          status: booking.status,
          viewStatus: getBookingViewStatus(booking),
          sortStartAt: getSortStartAt(booking),
        };
      });

    const serviceItems = allServiceBookings
      .filter((booking) => booking.userId === user.id)
      .map<BookingHistoryItem>((booking) => {
        const venue = booking.venueId
          ? allVenues.find((item) => item.id === booking.venueId)
          : undefined;

        return {
          id: booking.id,
          kind: 'service',
          title: booking.serviceName ?? t('Услуга'),
          subtitle: booking.providerName ?? t('Специалист'),
          venueName: venue?.name ?? t('Заведение'),
          bookingDate: booking.bookingDate,
          startTime: booking.startTime,
          endTime: booking.endTime,
          status: booking.status,
          viewStatus: getBookingViewStatus(booking),
          sortStartAt: getSortStartAt(booking),
        };
      });

    return [...roomItems, ...serviceItems];
  }, [user, allBookings, allServiceBookings, allRooms, allVenues, t]);

  const activeBookings = useMemo(
    () =>
      bookings
        .filter((booking) => booking.viewStatus === 'active')
        .sort((left, right) => left.sortStartAt - right.sortStartAt),
    [bookings],
  );

  const pastBookings = useMemo(
    () =>
      bookings
        .filter((booking) => booking.viewStatus !== 'active')
        .sort((left, right) => right.sortStartAt - left.sortStartAt),
    [bookings],
  );

  if (!user) return null;

  const handleCancel = async (booking: BookingHistoryItem) => {
    if (booking.kind === 'service') {
      await cancelServiceBooking(booking.id);
    } else {
      await cancelBooking(booking.id);
    }

    setCancelTarget(null);
    setSuccessMessage(t('Бронирование успешно отменено'));
    window.setTimeout(() => setSuccessMessage(''), 3000);
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'd MMMM yyyy', { locale: dateLocale });
    } catch {
      return dateStr;
    }
  };

  const renderIcon = (booking: BookingHistoryItem) => {
    if (booking.kind === 'service') {
      return (
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
      );
    }

    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
        <DoorOpen className="h-4 w-4 text-primary" />
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {showHeader ? (
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-foreground">
            {t('Мои бронирования')}
          </h1>
          <p className="mt-2 text-muted-foreground">{t('Управляйте своими бронированиями')}</p>
        </div>
      ) : null}

      {successMessage ? (
        <Alert className="animate-scale-in border-emerald-300/60 bg-emerald-50 text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      ) : null}

      <div>
        <h2 className="mb-5 flex items-center gap-2.5 text-xl font-semibold">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-100 dark:bg-emerald-950/50">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <span className="font-body">{t('Активные ({count})', { count: activeBookings.length })}</span>
        </h2>

        {activeBookings.length === 0 ? (
          <Card className="animate-fade-up border-border/40">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <CalendarDays className="mb-4 h-10 w-10 text-muted-foreground/30" />
              <p className="mb-4 text-sm text-muted-foreground">{t('У вас нет активных бронирований')}</p>
              <Button
                onClick={() => navigate('/')}
                variant="outline"
                className="border-border/50 hover:border-primary/30"
              >
                {t('Найти пространство или услугу')}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {activeBookings.map((booking, index) => (
              <Card
                key={booking.id}
                className={`card-hover animate-fade-up stagger-${Math.min(index + 1, 6)}`}
              >
                <CardContent className="p-5">
                  <div className="flex flex-col gap-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        {renderIcon(booking)}
                        <div className="min-w-0">
                          <span className="block truncate font-medium text-foreground">{booking.title}</span>
                          {booking.subtitle ? (
                            <span className="block truncate text-xs text-muted-foreground">{booking.subtitle}</span>
                          ) : null}
                        </div>
                      </div>
                      <Badge variant="default" className="flex items-center gap-1 text-xs">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>{t('Активно')}</span>
                      </Badge>
                    </div>

                    <div className="space-y-2 pl-[42px]">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Building2 className="h-3.5 w-3.5" />
                        <span>{booking.venueName}</span>
                      </div>
                      {booking.subtitle ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <UserRound className="h-3.5 w-3.5" />
                          <span>{booking.subtitle}</span>
                        </div>
                      ) : null}
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CalendarDays className="h-3.5 w-3.5" />
                        <span>{formatDate(booking.bookingDate)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        <span>
                          {booking.startTime} - {booking.endTime}
                        </span>
                      </div>
                    </div>

                    <div className="pl-[42px] pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCancelTarget(booking)}
                        className="flex h-9 w-full items-center justify-center gap-2 border-red-300/50 text-red-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700 dark:border-red-900/30 dark:text-red-400 dark:hover:border-red-800/40 dark:hover:bg-red-950/30 dark:hover:text-red-300"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        <span>{t('Отменить')}</span>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {pastBookings.length > 0 ? (
        <div>
          <h2 className="mb-5 flex items-center gap-2.5 text-xl font-semibold">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary/50">
              <XCircle className="h-4 w-4 text-muted-foreground" />
            </div>
            <span className="font-body">{t('История ({count})', { count: pastBookings.length })}</span>
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pastBookings.map((booking, index) => (
              <Card key={booking.id} className={`animate-fade-up opacity-65 stagger-${Math.min(index + 1, 6)}`}>
                <CardContent className="p-5">
                  <div className="flex flex-col gap-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        {booking.kind === 'service' ? (
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary/50">
                            <Sparkles className="h-4 w-4 text-muted-foreground" />
                          </div>
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary/50">
                            <DoorOpen className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <span className="block truncate font-medium text-foreground">{booking.title}</span>
                          {booking.subtitle ? (
                            <span className="block truncate text-xs text-muted-foreground">{booking.subtitle}</span>
                          ) : null}
                        </div>
                      </div>
                      <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                        {booking.viewStatus === 'cancelled' ? (
                          <>
                            <XCircle className="h-3 w-3" />
                            <span>{t('Отменено')}</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-3 w-3" />
                            <span>{t('Завершено')}</span>
                          </>
                        )}
                      </Badge>
                    </div>

                    <div className="space-y-2 pl-[42px]">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Building2 className="h-3.5 w-3.5" />
                        <span>{booking.venueName}</span>
                      </div>
                      {booking.subtitle ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <UserRound className="h-3.5 w-3.5" />
                          <span>{booking.subtitle}</span>
                        </div>
                      ) : null}
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CalendarDays className="h-3.5 w-3.5" />
                        <span>{formatDate(booking.bookingDate)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        <span>
                          {booking.startTime} - {booking.endTime}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : null}

      <Dialog open={!!cancelTarget} onOpenChange={() => setCancelTarget(null)}>
        <DialogContent className="border-border/50">
          <DialogHeader>
            <DialogTitle>{t('Подтвердите отмену')}</DialogTitle>
            <DialogDescription>
              {t('Вы уверены, что хотите отменить это бронирование?')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCancelTarget(null)}
              className="border-border/50"
            >
              {t('Нет, оставить')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => (cancelTarget ? handleCancel(cancelTarget) : undefined)}
            >
              {t('Да, отменить')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
