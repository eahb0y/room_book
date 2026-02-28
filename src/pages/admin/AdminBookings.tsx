import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useVenueStore } from '@/store/venueStore';
import { useVenueDataGuard } from '@/hooks/useVenueDataGuard';
import { listInvitations } from '@/lib/inviteApi';
import { listMemberships } from '@/lib/membershipApi';
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
import { Textarea } from '@/components/ui/textarea';
import { addDays, format, isBefore, parseISO, startOfToday, type Locale } from 'date-fns';
import { CheckCircle2, History, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n/useI18n';
import { getBookingViewStatus, type BookingViewStatus } from '@/lib/bookingStatus';
import type { Invitation, VenueMembership } from '@/types';

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

const toDurationLabel = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  if (hours > 0 && restMinutes > 0) return `${hours}ч ${restMinutes}м`;
  if (hours > 0) return `${hours}ч`;
  return `${restMinutes}м`;
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

const buildFutureDateOptions = (selectedValue: string, count = 10) => {
  const today = startOfToday();
  const parsed = parseISO(selectedValue);
  const selectedDate = Number.isNaN(parsed.getTime()) ? today : parsed;
  const anchor = isBefore(selectedDate, today) ? today : selectedDate;
  const candidateStart = addDays(anchor, -3);
  const startDate = isBefore(candidateStart, today) ? today : candidateStart;

  return Array.from({ length: count }, (_, index) => format(addDays(startDate, index), 'yyyy-MM-dd'));
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
  description?: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  startMinutes: number;
  endMinutes: number;
  status: 'active' | 'cancelled';
  viewStatus: BookingViewStatus;
};

type AdminRoom = {
  id: string;
  name: string;
  venueId: string;
  accessType: 'public' | 'residents_only';
  availableFrom: string;
  availableTo: string;
  minBookingMinutes: number;
  maxBookingMinutes: number;
};

type BookerOption = {
  userId: string;
  label: string;
  kind: 'self' | 'resident' | 'previous';
};

function HorizontalDayScroller({
  value,
  dates,
  dateLocale,
  onChange,
}: {
  value: string;
  dates: string[];
  dateLocale: Locale;
  onChange: (value: string) => void;
}) {
  return (
    <ScrollArea className="w-full whitespace-nowrap rounded-xl">
      <div className="flex gap-2 pb-2">
        {dates.map((dateValue) => {
          const isSelected = dateValue === value;

          return (
            <button
              key={dateValue}
              type="button"
              onClick={() => onChange(dateValue)}
              className={cn(
                'min-w-[104px] rounded-xl border px-3 py-3 text-left transition-colors',
                isSelected
                  ? 'border-primary/60 bg-primary/10 text-primary'
                  : 'border-border/40 bg-muted/15 text-foreground hover:border-border/70 hover:bg-muted/25',
              )}
            >
              <p className={cn('text-[11px] uppercase tracking-[0.18em]', isSelected ? 'text-primary/80' : 'text-muted-foreground')}>
                {format(parseISO(dateValue), 'EEE', { locale: dateLocale })}
              </p>
              <p className="mt-1 text-sm font-medium">
                {format(parseISO(dateValue), 'd MMM', { locale: dateLocale })}
              </p>
            </button>
          );
        })}
      </div>
    </ScrollArea>
  );
}

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
  onCreateSlot,
}: {
  rooms: Array<{ id: string; name: string }>;
  bookings: BookingViewItem[];
  t: (value: string, params?: Record<string, string | number>) => string;
  onEdit?: (booking: BookingViewItem) => void;
  onCreateSlot?: (params: { roomId: string; slotStart: number }) => void;
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

  return (
    <Card className="border-border/40">
      <CardContent className="p-0">
        <ScrollArea className="w-full rounded-xl">
          <div className="min-w-[420px]">
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
                                    {booking.description ? (
                                      <p className="mt-1 break-words text-[10px] text-foreground/65" title={booking.description}>
                                        {booking.description}
                                      </p>
                                    ) : null}
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
                              onCreateSlot ? (
                                <button
                                  type="button"
                                  className="flex w-full items-center justify-center rounded-sm py-2 text-[11px] text-muted-foreground/30 transition-colors hover:bg-primary/10 hover:text-primary"
                                  onClick={() => onCreateSlot({ roomId: room.id, slotStart })}
                                  aria-label={t('Создать бронь')}
                                >
                                  +
                                </button>
                              ) : (
                                <span className="text-[11px] text-muted-foreground/30">·</span>
                              )
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
  const { user, portal } = useAuthStore();
  const { isVenueDataLoading } = useVenueDataGuard(user, 'admin');
  const navigate = useNavigate();
  const isBusinessPortal = portal === 'business' || user?.role === 'admin';

  const venues = useVenueStore((state) => state.venues);
  const allRooms = useVenueStore((state) => state.rooms);
  const allBookings = useVenueStore((state) => state.bookings);
  const createBooking = useVenueStore((state) => state.createBooking);
  const updateBooking = useVenueStore((state) => state.updateBooking);

  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [activeDate, setActiveDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [historyDate, setHistoryDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [residentMemberships, setResidentMemberships] = useState<VenueMembership[]>([]);
  const [residentInvitations, setResidentInvitations] = useState<Invitation[]>([]);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createUserId, setCreateUserId] = useState('');
  const [createDate, setCreateDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [createStartTime, setCreateStartTime] = useState('');
  const [createEndTime, setCreateEndTime] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createError, setCreateError] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingBookingId, setEditingBookingId] = useState<string | null>(null);
  const [editRoomId, setEditRoomId] = useState('');
  const [editUserId, setEditUserId] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editStatus, setEditStatus] = useState<'active' | 'cancelled'>('active');
  const [editError, setEditError] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const todayDate = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const ownedVenues = useMemo(() => venues.filter((venue) => venue.adminId === user?.id), [venues, user?.id]);
  const ownedVenueIds = useMemo(() => new Set(ownedVenues.map((venue) => venue.id)), [ownedVenues]);
  const venueNameById = useMemo(
    () => new Map(ownedVenues.map((venue) => [venue.id, venue.name])),
    [ownedVenues],
  );

  const rooms = useMemo<AdminRoom[]>(
    () =>
      allRooms
        .filter((room) => ownedVenueIds.has(room.venueId))
        .map((room) => ({
          id: room.id,
          name: room.name,
          venueId: room.venueId,
          accessType: room.accessType,
          availableFrom: room.availableFrom,
          availableTo: room.availableTo,
          minBookingMinutes: room.minBookingMinutes,
          maxBookingMinutes: room.maxBookingMinutes,
        }))
        .sort((first, second) => first.name.localeCompare(second.name)),
    [allRooms, ownedVenueIds],
  );

  const roomById = useMemo(() => new Map(rooms.map((room) => [room.id, room])), [rooms]);

  const resolvedSelectedRoomId = useMemo(
    () => (selectedRoomId && roomById.has(selectedRoomId) ? selectedRoomId : rooms[0]?.id ?? ''),
    [roomById, rooms, selectedRoomId],
  );

  const selectedRoom = useMemo(
    () => rooms.find((room) => room.id === resolvedSelectedRoomId),
    [resolvedSelectedRoomId, rooms],
  );

  const bookings = useMemo<BookingViewItem[]>(() => {
    const visibleRoomIds = new Set(rooms.map((room) => room.id));

    return allBookings
      .filter((booking) => visibleRoomIds.has(booking.roomId))
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
          description: booking.description,
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
  }, [allBookings, roomById, rooms, t]);

  const roomBookings = useMemo(
    () => bookings.filter((booking) => booking.roomId === resolvedSelectedRoomId),
    [bookings, resolvedSelectedRoomId],
  );

  const invitationById = useMemo(
    () => new Map(residentInvitations.map((invitation) => [invitation.id, invitation])),
    [residentInvitations],
  );

  const selfBookerOption = useMemo<BookerOption | null>(() => {
    if (!user) return null;

    const fullName = resolveUserName(user.firstName, user.lastName);
    const email = user.email?.trim();
    const label = fullName && email ? `${fullName} (${email})` : fullName || email || t('Пользователь');

    return {
      userId: user.id,
      label,
      kind: 'self',
    };
  }, [t, user]);

  const residentBookersByVenue = useMemo(() => {
    const map = new Map<string, BookerOption[]>();

    residentMemberships.forEach((membership) => {
      const invitation = membership.invitationId ? invitationById.get(membership.invitationId) : undefined;
      const fullName = [invitation?.inviteeFirstName, invitation?.inviteeLastName]
        .filter((value): value is string => Boolean(value && value.trim()))
        .join(' ')
        .trim();
      const email = invitation?.inviteeEmail?.trim();
      const fallbackName = t('Резидент #{id}', { id: membership.userId.slice(0, 8) });
      const label = fullName && email ? `${fullName} (${email})` : fullName || email || fallbackName;
      const venueEntries = map.get(membership.venueId) ?? [];

      venueEntries.push({
        userId: membership.userId,
        label,
        kind: 'resident',
      });

      map.set(membership.venueId, venueEntries);
    });

    return map;
  }, [invitationById, residentMemberships, t]);

  const previousBookersByVenue = useMemo(() => {
    const map = new Map<string, BookerOption[]>();

    bookings.forEach((booking) => {
      const room = roomById.get(booking.roomId);
      if (!room) return;

      const venueEntries = map.get(room.venueId) ?? [];
      venueEntries.push({
        userId: booking.userId,
        label: booking.userLabel,
        kind: 'previous',
      });
      map.set(room.venueId, venueEntries);
    });

    return map;
  }, [bookings, roomById]);

  const buildBookerOptions = useCallback((room: AdminRoom | undefined, currentBooking?: BookingViewItem | null) => {
    if (!room) return [] as BookerOption[];

    const options: BookerOption[] = [];
    if (selfBookerOption) options.push(selfBookerOption);
    options.push(...(residentBookersByVenue.get(room.venueId) ?? []));

    if (room.accessType === 'public') {
      options.push(...(previousBookersByVenue.get(room.venueId) ?? []));
    }

    if (currentBooking?.userId && currentBooking.userLabel) {
      options.push({
        userId: currentBooking.userId,
        label: currentBooking.userLabel,
        kind: 'previous',
      });
    }

    const priority: Record<BookerOption['kind'], number> = {
      self: 0,
      resident: 1,
      previous: 2,
    };

    const deduped = new Map<string, BookerOption>();
    options.forEach((option) => {
      const existing = deduped.get(option.userId);
      if (!existing || priority[option.kind] < priority[existing.kind]) {
        deduped.set(option.userId, option);
      }
    });

    return Array.from(deduped.values()).sort((first, second) => {
      const priorityDelta = priority[first.kind] - priority[second.kind];
      if (priorityDelta !== 0) return priorityDelta;
      return first.label.localeCompare(second.label);
    });
  }, [previousBookersByVenue, residentBookersByVenue, selfBookerOption]);

  const editingBooking = useMemo(
    () => (editingBookingId ? bookings.find((booking) => booking.id === editingBookingId) ?? null : null),
    [bookings, editingBookingId],
  );

  const createBookerOptions = useMemo(
    () => buildBookerOptions(selectedRoom),
    [buildBookerOptions, selectedRoom],
  );

  const editBookerOptions = useMemo(
    () => buildBookerOptions(editRoomId ? roomById.get(editRoomId) : undefined, editingBooking),
    [buildBookerOptions, editRoomId, editingBooking, roomById],
  );

  useEffect(() => {
    if (!user || !isBusinessPortal) {
      navigate('/');
      return;
    }

    if (isVenueDataLoading) return;

    if (ownedVenues.length === 0) {
      navigate('/profile');
    }
  }, [isVenueDataLoading, isBusinessPortal, navigate, ownedVenues.length, user]);

  useEffect(() => {
    if (isVenueDataLoading || ownedVenues.length === 0) return;

    let isCancelled = false;

    void Promise.all([
      Promise.all(ownedVenues.map((venue) => listMemberships({ venueId: venue.id }))),
      Promise.all(ownedVenues.map((venue) => listInvitations(venue.id))),
    ]).then(
      ([membershipsByVenue, invitationsByVenue]) => {
        if (isCancelled) return;

        const membershipMap = new Map<string, VenueMembership>();
        membershipsByVenue.flat().forEach((membership) => {
          membershipMap.set(membership.id, membership);
        });

        const invitationMap = new Map<string, Invitation>();
        invitationsByVenue.flat().forEach((invitation) => {
          invitationMap.set(invitation.id, invitation);
        });

        setResidentMemberships(Array.from(membershipMap.values()));
        setResidentInvitations(Array.from(invitationMap.values()));
      },
      () => {
        if (isCancelled) return;
        setResidentMemberships([]);
        setResidentInvitations([]);
      },
    );

    return () => {
      isCancelled = true;
    };
  }, [isVenueDataLoading, ownedVenues]);

  const activeBookings = useMemo(() => roomBookings.filter((booking) => booking.viewStatus === 'active'), [roomBookings]);
  const historyBookings = useMemo(() => roomBookings.filter((booking) => booking.viewStatus !== 'active'), [roomBookings]);

  const activeDates = useMemo(() => Array.from(new Set(activeBookings.map((booking) => booking.bookingDate))).sort(), [activeBookings]);

  const historyDates = useMemo(
    () => Array.from(new Set(historyBookings.map((booking) => booking.bookingDate))).sort((first, second) => second.localeCompare(first)),
    [historyBookings],
  );

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

  const activeDateOptions = useMemo(
    () => buildFutureDateOptions(resolvedActiveDate),
    [resolvedActiveDate],
  );

  const createDateOptions = useMemo(
    () => buildFutureDateOptions(createDate),
    [createDate],
  );

  const editDateOptions = useMemo(
    () => buildFutureDateOptions(editDate || todayDate),
    [editDate, todayDate],
  );

  const openCreateDialog = (room: AdminRoom, params?: { date?: string; startTime?: string }) => {
    setSelectedRoomId(room.id);
    setCreateUserId(user?.id ?? '');
    setCreateDate(params?.date ?? todayDate);
    setCreateStartTime(params?.startTime ?? '');
    setCreateEndTime(
      params?.startTime
        ? toTime(Math.min(toMinutes(params.startTime) + room.minBookingMinutes, MINUTES_IN_DAY))
        : '',
    );
    setCreateDescription('');
    setCreateError('');
    setCreateDialogOpen(true);
  };

  const resetCreateDialog = () => {
    setCreateDialogOpen(false);
    setCreateUserId('');
    setCreateDate(todayDate);
    setCreateStartTime('');
    setCreateEndTime('');
    setCreateDescription('');
    setCreateError('');
  };

  const openEditDialog = (booking: BookingViewItem) => {
    setEditingBookingId(booking.id);
    setEditRoomId(booking.roomId);
    setEditUserId(booking.userId);
    setEditDate(booking.bookingDate);
    setEditStartTime(booking.startTime);
    setEditEndTime(booking.endTime);
    setEditDescription(booking.description ?? '');
    setEditStatus(booking.status);
    setEditError('');
    setEditDialogOpen(true);
  };

  const resetEditDialog = () => {
    setEditDialogOpen(false);
    setEditingBookingId(null);
    setEditRoomId('');
    setEditUserId('');
    setEditDate('');
    setEditStartTime('');
    setEditEndTime('');
    setEditDescription('');
    setEditStatus('active');
    setEditError('');
  };

  const validateBookingTimeWindow = (room: AdminRoom, bookingDate: string, startTime: string, endTime: string) => {
    if (!bookingDate || !startTime || !endTime) {
      return t('Заполните все поля');
    }

    if (startTime >= endTime) {
      return t('Время окончания должно быть позже времени начала');
    }

    if (bookingDate < todayDate) {
      return t('Нельзя бронировать на прошедшую дату');
    }

    const startMinute = toMinutes(startTime);
    const endMinute = toMinutes(endTime);
    const availableFromMinutes = toMinutes(room.availableFrom);
    const availableToMinutes = toMinutes(room.availableTo);

    if (startMinute < availableFromMinutes || endMinute > availableToMinutes) {
      return t('Комната доступна только с {from} до {to}', { from: room.availableFrom, to: room.availableTo });
    }

    const durationMinutes = endMinute - startMinute;
    if (durationMinutes < room.minBookingMinutes) {
      return t('Минимальная длительность брони: {duration}', { duration: toDurationLabel(room.minBookingMinutes) });
    }

    if (durationMinutes > room.maxBookingMinutes) {
      return t('Максимальная длительность брони: {duration}', { duration: toDurationLabel(room.maxBookingMinutes) });
    }

    return '';
  };

  const handleCreateBooking = async () => {
    if (!selectedRoom || !user) return;

    setCreateError('');

    if (!createUserId) {
      setCreateError(t('Выберите человека'));
      return;
    }

    const validationError = validateBookingTimeWindow(selectedRoom, createDate, createStartTime, createEndTime);
    if (validationError) {
      setCreateError(validationError);
      return;
    }

    setIsCreating(true);
    const result = await createBooking({
      roomId: selectedRoom.id,
      userId: createUserId,
      description: createDescription,
      bookingDate: createDate,
      startTime: createStartTime,
      endTime: createEndTime,
    });
    setIsCreating(false);

    if (!result.success) {
      setCreateError(result.error ? t(result.error) : t('Произошла ошибка при бронировании'));
      return;
    }

    resetCreateDialog();
    setSaveMessage(t('Бронь создана: {start} — {end}', { start: createStartTime, end: createEndTime }));
    setTimeout(() => setSaveMessage(''), 3000);
  };

  const handleSaveEdit = async () => {
    if (!editingBookingId || !editRoomId) return;

    setEditError('');

    if (!editUserId) {
      setEditError(t('Выберите человека'));
      return;
    }

    const editingRoom = roomById.get(editRoomId);
    if (!editingRoom) {
      setEditError(t('Комната не найдена'));
      return;
    }

    if (editStatus !== 'cancelled') {
      const validationError = validateBookingTimeWindow(editingRoom, editDate, editStartTime, editEndTime);
      if (validationError) {
        setEditError(validationError);
        return;
      }
    }

    setIsSaving(true);
    const result = await updateBooking(editingBookingId, {
      userId: editUserId,
      description: editDescription,
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

  if (ownedVenues.length === 0) {
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
          {ownedVenues.length === 1
            ? t('Все бронирования в заведении «{venue}»', { venue: ownedVenues[0]?.name ?? '' })
            : t('Все бронирования по вашим заведениям')}
        </p>
      </div>

      {saveMessage && (
        <Alert className="border-emerald-800/40 bg-emerald-950/30 animate-scale-in">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <AlertDescription className="text-emerald-300">{saveMessage}</AlertDescription>
        </Alert>
      )}

      <Card className="border-border/40">
        <CardHeader className="gap-3">
          <CardTitle className="text-lg font-semibold">{t('Список комнат')}</CardTitle>
          <CardDescription>{t('Выберите комнату, затем добавляйте или редактируйте брони в этой комнате')}</CardDescription>
        </CardHeader>
        <CardContent>
          {rooms.length === 0 ? (
            <div className="rounded-xl border border-border/40 bg-muted/20 p-6 text-sm text-muted-foreground">
              {t('Сначала добавьте комнаты')}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {rooms.map((room) => {
                const venueName = venueNameById.get(room.venueId) ?? '';
                const isSelected = room.id === resolvedSelectedRoomId;

                return (
                  <button
                    type="button"
                    key={room.id}
                    onClick={() => setSelectedRoomId(room.id)}
                    className={cn(
                      'rounded-xl border px-4 py-3 text-left transition-colors',
                      isSelected
                        ? 'border-primary/60 bg-primary/10'
                        : 'border-border/40 bg-muted/15 hover:border-border/70 hover:bg-muted/25',
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-foreground">{room.name}</p>
                      {isSelected ? (
                        <Badge className="border-primary/40 bg-primary/20 text-primary">{t('Выбрана')}</Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{venueName}</p>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {!selectedRoom && (
        <Card className="border-border/40">
          <CardContent className="py-8 text-sm text-muted-foreground">
            {t('Выберите комнату в списке')}
          </CardContent>
        </Card>
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
          <div className="space-y-2">
            <Label htmlFor="active-date">{t('Дата')}</Label>
            <HorizontalDayScroller
              value={resolvedActiveDate}
              dates={activeDateOptions}
              dateLocale={dateLocale}
              onChange={setActiveDate}
            />
          </div>

          <BookingScheduleGrid
            rooms={selectedRoom ? [{ id: selectedRoom.id, name: selectedRoom.name }] : []}
            bookings={activeDateBookings}
            t={t}
            onEdit={openEditDialog}
            onCreateSlot={({ roomId, slotStart }) => {
              const room = roomById.get(roomId);
              if (!room) return;
              openCreateDialog(room, {
                date: resolvedActiveDate,
                startTime: toTime(slotStart),
              });
            }}
          />
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {historyDates.length > 0 ? (
            <div className="space-y-2">
              <Label htmlFor="history-date">{t('Дата')}</Label>
              <HorizontalDayScroller
                value={resolvedHistoryDate}
                dates={historyDates}
                dateLocale={dateLocale}
                onChange={setHistoryDate}
              />
            </div>
          ) : null}

          <BookingScheduleGrid
            rooms={selectedRoom ? [{ id: selectedRoom.id, name: selectedRoom.name }] : []}
            bookings={historyDateBookings}
            t={t}
          />
        </TabsContent>
      </Tabs>

      <Dialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          if (!open) resetCreateDialog();
          else setCreateDialogOpen(true);
        }}
      >
        <DialogContent className="border-border/50 sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>{t('Новая бронь')}</DialogTitle>
            <DialogDescription>
              {selectedRoom ? t('Комната: {room}', { room: selectedRoom.name }) : t('Выберите комнату для бронирования')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {createError && (
              <Alert variant="destructive">
                <AlertDescription>{createError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="create-user">{t('Кто бронирует')}</Label>
              <Select value={createUserId} onValueChange={setCreateUserId}>
                <SelectTrigger id="create-user" className="h-10 border-border/50 bg-input/40">
                  <SelectValue placeholder={t('Выберите человека')} />
                </SelectTrigger>
                <SelectContent>
                  {createBookerOptions.map((option) => (
                    <SelectItem key={option.userId} value={option.userId}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-date-input">{t('Дата')}</Label>
              <HorizontalDayScroller
                value={createDate}
                dates={createDateOptions}
                dateLocale={dateLocale}
                onChange={setCreateDate}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="create-start">{t('Начало')}</Label>
                <Input
                  id="create-start"
                  type="time"
                  step={EDIT_SLOT_STEP_SECONDS}
                  value={createStartTime}
                  onChange={(event) => setCreateStartTime(event.target.value)}
                  className="h-10 border-border/50 bg-input/40"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-end">{t('Окончание')}</Label>
                <Input
                  id="create-end"
                  type="time"
                  step={EDIT_SLOT_STEP_SECONDS}
                  value={createEndTime}
                  onChange={(event) => setCreateEndTime(event.target.value)}
                  className="h-10 border-border/50 bg-input/40"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-description">{t('Описание')}</Label>
              <Textarea
                id="create-description"
                value={createDescription}
                onChange={(event) => setCreateDescription(event.target.value)}
                className="min-h-24 resize-y border-border/50 bg-input/40"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={resetCreateDialog} className="border-border/50" disabled={isCreating}>
              {t('Отмена')}
            </Button>
            <Button type="button" onClick={handleCreateBooking} disabled={isCreating}>
              {isCreating ? t('Создание…') : t('Создать бронь')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          if (!open) resetEditDialog();
          else setEditDialogOpen(true);
        }}
      >
        <DialogContent className="border-border/50 sm:max-w-[640px]">
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
              <Label>{t('Комната')}</Label>
              <div className="h-10 rounded-md border border-border/50 bg-input/40 px-3 text-sm leading-[38px] text-foreground/90">
                {roomById.get(editRoomId)?.name ?? t('Комната')}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-user">{t('Кто бронирует')}</Label>
              <Select value={editUserId} onValueChange={setEditUserId}>
                <SelectTrigger id="edit-user" className="h-10 border-border/50 bg-input/40">
                  <SelectValue placeholder={t('Выберите человека')} />
                </SelectTrigger>
                <SelectContent>
                  {editBookerOptions.map((option) => (
                    <SelectItem key={option.userId} value={option.userId}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-date-input">{t('Дата')}</Label>
              <HorizontalDayScroller
                value={editDate}
                dates={editDateOptions}
                dateLocale={dateLocale}
                onChange={setEditDate}
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
              <Label htmlFor="edit-description">{t('Описание')}</Label>
              <Textarea
                id="edit-description"
                value={editDescription}
                onChange={(event) => setEditDescription(event.target.value)}
                className="min-h-24 resize-y border-border/50 bg-input/40"
              />
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
