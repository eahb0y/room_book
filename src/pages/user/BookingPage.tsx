import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { addDays, format, isBefore, startOfToday } from 'date-fns';
import { AlertCircle, ArrowLeft, Calendar as CalendarIcon, CheckCircle2, ChevronLeft, ChevronRight, Clock3, DoorOpen, Users } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useVenueStore } from '@/store/venueStore';
import { useVenueDataGuard } from '@/hooks/useVenueDataGuard';
import { cn } from '@/lib/utils';
import { getRoomPhotoUrls } from '@/lib/roomPhotos';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RoomPhotoGallery } from '@/components/RoomPhotoGallery';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useI18n } from '@/i18n/useI18n';

const SLOT_STEP_MINUTES = 15;
const MINUTES_IN_DAY = 24 * 60;
const SLOT_START_MINUTES = Array.from({ length: MINUTES_IN_DAY / SLOT_STEP_MINUTES }, (_, index) => index * SLOT_STEP_MINUTES);
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

const toMinutes = (time: string) => {
  const [hour, minute] = time.split(':');
  return parseInt(hour, 10) * 60 + parseInt(minute, 10);
};

const toTime = (totalMinutes: number) => {
  if (totalMinutes >= MINUTES_IN_DAY) return '24:00';
  const safeMinutes = Math.max(0, totalMinutes);
  const hour = Math.floor(safeMinutes / 60).toString().padStart(2, '0');
  const minute = (safeMinutes % 60).toString().padStart(2, '0');
  return `${hour}:${minute}`;
};

export default function BookingPage() {
  const { t, dateLocale } = useI18n();
  const { roomId } = useParams<{ roomId: string }>();
  const { user, isAuthenticated } = useAuthStore();
  const { isVenueDataLoading } = useVenueDataGuard(user);
  const navigate = useNavigate();

  const room = useVenueStore((state) => state.rooms.find((currentRoom) => currentRoom.id === roomId));
  const venue = useVenueStore((state) =>
    room ? state.venues.find((currentVenue) => currentVenue.id === room.venueId) : undefined
  );
  const membership = useVenueStore((state) =>
    room && user ? state.getMembership(room.venueId, user.id) : undefined
  );
  const allBookings = useVenueStore((state) => state.bookings);
  const bookings = useMemo(
    () => allBookings.filter((booking) => booking.roomId === roomId && booking.status === 'active'),
    [allBookings, roomId]
  );
  const createBooking = useVenueStore((state) => state.createBooking);
  const loadRoomBookings = useVenueStore((state) => state.loadRoomBookings);

  const [date, setDate] = useState<Date>(startOfToday());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogStartTime, setDialogStartTime] = useState('');
  const [dialogEndTime, setDialogEndTime] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (user?.role === 'admin') {
      navigate('/app');
      return;
    }

    if (isVenueDataLoading) return;

    if (roomId && !room) {
      navigate('/app');
      return;
    }

    if (user && room && !membership) {
      navigate('/app');
    }
  }, [isAuthenticated, isVenueDataLoading, membership, navigate, room, roomId, user]);

  useEffect(() => {
    if (isVenueDataLoading || !roomId || !room || !user || user.role !== 'user') return;
    void loadRoomBookings(roomId);
  }, [isVenueDataLoading, loadRoomBookings, room, roomId, user]);

  const selectedDateBookings = useMemo(() => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return bookings.filter((booking) => booking.bookingDate === dateStr);
  }, [bookings, date]);

  const busyRanges = useMemo(() => (
    selectedDateBookings.map((booking) => ({
      start: toMinutes(booking.startTime),
      end: toMinutes(booking.endTime),
    }))
  ), [selectedDateBookings]);

  const isSlotBusy = useCallback((slotStartMinute: number) => (
    busyRanges.some((range) =>
      slotStartMinute < range.end && slotStartMinute + SLOT_STEP_MINUTES > range.start
    )
  ), [busyRanges]);

  const getAvailableEndMinutes = useCallback((startMinute: number) => {
    const nextBusyStart = busyRanges
      .filter((range) => range.start > startMinute)
      .reduce((nearest, range) => Math.min(nearest, range.start), MINUTES_IN_DAY);

    const values: number[] = [];
    for (let minute = startMinute + SLOT_STEP_MINUTES; minute <= nextBusyStart; minute += SLOT_STEP_MINUTES) {
      values.push(minute);
    }
    return values;
  }, [busyRanges]);

  const availableStartTimes = useMemo(() => (
    SLOT_START_MINUTES
      .filter((minute) => !isSlotBusy(minute))
      .filter((minute) => getAvailableEndMinutes(minute).length > 0)
      .map((minute) => toTime(minute))
  ), [getAvailableEndMinutes, isSlotBusy]);

  const availableEndTimes = useMemo(() => {
    if (!dialogStartTime) return [];
    return getAvailableEndMinutes(toMinutes(dialogStartTime)).map((minute) => toTime(minute));
  }, [dialogStartTime, getAvailableEndMinutes]);

  const dayTabs = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(date, index - 3)),
    [date]
  );

  const pickDate = (nextDate: Date) => {
    setDate(nextDate);
    setIsDialogOpen(false);
    setDialogStartTime('');
    setDialogEndTime('');
    setError('');
    setSuccessMessage('');
  };

  const openSlotDialog = (slotMinute: number) => {
    const selectedStart = toTime(slotMinute);
    const ends = getAvailableEndMinutes(slotMinute).map((minute) => toTime(minute));
    if (ends.length === 0) return;

    setError('');
    setSuccessMessage('');
    setDialogStartTime(selectedStart);
    setDialogEndTime(ends[0]);
    setIsDialogOpen(true);
  };

  const handleCreateBooking = async () => {
    setError('');
    setSuccessMessage('');

    if (!dialogStartTime || !dialogEndTime) {
      setError(t('Укажите начало и окончание бронирования'));
      return;
    }

    if (dialogStartTime >= dialogEndTime) {
      setError(t('Время окончания должно быть позже времени начала'));
      return;
    }

    if (isBefore(date, startOfToday())) {
      setError(t('Нельзя бронировать на прошедшую дату'));
      return;
    }

    if (!roomId || !user) {
      setError(t('Не удалось определить пользователя или комнату'));
      return;
    }

    setIsLoading(true);
    const result = await createBooking({
      roomId,
      userId: user.id,
      bookingDate: format(date, 'yyyy-MM-dd'),
      startTime: dialogStartTime,
      endTime: dialogEndTime,
    });
    setIsLoading(false);

    if (!result.success) {
      setError(result.error ? t(result.error) : t('Произошла ошибка при бронировании'));
      return;
    }

    setIsDialogOpen(false);
    setDialogStartTime('');
    setDialogEndTime('');
    setSuccessMessage(t('Бронь создана: {start} — {end}', { start: dialogStartTime, end: dialogEndTime }));
  };

  const canGoToPreviousDay = !isBefore(addDays(date, -1), startOfToday());

  if (isVenueDataLoading) return null;
  if (!room || !venue) return null;
  if (user && !membership) return null;
  const roomPhotos = getRoomPhotoUrls(room);

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-border/40 bg-muted/20">
        {roomPhotos.length > 0 ? (
          <RoomPhotoGallery
            photos={roomPhotos}
            roomName={room.name}
            imageContainerClassName="h-56 w-full rounded-none border-none bg-transparent sm:h-72"
            imageClassName="h-56 sm:h-72"
            showThumbnails={false}
            showControls={false}
          />
        ) : (
          <div className="h-56 w-full bg-gradient-to-br from-primary/20 via-secondary/30 to-muted sm:h-72" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/25 to-black/5" />
        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">{room.name}</h1>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/85">
            <p className="flex items-center gap-2">
              <DoorOpen className="h-4 w-4" />
              <span>{venue.name}</span>
            </p>
            <p className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span>{t('до {count} человек', { count: room.capacity })}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm">
          <Link to="/app" className="text-muted-foreground transition-colors hover:text-primary">{t('Заведения')}</Link>
          <span className="text-muted-foreground/40">/</span>
          <Link to={`/venue/${venue.id}`} className="text-muted-foreground transition-colors hover:text-primary">{venue.name}</Link>
          <span className="text-muted-foreground/40">/</span>
          <span className="text-foreground/90">{room.name}</span>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate(`/venue/${venue.id}`)}
          className="h-10 shrink-0 border-border/50 hover:border-primary/30"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('Назад к списку комнат')}
        </Button>
      </div>

      <Card className="border-border/40 animate-fade-up">
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-lg font-semibold font-body">{t('Выберите день')}</CardTitle>
              <CardDescription className="mt-1">
                {t('Нажмите на свободный 15‑минутный слот, затем задайте начало и конец бронирования')}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={!canGoToPreviousDay}
                onClick={() => pickDate(addDays(date, -1))}
                className="h-9 w-9 border-border/50"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => pickDate(addDays(date, 1))}
                className="h-9 w-9 border-border/50"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => pickDate(startOfToday())}
                className="h-9 border-border/50"
              >
                {t('Сегодня')}
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className="h-9 border-border/50">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(date, 'd MMM yyyy', { locale: dateLocale })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-auto border-border/50 p-0">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(picked) => {
                      if (!picked) return;
                      pickDate(picked);
                    }}
                    locale={dateLocale}
                    disabled={(calendarDate) => isBefore(calendarDate, startOfToday())}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
            {dayTabs.map((day) => {
              const isPast = isBefore(day, startOfToday());
              const isCurrent = format(day, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd');
              return (
                <button
                  key={format(day, 'yyyy-MM-dd')}
                  type="button"
                  disabled={isPast}
                  onClick={() => pickDate(day)}
                  className={cn(
                    'rounded-lg border px-2 py-2 text-left transition-all',
                    isCurrent
                      ? 'border-primary/70 bg-primary/12 text-foreground'
                      : 'border-border/50 bg-muted/20 text-muted-foreground hover:border-primary/30 hover:text-foreground',
                    isPast && 'cursor-not-allowed opacity-40'
                  )}
                >
                  <p className="text-[11px] uppercase tracking-wide">{format(day, 'EEE', { locale: dateLocale })}</p>
                  <p className="mt-1 text-sm font-semibold">{format(day, 'd MMM', { locale: dateLocale })}</p>
                </button>
              );
            })}
          </div>
        </CardHeader>
      </Card>

      <Card className="border-border/40 animate-fade-up stagger-2">
        <CardHeader>
          <CardTitle className="text-lg font-body font-semibold">
            {t('Расписание на {date}', { date: format(date, 'd MMMM yyyy', { locale: dateLocale }) })}
          </CardTitle>
          <CardDescription>
            {t('Красный цвет - занято. Нейтральный цвет - свободно, нажмите для брони.')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive" className="animate-scale-in">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {successMessage && (
            <Alert className="border-emerald-800/40 bg-emerald-950/30 animate-scale-in">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <AlertDescription className="text-emerald-300">{successMessage}</AlertDescription>
            </Alert>
          )}

          <ScrollArea className="h-[680px] rounded-xl border border-border/40 bg-muted/10 p-3 pr-2">
            <div className="space-y-1.5">
              {HOURS.map((hour) => {
                const quarterSlots = [0, 15, 30, 45].map((quarterMinute) => hour * 60 + quarterMinute);
                return (
                  <div key={hour} className="grid grid-cols-[64px_1fr] items-start gap-3">
                    <div className="pt-2 font-mono text-xs text-muted-foreground">{toTime(hour * 60)}</div>
                    <div className="flex flex-col gap-1.5">
                      {quarterSlots.map((minute) => {
                        const busy = isSlotBusy(minute);
                        return (
                          <button
                            key={minute}
                            type="button"
                            disabled={busy}
                            onClick={() => openSlotDialog(minute)}
                            className={cn(
                              'w-full rounded-md border px-2 py-2 text-left transition-all',
                              busy
                                ? 'cursor-not-allowed border-red-900/45 bg-red-950/35 text-red-200'
                                : 'border-border/60 bg-background/65 text-foreground hover:border-primary/45 hover:bg-primary/10'
                            )}
                          >
                            <p className="font-mono text-xs">{toTime(minute)}</p>
                            <p className="mt-1 text-[10px] uppercase tracking-wide opacity-80">
                              {busy ? t('занято') : t('свободно')}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {selectedDateBookings
              .slice()
              .sort((first, second) => first.startTime.localeCompare(second.startTime))
              .map((booking) => (
                <div key={booking.id} className="flex items-center gap-2 rounded-lg border border-red-900/35 bg-red-950/20 px-3 py-2 text-sm">
                  <Clock3 className="h-4 w-4 text-red-300" />
                  <span className="font-mono text-red-200">
                    {booking.startTime} - {booking.endTime}
                  </span>
                </div>
              ))}
            {selectedDateBookings.length === 0 && (
              <div className="col-span-full rounded-lg border border-emerald-800/35 bg-emerald-950/20 px-3 py-2 text-sm text-emerald-300">
                {t('На выбранный день комната полностью свободна.')}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setDialogStartTime('');
            setDialogEndTime('');
          }
        }}
      >
        <DialogContent className="border-border/50">
          <DialogHeader>
            <DialogTitle>{t('Новое бронирование')}</DialogTitle>
            <DialogDescription>
              {format(date, "d MMMM yyyy, EEEE", { locale: dateLocale })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{t('Начало')}</p>
              <Select
                value={dialogStartTime}
                onValueChange={(value) => {
                  setDialogStartTime(value);
                  const ends = getAvailableEndMinutes(toMinutes(value)).map((minute) => toTime(minute));
                  setDialogEndTime((current) => (ends.includes(current) ? current : (ends[0] ?? '')));
                }}
              >
                <SelectTrigger className="w-full h-10 border-border/50 bg-input/50">
                  <SelectValue placeholder={t('Выберите начало')} />
                </SelectTrigger>
                <SelectContent>
                  {availableStartTimes.map((slot) => (
                    <SelectItem key={slot} value={slot}>
                      {slot}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{t('Окончание')}</p>
              <Select value={dialogEndTime} onValueChange={setDialogEndTime}>
                <SelectTrigger className="w-full h-10 border-border/50 bg-input/50">
                  <SelectValue placeholder={t('Выберите окончание')} />
                </SelectTrigger>
                <SelectContent>
                  {availableEndTimes.map((slot) => (
                    <SelectItem key={slot} value={slot}>
                      {slot}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="border-border/50"
              onClick={() => setIsDialogOpen(false)}
              disabled={isLoading}
            >
              {t('Отмена')}
            </Button>
            <Button type="button" onClick={handleCreateBooking} disabled={isLoading || !dialogStartTime || !dialogEndTime}>
              {isLoading ? t('Создание…') : t('Подтвердить бронь')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
