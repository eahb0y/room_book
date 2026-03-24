import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { addDays, format, isBefore, startOfToday } from 'date-fns';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MapPin,
  Sparkles,
  UserRound,
  Users,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useVenueStore } from '@/store/venueStore';
import { getBusinessServiceById, listBusinessServiceCategories } from '@/lib/serviceApi';
import { listServiceBookingBusySlots } from '@/lib/serviceBookingApi';
import { listVenues } from '@/lib/venueApi';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { BusinessService, BusinessServiceCategory, Venue } from '@/types';
import { useI18n } from '@/i18n/useI18n';

const SLOT_STEP_MINUTES = 15;
const MINUTES_IN_DAY = 24 * 60;
const SLOT_START_MINUTES = Array.from({ length: MINUTES_IN_DAY / SLOT_STEP_MINUTES }, (_, index) => index * SLOT_STEP_MINUTES);

const toMinutes = (time: string) => {
  if (time === '24:00') return MINUTES_IN_DAY;
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

const toDurationLabel = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  if (hours > 0 && restMinutes > 0) return `${hours}ч ${restMinutes}м`;
  if (hours > 0) return `${hours}ч`;
  return `${restMinutes}м`;
};

const buildServiceCoverPhoto = (service: BusinessService) =>
  service.photoUrl ?? service.providers.find((provider) => provider.photoUrl)?.photoUrl ?? null;

const isOverlapping = (startA: string, endA: string, startB: string, endB: string) =>
  startA < endB && endA > startB;

interface ServicePageState {
  requestKey: string | null;
  service: BusinessService | null;
  venue: Venue | null;
  categories: BusinessServiceCategory[];
  pageError: string;
}

export default function ServiceBookingPage() {
  const { t, dateLocale, intlLocale } = useI18n();
  const { serviceId } = useParams<{ serviceId: string }>();
  const { user, isAuthenticated } = useAuthStore();
  const createServiceBooking = useVenueStore((state) => state.createServiceBooking);
  const navigate = useNavigate();
  const location = useLocation();

  const [serviceState, setServiceState] = useState<ServicePageState>({
    requestKey: null,
    service: null,
    venue: null,
    categories: [],
    pageError: '',
  });
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [date, setDate] = useState<Date>(startOfToday());
  const [currentTimeMarker, setCurrentTimeMarker] = useState(() => Date.now());
  const [busySlots, setBusySlots] = useState<Array<{ startTime: string; endTime: string }>>([]);
  const [isBusySlotsLoading, setIsBusySlotsLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState('');
  const [selectedStartTime, setSelectedStartTime] = useState('');
  const [bookingError, setBookingError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetBookingSelection = () => {
    setSelectedStartTime('');
    setBookingError('');
    setSuccessMessage('');
  };

  useEffect(() => {
    if (!serviceId) return;

    let isActive = true;

    void (async () => {
      try {
        const service = await getBusinessServiceById(serviceId, { publicAccess: true });
        const [venueResult, categoriesResult] = await Promise.all([
          listVenues({ venueIds: [service.venueId], publicAccess: true }),
          listBusinessServiceCategories({ venueId: service.venueId, publicAccess: true }),
        ]);

        if (!isActive) return;

        setServiceState({
          requestKey: serviceId,
          service,
          venue: venueResult[0] ?? null,
          categories: categoriesResult,
          pageError: venueResult[0] ? '' : t('Заведение не найдено'),
        });
        setSelectedProviderId((current) =>
          service.providers.some((provider) => provider.id === current)
            ? current
            : service.providers[0]?.id || '',
        );
      } catch (error) {
        if (!isActive) return;

        setServiceState({
          requestKey: serviceId,
          service: null,
          venue: null,
          categories: [],
          pageError: error instanceof Error ? t(error.message) : t('Не удалось загрузить услугу'),
        });
      }
    })();

    return () => {
      isActive = false;
    };
  }, [serviceId, t]);

  const service = serviceState.service;
  const venue = serviceState.venue;
  const categories = serviceState.categories;
  const isLoading = serviceState.requestKey !== serviceId;
  const pageError = isLoading ? '' : serviceState.pageError;

  const selectedProvider = useMemo(
    () => service?.providers.find((provider) => provider.id === selectedProviderId) ?? null,
    [selectedProviderId, service],
  );

  useEffect(() => {
    if (!service || !selectedProvider || !serviceId) return;

    let isActive = true;
    void (async () => {
      setIsBusySlotsLoading(true);
      setAvailabilityError('');

      try {
        const result = await listServiceBookingBusySlots({
          serviceId,
          providerId: selectedProvider.id,
          bookingDate: format(date, 'yyyy-MM-dd'),
        });

        if (!isActive) return;
        setBusySlots(result);
      } catch (error) {
        if (!isActive) return;
        setBusySlots([]);
        setAvailabilityError(error instanceof Error ? t(error.message) : t('Не удалось загрузить доступные слоты'));
      } finally {
        if (isActive) setIsBusySlotsLoading(false);
      }
    })();

    return () => {
      isActive = false;
    };
  }, [date, selectedProvider, service, serviceId, t]);

  const categoryNameById = useMemo(
    () =>
      categories.reduce<Record<string, string>>((acc, category) => {
        acc[category.id] = category.name;
        return acc;
      }, {}),
    [categories],
  );

  const categoryName = service?.categoryId ? categoryNameById[service.categoryId] : '';
  const coverPhoto = service ? buildServiceCoverPhoto(service) : null;

  const priceLabel = useMemo(() => {
    if (!selectedProvider) return null;
    return `${new Intl.NumberFormat(intlLocale).format(selectedProvider.price)} ${t('сум')}`;
  }, [intlLocale, selectedProvider, t]);

  const workFrom = selectedProvider?.workFrom?.trim() || '00:00';
  const workTo = selectedProvider?.workTo?.trim() || '24:00';
  const durationMinutes = selectedProvider?.durationMinutes ?? 0;
  const availabilityStartMinutes = toMinutes(workFrom);
  const availabilityEndMinutes = toMinutes(workTo);
  const now = useMemo(() => new Date(currentTimeMarker), [currentTimeMarker]);
  const isSelectedDateToday = format(date, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd');
  const currentMinuteOfDay = now.getHours() * 60 + now.getMinutes();

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentTimeMarker(Date.now());
    }, 30_000);

    return () => window.clearInterval(timer);
  }, []);

  const availableStartTimes = useMemo(() => {
    if (!selectedProvider || durationMinutes <= 0 || isBefore(date, startOfToday())) return [];

    return SLOT_START_MINUTES
      .filter((minute) => minute >= availabilityStartMinutes)
      .filter((minute) => minute + durationMinutes <= availabilityEndMinutes)
      .filter((minute) => !isSelectedDateToday || minute >= currentMinuteOfDay)
      .filter((minute) => {
        const startTime = toTime(minute);
        const endTime = toTime(minute + durationMinutes);
        return !busySlots.some((slot) => isOverlapping(startTime, endTime, slot.startTime, slot.endTime));
      })
      .map((minute) => toTime(minute));
  }, [
    availabilityEndMinutes,
    availabilityStartMinutes,
    busySlots,
    currentMinuteOfDay,
    date,
    durationMinutes,
    isSelectedDateToday,
    selectedProvider,
  ]);

  useEffect(() => {
    if (!selectedStartTime) return;
    if (availableStartTimes.includes(selectedStartTime)) return;
    setSelectedStartTime('');
  }, [availableStartTimes, selectedStartTime]);

  const selectedEndTime = useMemo(() => {
    if (!selectedStartTime || !selectedProvider || durationMinutes <= 0) return '';
    return toTime(toMinutes(selectedStartTime) + durationMinutes);
  }, [durationMinutes, selectedProvider, selectedStartTime]);

  const dayTabs = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(date, index - 3)),
    [date],
  );

  const pickDate = (nextDate: Date) => {
    setDate(nextDate);
    resetBookingSelection();
  };

  const canGoToPreviousDay = !isBefore(addDays(date, -1), startOfToday());

  const handleBooking = async () => {
    setBookingError('');
    setSuccessMessage('');

    if (!serviceId || !selectedProvider || !selectedStartTime) {
      setBookingError(t('Сначала выберите специалиста и время'));
      return;
    }

    if (isSelectedDateToday && toMinutes(selectedStartTime) < currentMinuteOfDay) {
      setBookingError(t('Нельзя бронировать прошедшее время'));
      return;
    }

    if (!isAuthenticated || !user) {
      const nextPath = `${location.pathname}${location.search}`;
      navigate(`/login?next=${encodeURIComponent(nextPath)}`);
      return;
    }

    setIsSubmitting(true);
    const result = await createServiceBooking({
      serviceId,
      providerId: selectedProvider.id,
      userId: user.id,
      bookingDate: format(date, 'yyyy-MM-dd'),
      startTime: selectedStartTime,
    });
    setIsSubmitting(false);

    if (!result.success || !result.booking) {
      setBookingError(result.error ? t(result.error) : t('Не удалось создать бронирование услуги'));
      return;
    }

    setSuccessMessage(
      t('Бронь создана: {start} — {end}', {
        start: result.booking.startTime,
        end: result.booking.endTime,
      }),
    );
    setSelectedStartTime('');

    try {
      const refreshedBusySlots = await listServiceBookingBusySlots({
        serviceId,
        providerId: selectedProvider.id,
        bookingDate: format(date, 'yyyy-MM-dd'),
      });
      setBusySlots(refreshedBusySlots);
    } catch (error) {
      setAvailabilityError(error instanceof Error ? t(error.message) : t('Не удалось обновить занятые слоты'));
    }
  };

  if (!serviceId) return null;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card className="h-72 animate-pulse border-border/40 bg-card/40" />
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_380px]">
          <Card className="h-96 animate-pulse border-border/40 bg-card/40" />
          <Card className="h-96 animate-pulse border-border/40 bg-card/40" />
        </div>
      </div>
    );
  }

  if (!service || !venue) {
    return (
      <Card className="border-border/40">
        <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
          <Sparkles className="h-10 w-10 text-muted-foreground/35" />
          <div className="space-y-2">
            <p className="text-base font-medium text-foreground">{pageError || t('Услуга не найдена')}</p>
            <p className="text-sm text-muted-foreground">{t('Попробуйте вернуться в каталог и выбрать другую услугу.')}</p>
          </div>
          <Button asChild variant="outline" className="border-border/50">
            <Link to="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('Вернуться в каталог')}
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2 text-sm">
        <Link to="/" className="text-muted-foreground transition-colors hover:text-primary">{t('Заведения')}</Link>
        <span className="text-muted-foreground/40">/</span>
        <Link to={`/venue/${venue.id}`} className="text-muted-foreground transition-colors hover:text-primary">{venue.name}</Link>
        <span className="text-muted-foreground/40">/</span>
        <span className="text-foreground/90">{service.name}</span>
      </div>

      <section className="relative overflow-hidden rounded-[2.2rem] border border-border/55 bg-card/80 shadow-[0_24px_60px_-34px_rgba(15,23,42,0.22)]">
        <div className="absolute inset-0">
          {coverPhoto ? (
            <img src={coverPhoto} alt={service.name} className="h-full w-full object-cover opacity-85" />
          ) : (
            <div className="marketplace-service-photo-fallback h-full w-full" />
          )}
        </div>
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(244,247,251,0.92),rgba(244,247,251,0.58)_45%,rgba(255,255,255,0.18))] dark:bg-[linear-gradient(135deg,rgba(8,8,12,0.84),rgba(8,8,12,0.48)_45%,rgba(8,8,12,0.82))]" />

        <div className="relative grid gap-6 p-6 sm:p-8 lg:grid-cols-[minmax(0,1.2fr)_320px] lg:p-9">
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              {categoryName ? (
                <Badge className="border border-white/50 bg-white/75 text-slate-900 backdrop-blur-md hover:bg-white/75 dark:border-white/15 dark:bg-black/45 dark:text-white dark:hover:bg-black/45">
                  <Sparkles className="mr-1.5 h-3 w-3" />
                  {categoryName}
                </Badge>
              ) : null}
              <Badge variant="outline" className="border-white/45 bg-white/72 text-slate-900 backdrop-blur-md dark:border-white/20 dark:bg-black/20 dark:text-white">
                <Users className="mr-1.5 h-3 w-3" />
                {t('{count} специалистов', { count: service.providers.length })}
              </Badge>
            </div>

            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.18em] text-foreground/55 dark:text-white/55">{venue.name}</p>
              <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-foreground sm:text-5xl dark:text-white">
                {service.name}
              </h1>
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground dark:text-white/75">
                <p className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  <span>{venue.address}</span>
                </p>
                <p className="flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-primary" />
                  <span>{t('Фиксированный формат {duration}', { duration: toDurationLabel(durationMinutes || 0) })}</span>
                </p>
                {priceLabel ? (
                  <p className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    <span>{t('От {price}', { price: priceLabel })}</span>
                  </p>
                ) : null}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-[1.6rem] border border-border/60 bg-background/82 p-4 shadow-[0_18px_40px_-34px_rgba(18,44,87,0.28)] dark:bg-white/[0.03] dark:shadow-none">
                <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{t('Цена')}</p>
                <p className="mt-2 text-lg font-semibold text-foreground">{priceLabel ?? '—'}</p>
              </div>
              <div className="rounded-[1.6rem] border border-border/60 bg-background/82 p-4 shadow-[0_18px_40px_-34px_rgba(18,44,87,0.28)] dark:bg-white/[0.03] dark:shadow-none">
                <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{t('Длительность')}</p>
                <p className="mt-2 text-lg font-semibold text-foreground">{durationMinutes > 0 ? toDurationLabel(durationMinutes) : '—'}</p>
              </div>
              <div className="rounded-[1.6rem] border border-border/60 bg-background/82 p-4 shadow-[0_18px_40px_-34px_rgba(18,44,87,0.28)] dark:bg-white/[0.03] dark:shadow-none">
                <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{t('Команда')}</p>
                <p className="mt-2 text-lg font-semibold text-foreground">{service.providers.length}</p>
              </div>
            </div>
          </div>

          <Card className="border-border/55 bg-background/72 shadow-[0_24px_50px_-34px_rgba(18,44,87,0.28)] backdrop-blur-xl dark:bg-black/30">
            <CardHeader className="space-y-3">
              <CardTitle className="text-xl font-semibold font-body">{t('Бронирование услуги')}</CardTitle>
              <CardDescription>
                {isAuthenticated
                  ? t('Выберите специалиста, день и свободное время.')
                  : t('Сначала посмотрите детали услуги, затем войдите для подтверждения брони.')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button asChild variant="outline" className="w-full border-border/55">
                <Link to={`/venue/${venue.id}`}>
                  {t('Открыть заведение')}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              {!isAuthenticated ? (
                <Button
                  className="w-full"
                  onClick={() => {
                    const nextPath = `${location.pathname}${location.search}`;
                    navigate(`/login?next=${encodeURIComponent(nextPath)}`);
                  }}
                >
                  {t('Войти и забронировать')}
                </Button>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </section>

      <div className="space-y-6">
        <Card className="border-border/45">
          <CardHeader>
            <CardTitle>{t('Выберите специалиста')}</CardTitle>
            <CardDescription>{t('Бронирование строится на параметрах выбранного специалиста: цена, длительность и график.')}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {service.providers.map((provider) => {
              const isSelected = provider.id === selectedProviderId;
              const providerPriceLabel = `${new Intl.NumberFormat(intlLocale).format(provider.price)} ${t('сум')}`;
              const providerWorkLabel = `${provider.workFrom?.trim() || '00:00'} - ${provider.workTo?.trim() || '24:00'}`;

              return (
                <button
                  key={provider.id}
                  type="button"
                  onClick={() => {
                    setSelectedProviderId(provider.id);
                    resetBookingSelection();
                  }}
                  className={cn(
                    'rounded-[1.6rem] border p-4 text-left transition-all duration-300',
                    isSelected
                      ? 'border-primary/45 bg-primary/[0.08] shadow-[0_18px_36px_-28px_hsl(var(--primary)/0.55)]'
                      : 'border-border/55 bg-card/60 hover:border-primary/25 hover:bg-background/80',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border/40 bg-muted/35">
                      {provider.photoUrl ? (
                        <img src={provider.photoUrl} alt={provider.name} className="h-full w-full object-cover" />
                      ) : (
                        <UserRound className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-foreground">{provider.name}</p>
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
                        <span className="truncate">{provider.location || venue.address}</span>
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-border/60 bg-background/80 p-3">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{t('Цена')}</p>
                      <p className="mt-2 text-sm font-medium text-foreground">{providerPriceLabel}</p>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-background/80 p-3">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{t('Формат')}</p>
                      <p className="mt-2 text-sm font-medium text-foreground">{toDurationLabel(provider.durationMinutes)}</p>
                    </div>
                  </div>

                  <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock3 className="h-4 w-4 text-primary" />
                    <span>{t('График: {hours}', { hours: providerWorkLabel })}</span>
                  </p>
                </button>
              );
            })}
          </CardContent>
        </Card>

        <Card className="border-border/45">
          <CardHeader className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>{t('Выберите день')}</CardTitle>
                <CardDescription>
                  {selectedProvider
                    ? t('Выберите дату в календаре и свободный слот специалиста на {duration}', {
                      duration: toDurationLabel(selectedProvider.durationMinutes),
                    })
                    : t('Сначала выберите специалиста')}
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
                    <Button variant="outline" className="h-9 border-border/55 sm:w-auto">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(date, 'd MMM yyyy', { locale: dateLocale })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-auto border-border/50 p-0">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={(nextDate) => {
                        if (!nextDate) return;
                        pickDate(nextDate);
                      }}
                      locale={dateLocale}
                      disabled={(day) => isBefore(day, startOfToday())}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
              {dayTabs.map((day) => {
                const isSelected = format(day, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd');
                const isDisabled = isBefore(day, startOfToday());
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => {
                      if (isDisabled) return;
                      pickDate(day);
                    }}
                    disabled={isDisabled}
                    className={cn(
                      'rounded-lg border px-2 py-2 text-left transition-all',
                      isSelected
                        ? 'border-primary/70 bg-primary/12 text-foreground'
                        : 'border-border/50 bg-muted/20 text-muted-foreground hover:border-primary/30 hover:text-foreground',
                      isDisabled && 'cursor-not-allowed opacity-40',
                    )}
                  >
                    <p className="text-[11px] uppercase tracking-wide">{format(day, 'EEE', { locale: dateLocale })}</p>
                    <p className="mt-1 text-sm font-semibold">{format(day, 'd MMM', { locale: dateLocale })}</p>
                  </button>
                );
              })}
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {availabilityError ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{availabilityError}</AlertDescription>
              </Alert>
            ) : null}

            {selectedProvider ? (
              <div className="rounded-[1.5rem] border border-border/55 bg-muted/15 p-4">
                <p className="text-sm font-medium text-foreground">{selectedProvider.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t('Рабочее время: {from} - {to}', { from: workFrom, to: workTo })}
                </p>
              </div>
            ) : null}

            {isBusySlotsLoading ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {Array.from({ length: 8 }).map((_, index) => (
                  <div key={index} className="h-12 animate-pulse rounded-2xl border border-border/45 bg-card/55" />
                ))}
              </div>
            ) : availableStartTimes.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {availableStartTimes.map((slot) => {
                  const endTime = toTime(toMinutes(slot) + durationMinutes);
                  const isSelected = selectedStartTime === slot;

                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setSelectedStartTime(slot)}
                      className={cn(
                        'rounded-2xl border px-4 py-3 text-left transition-all',
                        isSelected
                          ? 'border-primary/45 bg-primary/[0.08] text-foreground shadow-[0_18px_36px_-28px_hsl(var(--primary)/0.55)]'
                          : 'border-border/55 bg-card/55 hover:border-primary/25 hover:bg-background/80',
                      )}
                    >
                      <p className="text-sm font-semibold">{slot}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{endTime}</p>
                    </button>
                  );
                })}
              </div>
            ) : (
              <Card className="border-dashed border-border/50 bg-background/35 shadow-none">
                <CardContent className="py-8 text-sm text-muted-foreground">
                  {selectedProvider
                    ? t('На выбранный день свободных слотов нет')
                    : t('Сначала выберите специалиста')}
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>

        <Card className="border-primary/25 bg-gradient-to-br from-primary/[0.06] via-background/90 to-background/90">
          <CardHeader>
            <CardTitle>{t('Подтверждение бронирования')}</CardTitle>
            <CardDescription>{t('Проверьте выбранные данные и подтвердите бронирование')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {bookingError ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{bookingError}</AlertDescription>
              </Alert>
            ) : null}

            {successMessage ? (
              <Alert className="border-emerald-300/60 bg-emerald-50 text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>{successMessage}</AlertDescription>
              </Alert>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-border/55 bg-background/80 p-4">
                <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{t('Специалист')}</p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {selectedProvider ? selectedProvider.name : t('Не выбран')}
                </p>
              </div>
              <div className="rounded-2xl border border-border/55 bg-background/80 p-4">
                <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{t('Дата')}</p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {format(date, 'd MMMM yyyy', { locale: dateLocale })}
                </p>
              </div>
              <div className="rounded-2xl border border-border/55 bg-background/80 p-4">
                <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{t('Слот')}</p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {selectedStartTime && selectedEndTime
                    ? `${selectedStartTime} - ${selectedEndTime}`
                    : t('Не выбран')}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button asChild variant="outline" className="border-border/55">
                <Link to={`/venue/${venue.id}`}>
                  {t('Открыть заведение')}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                disabled={!selectedProvider || !selectedStartTime || !availableStartTimes.includes(selectedStartTime) || isSubmitting}
                onClick={() => void handleBooking()}
              >
                {isSubmitting
                  ? t('Создаём бронь...')
                  : isAuthenticated
                    ? t('Забронировать услугу')
                    : t('Войти и забронировать')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
