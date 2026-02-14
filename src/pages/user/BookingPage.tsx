import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useVenueStore } from '@/store/venueStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DoorOpen, Users, ArrowLeft, Calendar as CalendarIcon, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, isBefore, startOfToday } from 'date-fns';
import { ru } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export default function BookingPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const { user, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  const room = useVenueStore((state) => state.rooms.find((r) => r.id === roomId));
  const venue = useVenueStore((state) =>
    room ? state.venues.find((v) => v.id === room.venueId) : undefined
  );
  const membership = useVenueStore((state) =>
    room && user ? state.getMembership(room.venueId, user.id) : undefined
  );
  const allBookings = useVenueStore((state) => state.bookings);
  const bookings = useMemo(() => allBookings.filter((b) => b.roomId === roomId && b.status === 'active'), [allBookings, roomId]);
  const createBooking = useVenueStore((state) => state.createBooking);

  const [date, setDate] = useState<Date>();
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
    if (user?.role === 'admin') navigate('/app');
    if (!room) navigate('/app');
    if (user && room && !membership) navigate('/app');
  }, [user, isAuthenticated, room, membership, navigate]);

  const getBookingsForDate = (selectedDate: Date) => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    return bookings.filter((b) => b.bookingDate === dateStr && b.status === 'active');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!date || !startTime || !endTime) {
      setError('Заполните все поля');
      return;
    }
    if (startTime >= endTime) {
      setError('Время окончания должно быть позже времени начала');
      return;
    }

    const dateStr = format(date, 'yyyy-MM-dd');

    if (isBefore(date, startOfToday())) {
      setError('Нельзя бронировать на прошедшую дату');
      return;
    }

    setIsLoading(true);

    const result = await createBooking({
      roomId: roomId!,
      userId: user!.id,
      bookingDate: dateStr,
      startTime,
      endTime,
    });

    if (result.success) {
      setSuccess(true);
      setDate(undefined);
      setStartTime('');
      setEndTime('');
    } else {
      setError(result.error || 'Произошла ошибка при бронировании');
    }

    setIsLoading(false);
  };

  if (!room || !venue) return null;

  const selectedDateBookings = date ? getBookingsForDate(date) : [];

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link to="/app" className="text-muted-foreground hover:text-primary transition-colors">Заведения</Link>
        <span className="text-muted-foreground/40">/</span>
        <Link to={`/venue/${venue.id}`} className="text-muted-foreground hover:text-primary transition-colors">{venue.name}</Link>
        <span className="text-muted-foreground/40">/</span>
        <span className="text-foreground/80">{room.name}</span>
      </div>

      {/* Room info */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-semibold text-foreground tracking-tight">
            {room.name}
          </h1>
          <div className="flex flex-wrap gap-4 mt-2">
            <p className="text-muted-foreground flex items-center gap-2">
              <DoorOpen className="h-4 w-4" />
              <span>{venue.name}</span>
            </p>
            <p className="text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span>до {room.capacity} человек</span>
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => navigate(`/venue/${venue.id}`)} className="border-border/50 hover:border-primary/30 shrink-0">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Назад
        </Button>
      </div>

      {/* Booking form + Schedule */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <Card className="border-border/40 animate-fade-up">
          <CardHeader>
            <CardTitle className="flex items-center gap-2.5 text-lg">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <CalendarIcon className="h-4 w-4 text-primary" />
              </div>
              <span className="font-body font-semibold">Бронирование</span>
            </CardTitle>
            <CardDescription>
              Выберите дату и время для бронирования
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <Alert variant="destructive" className="animate-scale-in">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {success && (
                <Alert className="bg-emerald-950/30 border-emerald-800/40 animate-scale-in">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <AlertDescription className="text-emerald-300">
                    Бронирование успешно создано!
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Дата *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal h-11 bg-input/50 border-border/50 hover:border-primary/30',
                        !date && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {date ? format(date, 'PPP', { locale: ru }) : 'Выберите дату'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 border-border/50" align="start">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={setDate}
                      disabled={(date) => isBefore(date, startOfToday())}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startTime" className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Начало *</span>
                  </Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    required
                    className="h-11 bg-input/50 border-border/50 focus:border-primary/60 transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endTime" className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Окончание *</span>
                  </Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    required
                    className="h-11 bg-input/50 border-border/50 focus:border-primary/60 transition-colors"
                  />
                </div>
              </div>

              <Button type="submit" className="w-full h-11 font-medium" disabled={isLoading}>
                {isLoading ? 'Создание…' : 'Забронировать'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Schedule */}
        <Card className="border-border/40 animate-fade-up stagger-2">
          <CardHeader>
            <CardTitle className="text-lg font-body font-semibold">Расписание комнаты</CardTitle>
            <CardDescription>
              {date ? (
                <>
                  Занятые слоты на{' '}
                  <span className="text-foreground/80 font-medium">
                    {format(date, 'd MMMM yyyy', { locale: ru })}
                  </span>
                </>
              ) : (
                'Выберите дату для просмотра расписания'
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!date ? (
              <div className="flex flex-col items-center justify-center py-10">
                <CalendarIcon className="h-10 w-10 text-muted-foreground/20 mb-4" />
                <p className="text-muted-foreground/60 text-sm">Выберите дату слева</p>
              </div>
            ) : selectedDateBookings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10">
                <div className="w-12 h-12 rounded-full bg-emerald-950/30 flex items-center justify-center mb-4">
                  <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                </div>
                <p className="text-emerald-400 font-medium text-sm">Комната свободна весь день</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
                  Занятые интервалы
                </p>
                {selectedDateBookings
                  .sort((a, b) => a.startTime.localeCompare(b.startTime))
                  .map((booking) => (
                    <div
                      key={booking.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-red-950/20 border border-red-900/30"
                    >
                      <Clock className="h-4 w-4 text-red-400" />
                      <span className="font-medium text-red-300 text-sm font-mono">
                        {booking.startTime} — {booking.endTime}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
