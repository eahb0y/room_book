import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarClock,
  CheckCircle2,
  DoorOpen,
  ExternalLink,
  Globe,
  MapPin,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useVenueStore } from '@/store/venueStore';
import { RoomPhotoGallery } from '@/components/RoomPhotoGallery';
import { RoomAmenities } from '@/components/RoomAmenities';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getRoomPhotoUrls } from '@/lib/roomPhotos';
import { useI18n } from '@/i18n/useI18n';
import { hasBusinessAccess } from '@/lib/businessAccess';
import { listVenues } from '@/lib/venueApi';
import { listRooms } from '@/lib/roomApi';
import { listBusinessServiceCategories, listBusinessServices } from '@/lib/serviceApi';
import type { BusinessService, BusinessServiceCategory, Room, Venue } from '@/types';

const buildServiceCoverPhoto = (service: BusinessService) =>
  service.photoUrl ?? service.providers.find((provider) => provider.photoUrl)?.photoUrl ?? null;

const buildMapsLink = (address: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

const mergeUniqueById = <T extends { id: string }>(...collections: T[][]) => {
  const map = new Map<string, T>();

  collections.flat().forEach((item) => {
    map.set(item.id, item);
  });

  return Array.from(map.values());
};

interface PublicVenueState {
  requestKey: string | null;
  venue: Venue | null;
  rooms: Room[];
  services: BusinessService[];
  serviceCategories: BusinessServiceCategory[];
  pageError: string;
  serviceNotice: string;
}

export default function RoomList() {
  const { t, intlLocale } = useI18n();
  const { venueId } = useParams<{ venueId: string }>();
  const { user, isAuthenticated } = useAuthStore();

  const storedVenue = useVenueStore((state) => state.venues.find((venue) => venue.id === venueId));
  const memberships = useVenueStore((state) => state.memberships);
  const allRooms = useVenueStore((state) => state.rooms);

  const [publicVenueState, setPublicVenueState] = useState<PublicVenueState>({
    requestKey: null,
    venue: null,
    rooms: [],
    services: [],
    serviceCategories: [],
    pageError: '',
    serviceNotice: '',
  });

  useEffect(() => {
    if (!venueId) return;

    let isActive = true;

    void (async () => {
      const [venueResult, roomsResult, categoriesResult, servicesResult] = await Promise.allSettled([
        listVenues({ venueIds: [venueId], publicAccess: true }),
        listRooms({ venueId, publicAccess: true }),
        listBusinessServiceCategories({ venueId, publicAccess: true }),
        listBusinessServices({ venueId, publicAccess: true }),
      ]);

      if (!isActive) return;

      let nextVenue: Venue | null = null;
      let nextRooms: Room[] = [];
      let nextServiceCategories: BusinessServiceCategory[] = [];
      let nextServices: BusinessService[] = [];
      let nextPageError = '';
      let nextServiceNotice = '';

      if (venueResult.status === 'fulfilled') {
        nextVenue = venueResult.value[0] ?? null;
        if (!venueResult.value[0]) {
          nextPageError = t('Заведение не найдено');
        }
      } else {
        nextPageError = venueResult.reason instanceof Error ? t(venueResult.reason.message) : t('Не удалось загрузить каталог');
      }

      if (roomsResult.status === 'fulfilled') {
        nextRooms = roomsResult.value;
      } else {
        nextPageError =
          nextPageError ||
          (roomsResult.reason instanceof Error ? t(roomsResult.reason.message) : t('Не удалось загрузить каталог'));
      }

      if (categoriesResult.status === 'fulfilled') {
        nextServiceCategories = categoriesResult.value;
      }

      if (servicesResult.status === 'fulfilled') {
        nextServices = servicesResult.value;
      } else {
        nextServiceNotice =
          servicesResult.reason instanceof Error ? t(servicesResult.reason.message) : t('Не удалось загрузить сервисы');
      }

      setPublicVenueState({
        requestKey: venueId,
        venue: nextVenue,
        rooms: nextRooms,
        services: nextServices,
        serviceCategories: nextServiceCategories,
        pageError: nextPageError,
        serviceNotice: nextServiceNotice,
      });
    })();

    return () => {
      isActive = false;
    };
  }, [t, venueId]);

  const publicVenue = publicVenueState.venue;
  const publicRooms = publicVenueState.rooms;
  const services = publicVenueState.services;
  const serviceCategories = publicVenueState.serviceCategories;
  const isPublicLoading = publicVenueState.requestKey !== venueId;
  const pageError = isPublicLoading ? '' : publicVenueState.pageError;
  const serviceNotice = isPublicLoading ? '' : publicVenueState.serviceNotice;
  const venue = storedVenue ?? publicVenue;

  const hasResidentAccess = useMemo(() => {
    if (!user || !venue) return false;
    if (hasBusinessAccess(user) && (user.businessAccess.isOwner || user.businessAccess.venueId === venue.id)) return true;
    if (venue.adminId === user.id) return true;
    return memberships.some((membership) => membership.venueId === venue.id && membership.userId === user.id);
  }, [memberships, user, venue]);

  const storeRooms = useMemo(
    () =>
      allRooms.filter(
        (room) =>
          room.venueId === venueId &&
          (room.accessType === 'public' || hasResidentAccess),
      ),
    [allRooms, hasResidentAccess, venueId],
  );

  const rooms = useMemo(
    () => mergeUniqueById(publicRooms, storeRooms).sort((first, second) => first.name.localeCompare(second.name, intlLocale)),
    [intlLocale, publicRooms, storeRooms],
  );

  const categoryNameById = useMemo(
    () =>
      serviceCategories.reduce<Record<string, string>>((acc, category) => {
        acc[category.id] = category.name;
        return acc;
      }, {}),
    [serviceCategories],
  );

  const publicRoomCount = useMemo(
    () => rooms.filter((room) => room.accessType === 'public').length,
    [rooms],
  );

  const residentsOnlyRoomCount = useMemo(
    () => rooms.filter((room) => room.accessType === 'residents_only').length,
    [rooms],
  );

  const uniqueLocations = useMemo(() => {
    return Array.from(
      new Set(
        [
          ...rooms.map((room) => room.location.trim()),
          ...services.flatMap((service) => service.providers.map((provider) => provider.location.trim())),
        ].filter(Boolean),
      ),
    );
  }, [rooms, services]);

  const heroImage = useMemo(() => {
    const roomPhoto = rooms.flatMap((room) => getRoomPhotoUrls(room)).find(Boolean);
    if (roomPhoto) return roomPhoto;
    return services.map(buildServiceCoverPhoto).find(Boolean) ?? null;
  }, [rooms, services]);

  const exploreCards = useMemo(
    () => [
      t('Выберите комнату или услугу, посмотрите детали и перейдите к нужному слоту.'),
      t('Если для комнаты нужен доступ резидента, это будет видно до подтверждения.'),
      t('Адрес можно открыть в картах, а описание помогает быстро понять формат заведения.'),
    ],
    [t],
  );

  const resolveRoomLink = (roomId: string) =>
    isAuthenticated ? `/room/${roomId}` : `/login?next=${encodeURIComponent(`/room/${roomId}`)}`;

  const mapLink = venue ? buildMapsLink(venue.address) : '#';
  const isLoading = isPublicLoading && !venue;

  if (!venueId) {
    return (
      <Card className="border-border/40">
        <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
          <Building2 className="h-10 w-10 text-muted-foreground/35" />
          <div className="space-y-2">
            <p className="text-base font-medium text-foreground">{t('Заведение не найдено')}</p>
            <p className="text-sm text-muted-foreground">{t('Попробуйте вернуться в каталог и выбрать другое заведение.')}</p>
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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card className="h-72 animate-pulse border-border/40 bg-card/40" />
        <div className="grid gap-5 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={index} className="h-48 animate-pulse border-border/40 bg-card/40" />
          ))}
        </div>
      </div>
    );
  }

  if (!venue) {
    return (
      <Card className="border-border/40">
        <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
          <Building2 className="h-10 w-10 text-muted-foreground/35" />
          <div className="space-y-2">
            <p className="text-base font-medium text-foreground">{pageError || t('Заведение не найдено')}</p>
            <p className="text-sm text-muted-foreground">{t('Попробуйте вернуться в каталог и выбрать другое заведение.')}</p>
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
        <span className="text-foreground/80">{venue.name}</span>
      </div>

      <section className="relative overflow-hidden rounded-[2.2rem] border border-border/50 bg-[linear-gradient(145deg,rgba(17,17,21,0.96),rgba(10,10,14,0.98))] shadow-[0_22px_55px_-30px_rgba(0,0,0,0.85)]">
        <div className="absolute inset-0">
          {heroImage ? (
            <img src={heroImage} alt={venue.name} className="h-full w-full object-cover opacity-18" />
          ) : (
            <div className="h-full w-full bg-[radial-gradient(circle_at_0%_0%,rgba(204,88,51,0.22),transparent_38%),radial-gradient(circle_at_100%_0%,rgba(68,104,82,0.2),transparent_32%),linear-gradient(135deg,rgba(18,18,22,1),rgba(8,8,12,1))]" />
          )}
        </div>
        <div className="absolute inset-0 bg-[linear-gradient(140deg,rgba(8,8,12,0.84),rgba(8,8,12,0.45)_45%,rgba(8,8,12,0.86))]" />

        <div className="relative grid gap-6 p-6 sm:p-8 lg:grid-cols-[minmax(0,1.45fr)_340px] lg:p-9">
          <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/6 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/65">
                  <Building2 className="h-3.5 w-3.5" />
                  <span>{t('Информация о заведении')}</span>
                </div>
                <div className="flex items-start gap-4">
                  <div className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/18 text-primary sm:flex">
                    <Building2 className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl" style={{ fontFamily: '"Outfit", "Plus Jakarta Sans", sans-serif' }}>
                      {venue.name}
                    </h1>
                    <p className="mt-3 flex items-center gap-2 text-base text-white/78">
                      <MapPin className="h-4 w-4 shrink-0" />
                      <span>{venue.address}</span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="border-white/15 bg-white/6 px-3 py-1.5 text-sm text-white">
                  {t('Комнаты')} ({rooms.length})
                </Badge>
                <Badge variant="outline" className="border-white/15 bg-white/6 px-3 py-1.5 text-sm text-white">
                  {t('Услуги')} ({services.length})
                </Badge>
              </div>
            </div>

            <p className="max-w-3xl text-sm leading-7 text-white/74 sm:text-base">
              {venue.description || t('Описание заведения пока не добавлено.')}
            </p>

            <div className="flex flex-wrap gap-3">
              <Button asChild className="rounded-full bg-primary px-5 text-sm text-primary-foreground hover:bg-primary/90">
                <a href={mapLink} target="_blank" rel="noreferrer">
                  {t('Открыть на карте')}
                  <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
              <Button asChild variant="outline" className="rounded-full border-white/18 bg-white/6 px-5 text-sm text-white hover:bg-white/10 hover:text-white">
                <Link to="/">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  {t('Вернуться в каталог')}
                </Link>
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              {publicRoomCount > 0 ? (
                <Badge variant="outline" className="border-white/14 bg-transparent text-white/75">
                  <Globe className="mr-1.5 h-3.5 w-3.5" />
                  {t('Публичные комнаты')}: {publicRoomCount}
                </Badge>
              ) : null}
              {residentsOnlyRoomCount > 0 ? (
                <Badge variant="outline" className="border-white/14 bg-transparent text-white/75">
                  <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                  {t('Комнаты для резидентов')}: {residentsOnlyRoomCount}
                </Badge>
              ) : null}
              {uniqueLocations.length > 0 ? (
                <Badge variant="outline" className="border-white/14 bg-transparent text-white/75">
                  <MapPin className="mr-1.5 h-3.5 w-3.5" />
                  {t('Локаций')}: {uniqueLocations.length}
                </Badge>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <Card className="border-white/12 bg-white/6 text-white shadow-none">
              <CardContent className="p-5">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/52">{t('Комнаты')}</p>
                <p className="mt-3 text-3xl font-semibold">{rooms.length}</p>
                <p className="mt-2 text-sm text-white/64">{t('Доступные комнаты этого заведения')}</p>
              </CardContent>
            </Card>
            <Card className="border-white/12 bg-white/6 text-white shadow-none">
              <CardContent className="p-5">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/52">{t('Услуги')}</p>
                <p className="mt-3 text-3xl font-semibold">{services.length}</p>
                <p className="mt-2 text-sm text-white/64">{t('Что доступно внутри')}</p>
              </CardContent>
            </Card>
            <Card className="border-white/12 bg-white/6 text-white shadow-none">
              <CardContent className="p-5">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/52">{t('Локации внутри заведения')}</p>
                <p className="mt-3 text-3xl font-semibold">{uniqueLocations.length}</p>
                <p className="mt-2 text-sm text-white/64">{t('Где находится команда и комнаты')}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <Card className="border-border/45 bg-card/70 shadow-[0_18px_42px_-28px_rgba(0,0,0,0.8)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Building2 className="h-5 w-5 text-primary" />
              {t('О заведении')}
            </CardTitle>
            <CardDescription>{t('Адрес и ориентир для клиента')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-2xl border border-border/50 bg-background/40 p-4">
              <p className="text-sm leading-7 text-muted-foreground">
                {venue.description || t('Описание заведения пока не добавлено.')}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border/50 bg-background/35 p-4">
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{t('Где находится')}</p>
                <p className="mt-3 flex items-start gap-2 text-sm text-foreground/88">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{venue.address}</span>
                </p>
              </div>
              <div className="rounded-2xl border border-border/50 bg-background/35 p-4">
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{t('Что можно забронировать здесь')}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {rooms.length > 0 ? (
                    <Badge variant="secondary" className="text-xs">
                      <DoorOpen className="mr-1.5 h-3.5 w-3.5" />
                      {t('Комнаты')}
                    </Badge>
                  ) : null}
                  {services.length > 0 ? (
                    <Badge variant="secondary" className="text-xs">
                      <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                      {t('Услуги')}
                    </Badge>
                  ) : null}
                  {rooms.length === 0 && services.length === 0 ? (
                    <span className="text-sm text-muted-foreground">{t('Пока нет доступных вариантов')}</span>
                  ) : null}
                </div>
              </div>
            </div>

            {uniqueLocations.length > 0 ? (
              <div>
                <p className="mb-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{t('Локации внутри заведения')}</p>
                <div className="flex flex-wrap gap-2">
                  {uniqueLocations.slice(0, 8).map((location) => (
                    <Badge key={location} variant="outline" className="border-border/55 bg-background/35">
                      {location}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}

            {serviceCategories.length > 0 ? (
              <div>
                <p className="mb-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{t('Категории услуг')}</p>
                <div className="flex flex-wrap gap-2">
                  {serviceCategories.map((category) => (
                    <Badge key={category.id} variant="outline" className="border-border/55 bg-background/35">
                      {category.name}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-border/45 bg-card/70 shadow-[0_18px_42px_-28px_rgba(0,0,0,0.8)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <CalendarClock className="h-5 w-5 text-primary" />
              {t('Как проходит бронирование')}
            </CardTitle>
            <CardDescription>{t('Короткий сценарий для знакомства с площадкой')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {exploreCards.map((item, index) => (
              <div key={item} className="rounded-2xl border border-border/50 bg-background/35 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/12 text-xs font-semibold text-primary">
                    {index + 1}
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {item}
                  </p>
                </div>
              </div>
            ))}

            <div className="rounded-2xl border border-primary/25 bg-primary/8 p-4 text-sm text-foreground/85">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p>{t('Если вы ещё не вошли, заведение можно изучить сейчас, а авторизация понадобится только перед самой бронью.')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">{t('Комнаты')}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t('Доступные комнаты этого заведения')}</p>
          </div>
          <Badge variant="outline" className="border-border/55 bg-background/40 px-3 py-1.5 text-sm">
            {rooms.length}
          </Badge>
        </div>

        {rooms.length === 0 ? (
          <Card className="border-border/40 animate-fade-up">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <DoorOpen className="mb-4 h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">{t('В этом заведении пока нет комнат')}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {rooms.map((room, index) => {
              const roomPhotos = getRoomPhotoUrls(room);

              return (
                <Card
                  key={room.id}
                  className={`card-hover stagger-${Math.min(index + 1, 6)} overflow-hidden ${
                    room.accessType === 'residents_only'
                      ? 'border-primary/30 bg-[linear-gradient(180deg,rgba(48,31,17,0.32),rgba(18,18,22,0.96))] shadow-[0_18px_42px_-28px_rgba(214,138,62,0.4)]'
                      : 'border-border/45 bg-card/78'
                  }`}
                >
                  {roomPhotos.length > 0 ? (
                    <RoomPhotoGallery
                      photos={roomPhotos}
                      roomName={room.name}
                      imageContainerClassName="w-full aspect-[16/10] rounded-t-xl border-x-0 border-t-0 border-b border-border/40 bg-muted/30"
                    />
                  ) : (
                    <div className="aspect-[16/10] w-full bg-[radial-gradient(circle_at_0%_0%,rgba(204,88,51,0.22),transparent_35%),linear-gradient(140deg,rgba(24,24,28,1),rgba(10,10,12,1))]" />
                  )}

                  <CardHeader className={`pb-3 ${roomPhotos.length > 0 ? 'pt-4' : ''}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <CardTitle className="flex items-center gap-2.5 text-base">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                            <DoorOpen className="h-4 w-4 text-primary" />
                          </div>
                          <span className="truncate font-body font-semibold">{room.name}</span>
                        </CardTitle>
                        {room.location ? (
                          <p className="mt-2 flex items-center gap-1.5 pl-[42px] text-sm text-muted-foreground">
                            <MapPin className="h-3.5 w-3.5" />
                            <span>{room.location}</span>
                          </p>
                        ) : null}
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[11px] ${
                          room.accessType === 'residents_only'
                            ? 'border-primary/35 bg-primary/10 text-primary'
                            : 'border-border/55 bg-background/45'
                        }`}
                      >
                        {room.accessType === 'public' ? t('Публичная') : t('Только резиденты')}
                      </Badge>
                    </div>
                    <CardDescription className="pl-[42px]">
                      <Badge variant="secondary" className="mt-1 flex w-fit items-center gap-1.5 text-xs">
                        <Users className="h-3 w-3" />
                        <span>{t('до {count} человек', { count: room.capacity })}</span>
                      </Badge>
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4 pl-[42px]">
                    <p className="text-sm leading-6 text-muted-foreground">
                      {room.description || venue.description || t('Подробности доступны внутри карточки')}
                    </p>

                    {room.accessType === 'residents_only' ? (
                      <div className="rounded-2xl border border-primary/25 bg-primary/8 p-3 text-xs text-foreground/85">
                        <div className="flex items-start gap-2">
                          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          <p>{t('Эта комната доступна только резидентам заведения')}</p>
                        </div>
                      </div>
                    ) : null}

                    <RoomAmenities roomId={room.id} services={room.services} maxVisible={5} />

                    <Button asChild className="group/btn h-10 w-full">
                      <Link to={resolveRoomLink(room.id)} className="flex items-center justify-center gap-2">
                        <span>{isAuthenticated ? t('Забронировать') : t('Войти и забронировать')}</span>
                        <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-0.5" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">{t('Услуги')}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t('Что доступно внутри')}</p>
          </div>
          <Badge variant="outline" className="border-border/55 bg-background/40 px-3 py-1.5 text-sm">
            {services.length}
          </Badge>
        </div>

        {services.length === 0 ? (
          <Card className="border-border/40">
            <CardContent className="py-10 text-sm text-muted-foreground">
              {serviceNotice || t('В этом заведении пока нет публичных услуг')}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {services.map((service, index) => {
              const locations = Array.from(
                new Set(
                  service.providers
                    .map((provider) => provider.location.trim())
                    .filter(Boolean),
                ),
              );
              const coverPhoto = buildServiceCoverPhoto(service);
              const categoryName = service.categoryId ? categoryNameById[service.categoryId] : '';

              return (
                <Card key={service.id} className={`card-hover stagger-${Math.min(index + 1, 6)} overflow-hidden border-border/45 bg-[linear-gradient(180deg,rgba(22,22,26,0.96),rgba(12,12,16,0.98))] py-0`}>
                  <div className="relative h-48 overflow-hidden">
                    {coverPhoto ? (
                      <img src={coverPhoto} alt={service.name} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                    ) : (
                      <div className="h-full w-full bg-[radial-gradient(circle_at_0%_0%,rgba(204,88,51,0.24),transparent_34%),radial-gradient(circle_at_100%_0%,rgba(68,104,82,0.18),transparent_28%),linear-gradient(145deg,rgba(20,20,24,1),rgba(8,8,12,1))]" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-transparent" />

                    <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                      {categoryName ? (
                        <Badge className="border border-white/15 bg-black/45 text-white hover:bg-black/45">
                          <Sparkles className="mr-1.5 h-3 w-3" />
                          {categoryName}
                        </Badge>
                      ) : null}
                      <Badge variant="outline" className="border-white/20 bg-black/20 text-white">
                        <Users className="mr-1.5 h-3 w-3" />
                        {t('{count} специалистов', { count: service.providers.length })}
                      </Badge>
                    </div>

                    <div className="absolute bottom-4 left-4 right-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-white/55">{venue.name}</p>
                      <h3 className="mt-2 text-2xl font-semibold leading-tight text-white">{service.name}</h3>
                    </div>
                  </div>

                  <CardContent className="space-y-4 p-5">
                    <p className="flex items-start gap-2 text-sm text-muted-foreground">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span className="line-clamp-2">{locations.length > 0 ? locations.join(', ') : venue.address}</span>
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-border/60 bg-white/[0.03] p-3">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{t('Команда')}</p>
                        <p className="mt-2 text-sm font-medium text-foreground">{service.providers.length}</p>
                      </div>
                      <div className="rounded-2xl border border-border/60 bg-white/[0.03] p-3">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{t('Локаций')}</p>
                        <p className="mt-2 text-sm font-medium text-foreground">{locations.length || 1}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
