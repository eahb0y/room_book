import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useVenueStore } from '@/store/venueStore';
import { Card, CardContent } from '@/components/ui/card';
import { CalendarDays, Clock, User, DoorOpen, CheckCircle2, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';

export default function AdminBookings() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const venues = useVenueStore((state) => state.venues);
  const allRooms = useVenueStore((state) => state.rooms);
  const allBookings = useVenueStore((state) => state.bookings);

  const venue = useMemo(() => venues.find((v) => v.adminId === user?.id), [venues, user?.id]);
  const venueRoomIds = useMemo(() => allRooms.filter((r) => r.venueId === venue?.id).map((r) => r.id), [allRooms, venue?.id]);
  const bookings = useMemo(() => {
    return allBookings
      .filter((b) => venueRoomIds.includes(b.roomId))
      .map((booking) => {
        const room = allRooms.find((r) => r.id === booking.roomId);
        return {
          ...booking,
          roomName: room?.name,
          venueName: venue?.name,
          userEmail: undefined as string | undefined,
        };
      });
  }, [allBookings, venueRoomIds, allRooms, venue?.name]);

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/app');
      return;
    }
    if (!venue) {
      navigate('/my-venue');
    }
  }, [user, navigate, venue]);

  const activeBookings = bookings.filter((b) => b.status === 'active');
  const cancelledBookings = bookings.filter((b) => b.status === 'cancelled');

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'd MMMM yyyy', { locale: ru });
    } catch {
      return dateStr;
    }
  };

  const BookingCard = ({ booking, index }: { booking: typeof bookings[0]; index: number }) => (
    <Card className={`card-hover stagger-${Math.min(index + 1, 6)} animate-fade-up ${booking.status === 'cancelled' ? 'opacity-50' : ''}`}>
      <CardContent className="p-5">
        <div className="flex flex-col gap-3.5">
          {/* Header */}
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <DoorOpen className="h-4 w-4 text-primary" />
              </div>
              <span className="font-medium text-foreground">{booking.roomName}</span>
            </div>
            <Badge
              variant={booking.status === 'active' ? 'default' : 'secondary'}
              className="text-xs"
            >
              {booking.status === 'active' ? (
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>Активно</span>
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <XCircle className="h-3 w-3" />
                  <span>Отменено</span>
                </span>
              )}
            </Badge>
          </div>

          {/* Details */}
          <div className="space-y-2 pl-[42px]">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" />
              <span>{formatDate(booking.bookingDate)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>{booking.startTime} — {booking.endTime}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-3.5 w-3.5" />
              <span>{booking.userEmail || 'Пользователь'}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (!venue) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-muted-foreground">Сначала создайте заведение</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-semibold text-foreground tracking-tight">
          Бронирования
        </h1>
        <p className="text-muted-foreground mt-2">
          Все бронирования в заведении «{venue.name}»
        </p>
      </div>

      {/* Active Bookings */}
      <div>
        <h2 className="text-xl font-semibold mb-5 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-emerald-950/50 flex items-center justify-center">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <span className="font-body">Активные ({activeBookings.length})</span>
        </h2>
        {activeBookings.length === 0 ? (
          <Card className="border-border/40 animate-fade-up">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <CalendarDays className="h-10 w-10 text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground text-sm">Нет активных бронирований</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeBookings.map((booking, i) => (
              <BookingCard key={booking.id} booking={booking} index={i} />
            ))}
          </div>
        )}
      </div>

      {/* Cancelled Bookings */}
      {cancelledBookings.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-5 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-secondary/50 flex items-center justify-center">
              <XCircle className="h-4 w-4 text-muted-foreground" />
            </div>
            <span className="font-body">Отменённые ({cancelledBookings.length})</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cancelledBookings.map((booking, i) => (
              <BookingCard key={booking.id} booking={booking} index={i} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
