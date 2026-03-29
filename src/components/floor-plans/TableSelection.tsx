import { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Clock3, MapPin, Users, ZoomIn, ZoomOut } from 'lucide-react';
import './floor-plan.css';
import { listVenues } from '@/lib/venueApi';
import { DEFAULT_TABLE_BOOKING_DURATION_MINUTES, createVenueTableBooking, listAvailableVenueTables } from '@/lib/floorPlanApi';
import { addMinutesToTime, clampFloorPlanValue } from '@/lib/floorPlanLayout';
import { useAuthStore } from '@/store/authStore';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { AvailableVenueTable, Venue } from '@/types';

type FloorPlanAvailabilityGroup = {
  id: string;
  name: string;
  imagePath: string;
  width: number;
  height: number;
  tables: AvailableVenueTable[];
};

const TIME_OPTIONS = Array.from({ length: 32 }, (_, index) => {
  const totalMinutes = 8 * 60 + (index * 30);
  const hours = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
  const minutes = (totalMinutes % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}`;
});

const buildDateInputValue = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const groupTablesByFloorPlan = (tables: AvailableVenueTable[]) => {
  const groups = new Map<string, FloorPlanAvailabilityGroup>();

  tables.forEach((table) => {
    const existing = groups.get(table.floorPlanId);
    if (existing) {
      existing.tables.push(table);
      return;
    }

    groups.set(table.floorPlanId, {
      id: table.floorPlanId,
      name: table.floorPlanName,
      imagePath: table.floorPlanImagePath,
      width: table.floorPlanWidth,
      height: table.floorPlanHeight,
      tables: [table],
    });
  });

  return Array.from(groups.values());
};

const getTableStatusClassName = (table: AvailableVenueTable, selectedTableId: string) => {
  if (table.id === selectedTableId) return 'floor-plan-table--picked';
  if (!table.isAvailable) return 'floor-plan-table--busy';
  if (!table.isCapacityMatch) return 'floor-plan-table--insufficient';
  return 'floor-plan-table--available';
};

function FloorPlanMiniMap({
  floorPlan,
  selectedTable,
}: {
  floorPlan: FloorPlanAvailabilityGroup;
  selectedTable: AvailableVenueTable | null;
}) {
  return (
    <div className="floor-plan-minimap">
      <div className="floor-plan-minimap__frame" style={{ aspectRatio: `${floorPlan.width} / ${floorPlan.height}` }}>
        <img src={floorPlan.imagePath} alt="" className="floor-plan-image" />
        {(selectedTable ? [selectedTable] : []).map((table) => (
          <span
            key={table.id}
            className="floor-plan-minimap__marker"
            style={{
              left: `${table.xPosition}%`,
              top: `${table.yPosition}%`,
              width: `${Math.max(table.width, 6)}%`,
              height: `${Math.max(table.height, 6)}%`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function TableSelection({ venueId }: { venueId: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated } = useAuthStore();
  const pinchStateRef = useRef<{ distance: number; zoom: number } | null>(null);

  const [venue, setVenue] = useState<Venue | null>(null);
  const [bookingDate, setBookingDate] = useState(buildDateInputValue);
  const [startTime, setStartTime] = useState('19:00');
  const [guests, setGuests] = useState('2');
  const [availabilityGroups, setAvailabilityGroups] = useState<FloorPlanAvailabilityGroup[]>([]);
  const [activeFloorPlanId, setActiveFloorPlanId] = useState('');
  const [selectedTableId, setSelectedTableId] = useState('');
  const [zoom, setZoom] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [bookingError, setBookingError] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState('');
  const [bookingNotes, setBookingNotes] = useState('');
  const [isBookingDialogOpen, setIsBookingDialogOpen] = useState(false);
  const [isBooking, setIsBooking] = useState(false);

  const requestedGuests = Number.parseInt(guests, 10);
  const normalizedGuests = Number.isFinite(requestedGuests) && requestedGuests > 0 ? requestedGuests : 1;

  useEffect(() => {
    let isActive = true;

    void (async () => {
      const venues = await listVenues({ venueIds: [venueId], publicAccess: true }).catch(() => []);
      if (!isActive) return;
      setVenue(venues[0] ?? null);
    })();

    return () => {
      isActive = false;
    };
  }, [venueId]);

  useEffect(() => {
    let isActive = true;
    setIsLoading(true);
    setError('');

    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          const tables = await listAvailableVenueTables({
            venueId,
            bookingDate,
            startTime,
            guests: normalizedGuests,
            durationMinutes: DEFAULT_TABLE_BOOKING_DURATION_MINUTES,
            publicAccess: true,
          });

          if (!isActive) return;

          startTransition(() => {
            const grouped = groupTablesByFloorPlan(tables);
            setAvailabilityGroups(grouped);
            setActiveFloorPlanId((current) => (current && grouped.some((group) => group.id === current) ? current : grouped[0]?.id ?? ''));
            setSelectedTableId((current) => (current && tables.some((table) => table.id === current) ? current : ''));
          });
        } catch (loadError) {
          if (!isActive) return;
          setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить доступные столы');
        } finally {
          if (isActive) {
            setIsLoading(false);
          }
        }
      })();
    }, 250);

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
    };
  }, [bookingDate, normalizedGuests, startTime, venueId]);

  const activeFloorPlan = useMemo(
    () => availabilityGroups.find((group) => group.id === activeFloorPlanId) ?? availabilityGroups[0] ?? null,
    [activeFloorPlanId, availabilityGroups],
  );

  const selectedTable = useMemo(
    () => availabilityGroups.flatMap((group) => group.tables).find((table) => table.id === selectedTableId) ?? null,
    [availabilityGroups, selectedTableId],
  );

  const handleSelectTable = (table: AvailableVenueTable) => {
    if (!table.isAvailable || !table.isCapacityMatch) return;
    setSelectedTableId(table.id);
    setBookingError('');
    setBookingSuccess('');
  };

  const handleContinue = () => {
    if (!selectedTable) return;

    if (!isAuthenticated || !user) {
      const nextPath = `${location.pathname}${location.search}`;
      navigate(`/login?next=${encodeURIComponent(nextPath)}`);
      return;
    }

    setBookingNotes('');
    setBookingError('');
    setIsBookingDialogOpen(true);
  };

  const handleConfirmBooking = async () => {
    if (!selectedTable || !user) return;

    try {
      setIsBooking(true);
      setBookingError('');

      await createVenueTableBooking({
        venueTableId: selectedTable.id,
        userId: user.id,
        guestCount: normalizedGuests,
        bookingDate,
        startTime,
        endTime: addMinutesToTime(startTime, DEFAULT_TABLE_BOOKING_DURATION_MINUTES),
        notes: bookingNotes,
      });

      setBookingSuccess(`Стол ${selectedTable.tableNumber} забронирован на ${startTime}`);
      setIsBookingDialogOpen(false);
      setSelectedTableId('');

      const refreshed = await listAvailableVenueTables({
        venueId,
        bookingDate,
        startTime,
        guests: normalizedGuests,
        durationMinutes: DEFAULT_TABLE_BOOKING_DURATION_MINUTES,
        publicAccess: true,
      });

      startTransition(() => {
        const grouped = groupTablesByFloorPlan(refreshed);
        setAvailabilityGroups(grouped);
      });
    } catch (submitError) {
      setBookingError(submitError instanceof Error ? submitError.message : 'Не удалось завершить бронирование');
    } finally {
      setIsBooking(false);
    }
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 2) return;
    const [first, second] = Array.from(event.touches);
    const distance = Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
    pinchStateRef.current = { distance, zoom };
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 2 || !pinchStateRef.current) return;
    const [first, second] = Array.from(event.touches);
    const distance = Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
    const scale = distance / pinchStateRef.current.distance;
    const nextZoom = clampFloorPlanValue(pinchStateRef.current.zoom * scale, 1, 3);
    setZoom(nextZoom);
    if (event.cancelable) {
      event.preventDefault();
    }
  };

  const handleTouchEnd = () => {
    if (pinchStateRef.current && pinchStateRef.current.zoom !== zoom) {
      pinchStateRef.current = null;
      return;
    }

    pinchStateRef.current = null;
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          {venue ? `Выбор стола в ${venue.name}` : 'Выбор стола'}
        </h1>
        <p className="text-muted-foreground">
          Отметьте дату и время, посмотрите доступность на схеме и выберите подходящий стол.
        </p>
      </div>

      <Card className="border-border/40">
        <CardHeader>
          <CardTitle>Параметры бронирования</CardTitle>
          <CardDescription>Доступность столов пересчитывается автоматически с задержкой 250 мс.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="table-booking-date">Дата</Label>
            <Input
              id="table-booking-date"
              type="date"
              min={buildDateInputValue()}
              value={bookingDate}
              onChange={(event) => setBookingDate(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Время</Label>
            <Select value={startTime} onValueChange={setStartTime}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_OPTIONS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="table-booking-guests">Гостей</Label>
            <Input
              id="table-booking-guests"
              type="number"
              min={1}
              value={guests}
              onChange={(event) => setGuests(event.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {(error || bookingError || bookingSuccess) ? (
        <div className="space-y-2">
          {error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {bookingError ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{bookingError}</AlertDescription>
            </Alert>
          ) : null}
          {bookingSuccess ? (
            <Alert className="border-emerald-700/35 bg-emerald-950/20">
              <CheckCircle2 className="h-4 w-4 text-emerald-300" />
              <AlertDescription className="text-emerald-200">{bookingSuccess}</AlertDescription>
            </Alert>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <Card className="border-border/40">
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Схема столов</CardTitle>
                <CardDescription>Зелёные столы подходят по времени и вместимости, жёлтые свободны, но малы, красные заняты.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" size="icon" variant="outline" onClick={() => setZoom((current) => clampFloorPlanValue(current - 0.1, 1, 3))}>
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="w-14 text-center text-sm">{Math.round(zoom * 100)}%</span>
                <Button type="button" size="icon" variant="outline" onClick={() => setZoom((current) => clampFloorPlanValue(current + 0.1, 1, 3))}>
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {availabilityGroups.map((group) => (
                  <Button
                    key={group.id}
                    type="button"
                    variant={group.id === activeFloorPlan?.id ? 'default' : 'outline'}
                    onClick={() => setActiveFloorPlanId(group.id)}
                  >
                    {group.name}
                  </Button>
                ))}
              </div>

              {isLoading ? (
                <div className="h-[420px] animate-pulse rounded-3xl border border-border/50 bg-card/45" />
              ) : activeFloorPlan ? (
                <div className="space-y-4">
                  <div
                    className="floor-plan-shell"
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                  >
                    <div className="floor-plan-scroll">
                      <div className="floor-plan-viewport" style={{ transform: `scale(${zoom})` }}>
                        <div className="relative" style={{ aspectRatio: `${activeFloorPlan.width} / ${activeFloorPlan.height}` }}>
                          <img src={activeFloorPlan.imagePath} alt={activeFloorPlan.name} className="floor-plan-image" />
                          <div className="floor-plan-grid" />
                          {activeFloorPlan.tables.map((table) => (
                            <button
                              key={table.id}
                              type="button"
                              onClick={() => handleSelectTable(table)}
                              className={cn(
                                'floor-plan-table',
                                `floor-plan-table--${table.shape}`,
                                getTableStatusClassName(table, selectedTableId),
                                table.id === selectedTableId && 'floor-plan-table--selected',
                              )}
                              style={{
                                left: `${table.xPosition}%`,
                                top: `${table.yPosition}%`,
                                width: `${table.width}%`,
                                height: `${table.height}%`,
                              }}
                            >
                              <span className="floor-plan-table__number">{table.tableNumber}</span>
                              <span className="floor-plan-table__capacity">{table.capacity} мест</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl border border-border/50 bg-card/60 px-4 py-3 text-sm">
                      <p className="font-medium text-foreground">Свободен</p>
                      <p className="mt-1 text-muted-foreground">Подходит по количеству гостей</p>
                    </div>
                    <div className="rounded-2xl border border-border/50 bg-card/60 px-4 py-3 text-sm">
                      <p className="font-medium text-foreground">Занят</p>
                      <p className="mt-1 text-muted-foreground">На выбранное время уже есть бронь</p>
                    </div>
                    <div className="rounded-2xl border border-border/50 bg-card/60 px-4 py-3 text-sm">
                      <p className="font-medium text-foreground">Недостаточно мест</p>
                      <p className="mt-1 text-muted-foreground">Стол свободен, но не вмещает всех гостей</p>
                    </div>
                    <div className="rounded-2xl border border-border/50 bg-card/60 px-4 py-3 text-sm">
                      <p className="font-medium text-foreground">Выбран</p>
                      <p className="mt-1 text-muted-foreground">Нажмите «Продолжить бронирование» для подтверждения</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border/55 px-4 py-16 text-center text-sm text-muted-foreground">
                  Для этого заведения ещё не опубликован план столов.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/40 md:hidden">
            <CardHeader>
              <CardTitle>Список столов</CardTitle>
              <CardDescription>На телефоне удобнее выбирать из карточек под планом.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(activeFloorPlan?.tables ?? []).map((table) => {
                const isSelectable = table.isAvailable && table.isCapacityMatch;

                return (
                  <div key={table.id} className="rounded-2xl border border-border/50 bg-card/55 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-foreground">Стол {table.tableNumber}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{table.capacity} мест</p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant={table.id === selectedTableId ? 'default' : 'outline'}
                        disabled={!isSelectable}
                        onClick={() => handleSelectTable(table)}
                      >
                        Выбрать
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-border/40">
            <CardHeader>
              <CardTitle>Ваш выбор</CardTitle>
              <CardDescription>Бронирование создаётся на стандартный слот в 2 часа.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedTable ? (
                <>
                  <div className="rounded-2xl border border-border/50 bg-card/60 p-4">
                    <p className="text-lg font-semibold text-foreground">Стол {selectedTable.tableNumber}</p>
                    <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                      <p className="inline-flex items-center gap-2"><Users className="h-4 w-4" />{selectedTable.capacity} мест</p>
                      <p className="inline-flex items-center gap-2"><Clock3 className="h-4 w-4" />{bookingDate} · {startTime} - {addMinutesToTime(startTime, DEFAULT_TABLE_BOOKING_DURATION_MINUTES)}</p>
                      {venue?.address ? <p className="inline-flex items-center gap-2"><MapPin className="h-4 w-4" />{venue.address}</p> : null}
                    </div>
                  </div>

                  {activeFloorPlan ? (
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-foreground">Расположение на мини-карте</p>
                      <FloorPlanMiniMap floorPlan={activeFloorPlan} selectedTable={selectedTable} />
                    </div>
                  ) : null}

                  <Button className="w-full" onClick={handleContinue}>
                    Продолжить бронирование
                  </Button>
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-border/55 px-4 py-10 text-center text-sm text-muted-foreground">
                  Выберите зелёный стол на плане или в списке ниже.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/40">
            <CardHeader>
              <CardTitle>Легенда</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>Зелёный: свободен и подходит по вместимости.</p>
              <p>Красный: уже занят на выбранный слот.</p>
              <p>Жёлтый: свободен, но для вашей компании мест недостаточно.</p>
              <p>Синий: выбранный стол.</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={isBookingDialogOpen} onOpenChange={setIsBookingDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Подтвердить бронирование</DialogTitle>
            <DialogDescription>
              {selectedTable ? `Стол ${selectedTable.tableNumber} будет забронирован на ${bookingDate} в ${startTime}.` : 'Проверьте данные бронирования.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-2xl border border-border/50 bg-card/55 p-4 text-sm text-muted-foreground">
              <p>Гостей: {normalizedGuests}</p>
              <p>Длительность: {DEFAULT_TABLE_BOOKING_DURATION_MINUTES} минут</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="table-booking-notes">Комментарий к брони</Label>
              <Textarea
                id="table-booking-notes"
                rows={4}
                value={bookingNotes}
                onChange={(event) => setBookingNotes(event.target.value)}
                placeholder="Например, детский стул или пожелание по посадке"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsBookingDialogOpen(false)}>
              Отмена
            </Button>
            <Button type="button" onClick={() => void handleConfirmBooking()} disabled={isBooking}>
              {isBooking ? 'Бронирую...' : 'Подтвердить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
