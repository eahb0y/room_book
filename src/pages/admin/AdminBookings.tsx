import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useVenueStore } from '@/store/venueStore';
import { useVenueDataGuard } from '@/hooks/useVenueDataGuard';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, parseISO, type Locale } from 'date-fns';
import { CalendarDays, CheckCircle2, History, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n/useI18n';
import { getBookingViewStatus, type BookingViewStatus } from '@/lib/bookingStatus';

const DISPLAY_SLOT_STEP_MINUTES = 30;
const EDIT_SLOT_STEP_SECONDS = 15 * 60;
const MINUTES_IN_DAY = 24 * 60;
const DEFAULT_DAY_START = 8 * 60;
const DEFAULT_DAY_END = 22 * 60;

const toMinutes = (time: string) => {
  const [hour, minute] = time.split(':').map((part) => parseInt(part, 10));
  return (Number.isFinite(hour) ? hour : 0) * 60 + (Number.isFinite(minute) ? minute : 0);
};

const toTime = (minutes: number) => {
  const safeMinutes = Math.max(0, Math.min(minutes, MINUTES_IN_DAY));
  const hour = Math.floor(safeMinutes / 60).toString().padStart(2, '0');
  const minute = (safeMinutes % 60).toString().padStart(2, '0');
  return `${hour}:${minute}`;
};

const buildDisplaySlots = (bookings: BookingViewItem[]) => {
  if (bookings.length === 0) {
    const slots: number[] = [];
    for (let minute = DEFAULT_DAY_START; minute < DEFAULT_DAY_END; minute += DISPLAY_SLOT_STEP_MINUTES) {
      slots.push(minute);
    }
    return slots;
  }

  const minStart = bookings.reduce((min, booking) => Math.min(min, booking.startMinutes), MINUTES_IN_DAY);
  const maxEnd = bookings.reduce((max, booking) => Math.max(max, booking.endMinutes), 0);

  const startBoundary = Math.max(
    0,
    Math.floor((Math.max(minStart - DISPLAY_SLOT_STEP_MINUTES, 0)) / DISPLAY_SLOT_STEP_MINUTES) * DISPLAY_SLOT_STEP_MINUTES,
  );
  const endBoundary = Math.min(
    MINUTES_IN_DAY,
    Math.ceil((Math.min(maxEnd + DISPLAY_SLOT_STEP_MINUTES, MINUTES_IN_DAY)) / DISPLAY_SLOT_STEP_MINUTES) * DISPLAY_SLOT_STEP_MINUTES,
  );

  const slots: number[] = [];
  for (let minute = startBoundary; minute < endBoundary; minute += DISPLAY_SLOT_STEP_MINUTES) {
    slots.push(minute);
  }
  return slots;
};

const formatDateValue = (value: string, dateLocale: Locale) => {
  try {
    return format(parseISO(value), 'd MMMM yyyy', { locale: dateLocale });
  } catch {
    return value;
  }
};

const resolveUserName = (firstName?: string, lastName?: string) => {
  const normalizedFirstName = firstName?.trim();
  const normalizedLastName = lastName?.trim();
  const fullName = [normalizedFirstName, normalizedLastName].filter((part) => Boolean(part)).join(' ').trim();
  return fullName.length > 0 ? fullName : undefined;
};

const getBookingUserLabel = (params: {
  userId: string;
  userEmail?: string;
  userFirstName?: string;
  userLastName?: string;
  t: (value: string, inputParams?: Record<string, string | number>) => string;
}) => {
  const fullName = resolveUserName(params.userFirstName, params.userLastName);
  const email = params.userEmail?.trim();

  if (fullName && email) return `${fullName} (${email})`;
  if (fullName) return fullName;
  if (email) return email;

  return `${params.t('Пользователь')} #${params.userId.slice(0, 8)}`;
};

type BookingViewItem = {
  id: string;
  roomId: string;
  roomName: string;
  userId: string;
  userLabel: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  startMinutes: number;
  endMinutes: number;
  status: 'active' | 'cancelled';
  viewStatus: BookingViewStatus;
};

const statusBadgeClassName: Record<BookingViewStatus, string> = {
  active: 'border-emerald-700/45 bg-emerald-950/30 text-emerald-300',
  completed: 'border-blue-700/35 bg-blue-950/25 text-blue-200',
  cancelled: 'border-muted-foreground/30 bg-muted/25 text-muted-foreground',
};

const statusCellClassName: Record<BookingViewStatus, string> = {
  active: 'border-emerald-800/45 bg-emerald-950/20',
  completed: 'border-blue-800/35 bg-blue-950/15',
  cancelled: 'border-muted-foreground/25 bg-muted/15',
};

function BookingScheduleGrid({
  rooms,
  bookings,
  t,
  onEdit,
}: {
  rooms: Array<{ id: string; name: string }>;
  bookings: BookingViewItem[];
  t: (value: string, params?: Record<string, string | number>) => string;
  onEdit?: (booking: BookingViewItem) => void;
}) {
  const slots = useMemo(() => buildDisplaySlots(bookings), [bookings]);

  const bookingsByRoom = useMemo(() => {
    const map = new Map<string, BookingViewItem[]>();
    for (const room of rooms) {
      map.set(room.id, []);
    }
    for (const booking of bookings) {
      const roomBookings = map.get(booking.roomId) ?? [];
      roomBookings.push(booking);
      map.set(booking.roomId, roomBookings);
    }
    for (const roomBookings of map.values()) {
      roomBookings.sort((first, second) => first.startMinutes - second.startMinutes);
    }
    return map;
  }, [bookings, rooms]);

  if (rooms.length === 0) {
    return (
      <Card className="border-border/40">
        <CardContent className="flex items-center justify-center py-10 text-sm text-muted-foreground">
          {t('Сначала добавьте комнаты')}
        </CardContent>
      </Card>
    );
  }

  if (bookings.length === 0) {
    return (
      <Card className="border-border/40">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <CalendarDays className="mb-4 h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">{t('На выбранный день нет бронирований')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/40">
      <CardContent className="p-0">
        <ScrollArea className="w-full rounded-xl">
          <div className="min-w-[860px]">
            <table className="w-full border-collapse text-xs">
              <thead className="sticky top-0 z-10 bg-[hsl(240,5%,8%)]">
                <tr>
                  <th className="w-[88px] border-b border-border/40 px-3 py-3 text-left font-semibold text-foreground/85">
                    {t('Время')}
                  </th>
                  {rooms.map((room) => (
                    <th
                      key={room.id}
                      className="border-b border-l border-border/40 px-3 py-3 text-left font-semibold text-foreground/85"
                    >
                      {room.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {slots.map((slotStart) => {
                  const slotEnd = slotStart + DISPLAY_SLOT_STEP_MINUTES;

                  return (
                    <tr key={slotStart} className="align-top">
                      <td className="border-b border-border/35 px-3 py-2 font-mono text-[11px] text-muted-foreground">
                        {toTime(slotStart)}
                      </td>
                      {rooms.map((room) => {
                        const roomBookings = bookingsByRoom.get(room.id) ?? [];

                        const bookingsStartingInSlot = roomBookings.filter(
                          (booking) => booking.startMinutes >= slotStart && booking.startMinutes < slotEnd,
                        );

                        const bookingsCoveringSlot = roomBookings.filter(
                          (booking) => booking.startMinutes < slotEnd && booking.endMinutes > slotStart,
                        );

                        const hasContinuation = roomBookings.some(
                          (booking) => booking.startMinutes < slotStart && booking.endMinutes > slotStart,
                        );

                        return (
                          <td
                            key={`${room.id}-${slotStart}`}
                            className={cn(
                              'border-b border-l border-border/35 px-2 py-1.5 align-top',
                              bookingsCoveringSlot.length > 0 && 'bg-primary/5',
                            )}
                          >
                            {bookingsStartingInSlot.length > 0 ? (
                              <div className="space-y-1.5">
                                {bookingsStartingInSlot.map((booking) => (
                                  <div
                                    key={booking.id}
                                    className={cn('rounded-md border px-2 py-1.5', statusCellClassName[booking.viewStatus])}
                                  >
                                    <div className="flex items-center justify-between gap-1.5">
                                      <span className="font-mono text-[11px] text-foreground/90">
                                        {booking.startTime} - {booking.endTime}
                                      </span>
                                      <Badge className={cn('h-5 border text-[10px] font-medium', statusBadgeClassName[booking.viewStatus])}>
                                        {booking.viewStatus === 'active'
                                          ? t('Активно')
                                          : booking.viewStatus === 'completed'
                                            ? t('Завершено')
                                            : t('Отменено')}
                                      </Badge>
                                    </div>
                                    <p className="mt-1 truncate text-[10px] text-muted-foreground" title={booking.userLabel}>
                                      {booking.userLabel}
                                    </p>
                                    {onEdit && booking.viewStatus === 'active' && (
                                      <div className="mt-1.5 flex justify-end">
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="ghost"
                                          className="h-6 px-2 text-[10px]"
                                          onClick={() => onEdit(booking)}
                                        >
                                          <Pencil className="mr-1 h-3 w-3" />
                                          {t('Редактировать')}
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : hasContinuation ? (
                              <div className="mx-auto mt-1 h-2 w-10 rounded-full bg-primary/35" />
                            ) : (
                              <span className="text-[11px] text-muted-foreground/30">·</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export default function AdminBookings() {
  const { t, dateLocale } = useI18n();
  const { user } = useAuthStore();
  const { isVenueDataLoading } = useVenueDataGuard(user);
  const navigate = useNavigate();

  const venues = useVenueStore((state) => state.venues);
  const allRooms = useVenueStore((state) => state.rooms);
  const allBookings = useVenueStore((state) => state.bookings);
  const updateBooking = useVenueStore((state) => state.updateBooking);

  const [activeDate, setActiveDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [historyDate, setHistoryDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingBookingId, setEditingBookingId] = useState<string | null>(null);
  const [editRoomId, setEditRoomId] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editStatus, setEditStatus] = useState<'active' | 'cancelled'>('active');
  const [editError, setEditError] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const venue = useMemo(() => venues.find((item) => item.adminId === user?.id), [venues, user?.id]);

  const rooms = useMemo(
    () => allRooms.filter((room) => room.venueId === venue?.id).sort((first, second) => first.name.localeCompare(second.name)),
    [allRooms, venue?.id],
  );

  const bookings = useMemo<BookingViewItem[]>(() => {
    const roomById = new Map(rooms.map((room) => [room.id, room]));

    return allBookings
      .filter((booking) => roomById.has(booking.roomId))
      .map((booking) => {
        const room = roomById.get(booking.roomId);
        return {
          id: booking.id,
          roomId: booking.roomId,
          roomName: room?.name ?? t('Комната'),
          userId: booking.userId,
          userLabel: getBookingUserLabel({
            userId: booking.userId,
            userEmail: booking.userEmail,
            userFirstName: booking.userFirstName,
            userLastName: booking.userLastName,
            t,
          }),
          bookingDate: booking.bookingDate,
          startTime: booking.startTime,
          endTime: booking.endTime,
          startMinutes: toMinutes(booking.startTime),
          endMinutes: toMinutes(booking.endTime),
          status: booking.status,
          viewStatus: getBookingViewStatus(booking),
        };
      })
      .sort((first, second) => {
        if (first.bookingDate !== second.bookingDate) return first.bookingDate.localeCompare(second.bookingDate);
        if (first.startMinutes !== second.startMinutes) return first.startMinutes - second.startMinutes;
        return first.roomName.localeCompare(second.roomName);
      });
  }, [allBookings, rooms, t]);

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/app');
      return;
    }

    if (isVenueDataLoading) return;

    if (!venue) {
      navigate('/my-venue');
    }
  }, [isVenueDataLoading, navigate, user, venue]);

  const activeBookings = useMemo(() => bookings.filter((booking) => booking.viewStatus === 'active'), [bookings]);
  const historyBookings = useMemo(() => bookings.filter((booking) => booking.viewStatus !== 'active'), [bookings]);

  const activeDates = useMemo(() => Array.from(new Set(activeBookings.map((booking) => booking.bookingDate))).sort(), [activeBookings]);

  const historyDates = useMemo(
    () => Array.from(new Set(historyBookings.map((booking) => booking.bookingDate))).sort((first, second) => second.localeCompare(first)),
    [historyBookings],
  );

  const todayDate = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

  const resolvedActiveDate = useMemo(() => {
    if (activeDates.length === 0) return activeDate || todayDate;
    if (activeDates.includes(activeDate)) return activeDate;
    return activeDates.find((value) => value >= todayDate) ?? activeDates[0];
  }, [activeDate, activeDates, todayDate]);

  const resolvedHistoryDate = useMemo(() => {
    if (historyDates.length === 0) return historyDate || todayDate;
    if (historyDates.includes(historyDate)) return historyDate;
    return historyDates[0];
  }, [historyDate, historyDates, todayDate]);

  const activeDateBookings = useMemo(
    () => activeBookings.filter((booking) => booking.bookingDate === resolvedActiveDate),
    [activeBookings, resolvedActiveDate],
  );

  const historyDateBookings = useMemo(
    () => historyBookings.filter((booking) => booking.bookingDate === resolvedHistoryDate),
    [historyBookings, resolvedHistoryDate],
  );

  const openEditDialog = (booking: BookingViewItem) => {
    setEditingBookingId(booking.id);
    setEditRoomId(booking.roomId);
    setEditDate(booking.bookingDate);
    setEditStartTime(booking.startTime);
    setEditEndTime(booking.endTime);
    setEditStatus(booking.status);
    setEditError('');
    setEditDialogOpen(true);
  };

  const resetEditDialog = () => {
    setEditDialogOpen(false);
    setEditingBookingId(null);
    setEditRoomId('');
    setEditDate('');
    setEditStartTime('');
    setEditEndTime('');
    setEditStatus('active');
    setEditError('');
  };

  const handleSaveEdit = async () => {
    if (!editingBookingId) return;

    setEditError('');

    if (!editRoomId || !editDate || !editStartTime || !editEndTime) {
      setEditError(t('Заполните все поля'));
      return;
    }

    if (editStartTime >= editEndTime) {
      setEditError(t('Время окончания должно быть позже времени начала'));
      return;
    }

    setIsSaving(true);
    const result = await updateBooking(editingBookingId, {
      roomId: editRoomId,
      bookingDate: editDate,
      startTime: editStartTime,
      endTime: editEndTime,
      status: editStatus,
    });
    setIsSaving(false);

    if (!result.success) {
      setEditError(result.error ? t(result.error) : t('Произошла ошибка при сохранении'));
      return;
    }

    resetEditDialog();
    setSaveMessage(t('Бронирование успешно обновлено'));
    setTimeout(() => setSaveMessage(''), 3000);
  };

  if (isVenueDataLoading) return null;

  if (!venue) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-muted-foreground">{t('Сначала создайте заведение')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-semibold tracking-tight text-foreground">{t('Бронирования')}</h1>
        <p className="mt-2 text-muted-foreground">
          {t('Все бронирования в заведении «{venue}»', { venue: venue.name })}
        </p>
      </div>

      {saveMessage && (
        <Alert className="border-emerald-800/40 bg-emerald-950/30 animate-scale-in">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <AlertDescription className="text-emerald-300">{saveMessage}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="active" className="space-y-4">
        <TabsList className="grid h-10 w-full max-w-[360px] grid-cols-2">
          <TabsTrigger value="active" className="gap-1.5">
            <CheckCircle2 className="h-4 w-4" />
            {t('Активные ({count})', { count: activeBookings.length })}
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5">
            <History className="h-4 w-4" />
            {t('История ({count})', { count: historyBookings.length })}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          <Card className="border-border/40">
            <CardHeader className="gap-3">
              <CardTitle className="text-lg font-semibold">{t('Активные брони по слотам')}</CardTitle>
              <CardDescription>{t('Сверху комнаты, слева время. В ячейках показаны текущие брони.')}</CardDescription>
              {activeDates.length > 0 && (
                <div className="max-w-[320px]">
                  <Label htmlFor="active-date">{t('Дата')}</Label>
                  <Select value={resolvedActiveDate} onValueChange={setActiveDate}>
                    <SelectTrigger id="active-date" className="mt-2 h-10 border-border/50 bg-input/40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {activeDates.map((value) => (
                        <SelectItem key={value} value={value}>
                          {formatDateValue(value, dateLocale)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardHeader>
          </Card>

          <BookingScheduleGrid rooms={rooms} bookings={activeDateBookings} t={t} onEdit={openEditDialog} />
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card className="border-border/40">
            <CardHeader className="gap-3">
              <CardTitle className="text-lg font-semibold">{t('История бронирований')}</CardTitle>
              <CardDescription>{t('Здесь находятся завершённые и отменённые брони.')}</CardDescription>
              {historyDates.length > 0 && (
                <div className="max-w-[320px]">
                  <Label htmlFor="history-date">{t('Дата')}</Label>
                  <Select value={resolvedHistoryDate} onValueChange={setHistoryDate}>
                    <SelectTrigger id="history-date" className="mt-2 h-10 border-border/50 bg-input/40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {historyDates.map((value) => (
                        <SelectItem key={value} value={value}>
                          {formatDateValue(value, dateLocale)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardHeader>
          </Card>

          <BookingScheduleGrid rooms={rooms} bookings={historyDateBookings} t={t} />
        </TabsContent>
      </Tabs>

      <Dialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          if (!open) resetEditDialog();
          else setEditDialogOpen(true);
        }}
      >
        <DialogContent className="border-border/50">
          <DialogHeader>
            <DialogTitle>{t('Редактирование брони')}</DialogTitle>
            <DialogDescription>
              {editDate ? t('Дата: {value}', { value: formatDateValue(editDate, dateLocale) }) : t('Обновите параметры бронирования')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {editError && (
              <Alert variant="destructive">
                <AlertDescription>{editError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="edit-room">{t('Комната')}</Label>
              <Select value={editRoomId} onValueChange={setEditRoomId}>
                <SelectTrigger id="edit-room" className="h-10 border-border/50 bg-input/40">
                  <SelectValue placeholder={t('Выберите комнату')} />
                </SelectTrigger>
                <SelectContent>
                  {rooms.map((room) => (
                    <SelectItem key={room.id} value={room.id}>
                      {room.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-date-input">{t('Дата')}</Label>
              <Input
                id="edit-date-input"
                type="date"
                value={editDate}
                onChange={(event) => setEditDate(event.target.value)}
                className="h-10 border-border/50 bg-input/40"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-start">{t('Начало')}</Label>
                <Input
                  id="edit-start"
                  type="time"
                  step={EDIT_SLOT_STEP_SECONDS}
                  value={editStartTime}
                  onChange={(event) => setEditStartTime(event.target.value)}
                  className="h-10 border-border/50 bg-input/40"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-end">{t('Окончание')}</Label>
                <Input
                  id="edit-end"
                  type="time"
                  step={EDIT_SLOT_STEP_SECONDS}
                  value={editEndTime}
                  onChange={(event) => setEditEndTime(event.target.value)}
                  className="h-10 border-border/50 bg-input/40"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-status">{t('Статус')}</Label>
              <Select value={editStatus} onValueChange={(value: 'active' | 'cancelled') => setEditStatus(value)}>
                <SelectTrigger id="edit-status" className="h-10 border-border/50 bg-input/40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{t('Активно')}</SelectItem>
                  <SelectItem value="cancelled">{t('Отменено')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={resetEditDialog} className="border-border/50" disabled={isSaving}>
              {t('Отмена')}
            </Button>
            <Button type="button" onClick={handleSaveEdit} disabled={isSaving}>
              {isSaving ? t('Сохранение…') : t('Сохранить изменения')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
