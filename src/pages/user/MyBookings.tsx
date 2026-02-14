import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useVenueStore } from '@/store/venueStore';
import { Card, CardContent } from '@/components/ui/card';
import { CalendarDays, Clock, Building2, DoorOpen, XCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function MyBookings() {
  const { user, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const cancelBooking = useVenueStore((state) => state.cancelBooking);

  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const allBookings = useVenueStore((state) => state.bookings);
  const allRooms = useVenueStore((state) => state.rooms);
  const allVenues = useVenueStore((state) => state.venues);
  const bookings = useMemo(() => {
    if (!user) return [];
    const userBookings = allBookings.filter((b) => b.userId === user.id);
    return userBookings.map((booking) => {
      const room = allRooms.find((r) => r.id === booking.roomId);
      const venue = room ? allVenues.find((v) => v.id === room.venueId) : undefined;
      return {
        ...booking,
        roomName: room?.name,
        venueName: venue?.name,
        userEmail: user.email,
      };
    });
  }, [user, allBookings, allRooms, allVenues]);

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
    if (user?.role === 'admin') navigate('/app');
  }, [user, isAuthenticated, navigate]);

  const handleCancel = async (bookingId: string) => {
    await cancelBooking(bookingId);
    setCancelConfirmId(null);
    setSuccessMessage('Бронирование успешно отменено');
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'd MMMM yyyy', { locale: ru });
    } catch {
      return dateStr;
    }
  };

  const activeBookings = bookings.filter((b) => b.status === 'active');
  const pastBookings = bookings.filter((b) => b.status === 'cancelled');

  if (user?.role === 'admin') return null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-semibold text-foreground tracking-tight">
          Мои бронирования
        </h1>
        <p className="text-muted-foreground mt-2">
          Управляйте своими бронированиями
        </p>
      </div>

      {successMessage && (
        <Alert className="bg-emerald-950/30 border-emerald-800/40 animate-scale-in">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <AlertDescription className="text-emerald-300">{successMessage}</AlertDescription>
        </Alert>
      )}

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
              <p className="text-muted-foreground mb-4 text-sm">У вас нет активных бронирований</p>
              <Button onClick={() => navigate('/app')} variant="outline" className="border-border/50 hover:border-primary/30">
                Найти комнату
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeBookings.map((booking, i) => (
              <Card key={booking.id} className={`card-hover stagger-${Math.min(i + 1, 6)} animate-fade-up`}>
                <CardContent className="p-5">
                  <div className="flex flex-col gap-3.5">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                          <DoorOpen className="h-4 w-4 text-primary" />
                        </div>
                        <span className="font-medium text-foreground">{booking.roomName}</span>
                      </div>
                      <Badge variant="default" className="flex items-center gap-1 text-xs">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>Активно</span>
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
                        <span>{booking.startTime} — {booking.endTime}</span>
                      </div>
                    </div>

                    <div className="pl-[42px] pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCancelConfirmId(booking.id)}
                        className="w-full flex items-center justify-center gap-2 h-9 border-red-900/30 text-red-400 hover:bg-red-950/30 hover:text-red-300 hover:border-red-800/40"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        <span>Отменить</span>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Cancelled Bookings */}
      {pastBookings.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-5 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-secondary/50 flex items-center justify-center">
              <XCircle className="h-4 w-4 text-muted-foreground" />
            </div>
            <span className="font-body">Отменённые ({pastBookings.length})</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pastBookings.map((booking, i) => (
              <Card key={booking.id} className={`opacity-50 stagger-${Math.min(i + 1, 6)} animate-fade-up`}>
                <CardContent className="p-5">
                  <div className="flex flex-col gap-3.5">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-secondary/50 flex items-center justify-center">
                          <DoorOpen className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <span className="font-medium text-foreground">{booking.roomName}</span>
                      </div>
                      <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                        <XCircle className="h-3 w-3" />
                        <span>Отменено</span>
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
                        <span>{booking.startTime} — {booking.endTime}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Cancel Confirmation */}
      <Dialog open={!!cancelConfirmId} onOpenChange={() => setCancelConfirmId(null)}>
        <DialogContent className="border-border/50">
          <DialogHeader>
            <DialogTitle>Подтвердите отмену</DialogTitle>
            <DialogDescription>
              Вы уверены, что хотите отменить это бронирование?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelConfirmId(null)} className="border-border/50">
              Нет, оставить
            </Button>
            <Button
              variant="destructive"
              onClick={() => cancelConfirmId && handleCancel(cancelConfirmId)}
            >
              Да, отменить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
