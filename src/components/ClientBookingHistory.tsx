import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { Building2, CalendarDays, CheckCircle2, Clock, DoorOpen, XCircle } from 'lucide-react';
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
import type { Booking } from '@/types';
import { useI18n } from '@/i18n/useI18n';

interface ClientBookingHistoryProps {
  showHeader?: boolean;
}

type BookingHistoryItem = Booking & {
  roomName: string;
  venueName: string;
  viewStatus: ReturnType<typeof getBookingViewStatus>;
  sortStartAt: number;
};

const getSortStartAt = (booking: Pick<Booking, 'bookingDate' | 'startTime'>) => {
  const startAt = getBookingStartDateTime(booking).getTime();
  return Number.isNaN(startAt) ? 0 : startAt;
};

export default function ClientBookingHistory({ showHeader = true }: ClientBookingHistoryProps) {
  const { t, dateLocale } = useI18n();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const cancelBooking = useVenueStore((state) => state.cancelBooking);
  const allBookings = useVenueStore((state) => state.bookings);
  const allRooms = useVenueStore((state) => state.rooms);
  const allVenues = useVenueStore((state) => state.venues);

  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState('');

  const bookings = useMemo<BookingHistoryItem[]>(() => {
    if (!user) return [];

    return allBookings
      .filter((booking) => booking.userId === user.id)
      .map((booking) => {
        const room = allRooms.find((item) => item.id === booking.roomId);
        const venue = room ? allVenues.find((item) => item.id === room.venueId) : undefined;

        return {
          ...booking,
          roomName: room?.name ?? t('Комната'),
          venueName: venue?.name ?? t('Заведение'),
          viewStatus: getBookingViewStatus(booking),
          sortStartAt: getSortStartAt(booking),
        };
      });
  }, [user, allBookings, allRooms, allVenues, t]);

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

  const handleCancel = async (bookingId: string) => {
    await cancelBooking(bookingId);
    setCancelConfirmId(null);
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
        <Alert className="animate-scale-in border-emerald-800/40 bg-emerald-950/30">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <AlertDescription className="text-emerald-300">{successMessage}</AlertDescription>
        </Alert>
      ) : null}

      <div>
        <h2 className="mb-5 flex items-center gap-2.5 text-xl font-semibold">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-950/50">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
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
                {t('Найти комнату')}
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
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                          <DoorOpen className="h-4 w-4 text-primary" />
                        </div>
                        <span className="font-medium text-foreground">{booking.roomName}</span>
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
                        onClick={() => setCancelConfirmId(booking.id)}
                        className="flex h-9 w-full items-center justify-center gap-2 border-red-900/30 text-red-400 hover:border-red-800/40 hover:bg-red-950/30 hover:text-red-300"
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
              <Card key={booking.id} className={`animate-fade-up opacity-50 stagger-${Math.min(index + 1, 6)}`}>
                <CardContent className="p-5">
                  <div className="flex flex-col gap-3.5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary/50">
                          <DoorOpen className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <span className="font-medium text-foreground">{booking.roomName}</span>
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

      <Dialog open={!!cancelConfirmId} onOpenChange={() => setCancelConfirmId(null)}>
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
              onClick={() => setCancelConfirmId(null)}
              className="border-border/50"
            >
              {t('Нет, оставить')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => (cancelConfirmId ? handleCancel(cancelConfirmId) : undefined)}
            >
              {t('Да, отменить')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
