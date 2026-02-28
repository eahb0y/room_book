import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  CalendarClock,
  Clock3,
  Compass,
  DoorOpen,
  GraduationCap,
  MapPin,
  Search,
  Sparkles,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { listVenues } from '@/lib/venueApi';
import { listRooms } from '@/lib/roomApi';
import { getRoomPhotoUrls } from '@/lib/roomPhotos';
import { listBusinessServiceCategories, listBusinessServices } from '@/lib/serviceApi';
import type { BusinessService, BusinessServiceProvider, Room, Venue } from '@/types';
import { useAuthStore } from '@/store/authStore';
import { useI18n } from '@/i18n/useI18n';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import LanguageSwitcher from '@/components/LanguageSwitcher';

type CategoryId = 'all' | 'coworking' | 'beauty' | 'studio' | 'education' | 'health' | 'events' | 'other';

interface CategoryItem {
  id: CategoryId;
  label: string;
}

interface RoomCatalogCard {
  room: Room;
  venue: Venue;
  category: CategoryId;
  photo: string | null;
}

interface BusinessServiceCard {
  service: BusinessService;
  venue: Venue;
  categoryLabel: string;
  coverPhoto: string | null;
  providerCount: number;
  featuredProviders: BusinessServiceProvider[];
  locations: string[];
  priceLabel: string;
  durationLabel: string;
  searchText: string;
}

const categories: CategoryItem[] = [
  { id: 'all', label: 'Все категории' },
  { id: 'coworking', label: 'Коворкинги' },
  { id: 'beauty', label: 'Бьюти и сервисы' },
  { id: 'studio', label: 'Студии и креатив' },
  { id: 'education', label: 'Обучение' },
  { id: 'health', label: 'Здоровье и wellbeing' },
  { id: 'events', label: 'Ивенты' },
  { id: 'other', label: 'Другое' },
];

const categoryIcons: Record<CategoryId, LucideIcon> = {
  all: Compass,
  coworking: Building2,
  beauty: Sparkles,
  studio: CalendarClock,
  education: GraduationCap,
  health: Users,
  events: DoorOpen,
  other: MapPin,
};

const classifyCategory = (room: Room, venue?: Venue): CategoryId => {
  const source = `${room.name} ${venue?.name ?? ''} ${venue?.description ?? ''}`.toLowerCase();

  if (/cowork|коворкинг|офис|переговор|meeting/.test(source)) return 'coworking';
  if (/beauty|бьюти|barber|маникюр|салон|spa/.test(source)) return 'beauty';
  if (/studio|студ|photo|video|подкаст|record|музык/.test(source)) return 'studio';
  if (/school|class|класс|курс|обуч|лекци|семинар/.test(source)) return 'education';
  if (/health|wellness|clinic|мед|здоров|массаж|реабил/.test(source)) return 'health';
  if (/event|ивент|конферен|зал|hall|forum/.test(source)) return 'events';

  return 'other';
};

const normalizeText = (value: string) => value.trim().toLowerCase();

const buildCurrencyFormatter = (locale: string) =>
  new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
  });

const buildPriceLabel = (
  providers: BusinessServiceProvider[],
  locale: string,
  t: (value: string, params?: Record<string, string | number>) => string,
) => {
  const prices = providers
    .map((provider) => provider.price)
    .filter((value) => Number.isFinite(value) && value > 0);

  if (prices.length === 0) return t('Цена по запросу');

  const formatter = buildCurrencyFormatter(locale);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  if (minPrice === maxPrice) {
    return `${formatter.format(minPrice)} ${t('сум')}`;
  }

  return t('от {price} сум', { price: formatter.format(minPrice) });
};

const buildDurationLabel = (
  providers: BusinessServiceProvider[],
  t: (value: string, params?: Record<string, string | number>) => string,
) => {
  const durations = providers
    .map((provider) => provider.durationMinutes)
    .filter((value) => Number.isFinite(value) && value > 0);

  if (durations.length === 0) return t('Длительность уточняется');

  const minDuration = Math.min(...durations);
  const maxDuration = Math.max(...durations);

  if (minDuration === maxDuration) {
    return t('{count} мин', { count: minDuration });
  }

  return t('{from}-{to} мин', { from: minDuration, to: maxDuration });
};

const buildProviderFallback = (provider: BusinessServiceProvider) => {
  const source = provider.name.trim() || provider.location.trim() || 'S';
  return source.charAt(0).toUpperCase();
};

const buildProviderShift = (
  provider: BusinessServiceProvider,
  t: (value: string, params?: Record<string, string | number>) => string,
) => {
  if (!provider.workFrom || !provider.workTo) return t('График уточняется');
  return `${provider.workFrom} - ${provider.workTo}`;
};

const buildServiceCoverPhoto = (service: BusinessService) => {
  if (service.photoUrl) return service.photoUrl;
  const providerPhoto = service.providers.find((provider) => provider.photoUrl)?.photoUrl;
  return providerPhoto ?? null;
};

const mergeUniqueById = <T extends { id: string }>(...collections: T[][]) => {
  const map = new Map<string, T>();

  collections.flat().forEach((item) => {
    map.set(item.id, item);
  });

  return Array.from(map.values());
};

export default function Marketplace() {
  const { t, intlLocale } = useI18n();
  const { isAuthenticated, user, portal } = useAuthStore();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [services, setServices] = useState<BusinessService[]>([]);
  const [categoryNameById, setCategoryNameById] = useState<Record<string, string>>({});
  const [serviceNotice, setServiceNotice] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  useEffect(() => {
    let isActive = true;
    setIsLoading(true);
    setError('');
    setServiceNotice('');

    void (async () => {
      const [venuesResult, roomsResult, categoriesResult, servicesResult] = await Promise.allSettled([
        listVenues({ publicAccess: true }),
        listRooms({ publicAccess: true }),
        listBusinessServiceCategories({ publicAccess: true }),
        listBusinessServices({ publicAccess: true }),
      ]);

      if (!isActive) return;

      let resolvedCategories = categoriesResult.status === 'fulfilled' ? categoriesResult.value : [];
      let resolvedServices = servicesResult.status === 'fulfilled' ? servicesResult.value : [];

      if (isAuthenticated && (resolvedCategories.length === 0 || resolvedServices.length === 0)) {
        const [authCategoriesResult, authServicesResult] = await Promise.allSettled([
          resolvedCategories.length === 0 ? listBusinessServiceCategories() : Promise.resolve([]),
          resolvedServices.length === 0 ? listBusinessServices() : Promise.resolve([]),
        ]);

        if (!isActive) return;

        if (resolvedCategories.length === 0 && authCategoriesResult.status === 'fulfilled') {
          resolvedCategories = mergeUniqueById(resolvedCategories, authCategoriesResult.value);
        }

        if (resolvedServices.length === 0 && authServicesResult.status === 'fulfilled') {
          resolvedServices = mergeUniqueById(resolvedServices, authServicesResult.value);
        }
      }

      if (venuesResult.status === 'fulfilled') {
        setVenues(venuesResult.value);
      } else {
        const message = venuesResult.reason instanceof Error ? venuesResult.reason.message : t('Не удалось загрузить каталог');
        setError(t(message));
      }

      if (roomsResult.status === 'fulfilled') {
        setRooms(roomsResult.value);
      } else {
        const message = roomsResult.reason instanceof Error ? roomsResult.reason.message : t('Не удалось загрузить каталог');
        setError((current) => current || t(message));
      }

      if (resolvedCategories.length > 0 || categoriesResult.status === 'fulfilled') {
        setCategoryNameById(
          resolvedCategories.reduce<Record<string, string>>((acc, category) => {
            acc[category.id] = category.name;
            return acc;
          }, {}),
        );
      } else {
        const message = categoriesResult.reason instanceof Error ? categoriesResult.reason.message : t('Не удалось загрузить сервисы');
        setServiceNotice(t(message));
      }

      if (resolvedServices.length > 0 || servicesResult.status === 'fulfilled') {
        setServices(resolvedServices);
      } else {
        const message = servicesResult.reason instanceof Error ? servicesResult.reason.message : t('Не удалось загрузить сервисы');
        setServiceNotice(t(message));
      }

      setIsLoading(false);
    })();

    return () => {
      isActive = false;
    };
  }, [isAuthenticated, t]);

  const venueById = useMemo(() => {
    const map = new Map<string, Venue>();
    venues.forEach((venue) => map.set(venue.id, venue));
    return map;
  }, [venues]);

  const roomCatalog = useMemo(() => {
    const catalog: RoomCatalogCard[] = [];

    rooms.forEach((room) => {
      const venue = venueById.get(room.venueId);
      if (!venue) return;

      const photos = getRoomPhotoUrls(room);
      catalog.push({
        room,
        venue,
        category: classifyCategory(room, venue),
        photo: photos[0] ?? null,
      });
    });

    return catalog;
  }, [rooms, venueById]);

  const normalizedSearchQuery = normalizeText(deferredSearchQuery);

  const visibleRooms = useMemo(() => {
    return roomCatalog.filter((item) => {
      if (!normalizedSearchQuery) return true;
      const haystack = `${item.room.name} ${item.venue.name} ${item.venue.address} ${item.venue.description}`.toLowerCase();
      return haystack.includes(normalizedSearchQuery);
    });
  }, [normalizedSearchQuery, roomCatalog]);

  const categoryLabelById = useMemo(
    () =>
      categories.reduce<Record<CategoryId, string>>((acc, category) => {
        acc[category.id] = category.label;
        return acc;
      }, {} as Record<CategoryId, string>),
    [],
  );

  const catalogCategoryStats = useMemo(() => {
    const counts: Record<CategoryId, number> = {
      all: 0,
      coworking: 0,
      beauty: 0,
      studio: 0,
      education: 0,
      health: 0,
      events: 0,
      other: 0,
    };

    roomCatalog.forEach((item) => {
      counts[item.category] += 1;
      counts.all += 1;
    });

    return categories
      .filter((category) => category.id !== 'all' && counts[category.id] > 0)
      .map((category) => ({
        id: category.id,
        label: category.label,
        count: counts[category.id],
      }));
  }, [roomCatalog]);

  const businessServiceCatalog = useMemo(() => {
    return services
      .map<BusinessServiceCard | null>((service) => {
        const venue = venueById.get(service.venueId);
        if (!venue) return null;

        const categoryLabel = service.categoryId
          ? categoryNameById[service.categoryId] ?? t('Без категории')
          : t('Без категории');
        const locations = Array.from(
          new Set(
            service.providers
              .map((provider) => provider.location.trim())
              .filter(Boolean),
          ),
        );

        return {
          service,
          venue,
          categoryLabel,
          coverPhoto: buildServiceCoverPhoto(service),
          providerCount: service.providers.length,
          featuredProviders: service.providers.slice(0, 3),
          locations,
          priceLabel: buildPriceLabel(service.providers, intlLocale, t),
          durationLabel: buildDurationLabel(service.providers, t),
          searchText: normalizeText(
            [
              service.name,
              categoryLabel,
              venue.name,
              venue.address,
              venue.description,
              ...service.providers.map((provider) => provider.name),
              ...service.providers.map((provider) => provider.location),
            ].join(' '),
          ),
        };
      })
      .filter((item): item is BusinessServiceCard => item !== null)
      .sort((left, right) => right.providerCount - left.providerCount);
  }, [categoryNameById, intlLocale, services, t, venueById]);

  const visibleBusinessServices = useMemo(() => {
    return businessServiceCatalog.filter((item) => {
      if (!normalizedSearchQuery) return true;
      return item.searchText.includes(normalizedSearchQuery);
    });
  }, [businessServiceCatalog, normalizedSearchQuery]);

  const searchSuggestions = useMemo(() => {
    if (!normalizedSearchQuery) return [];

    const roomSuggestions = roomCatalog
      .filter((item) => {
        const haystack = `${item.room.name} ${item.venue.name} ${item.venue.address} ${item.venue.description}`.toLowerCase();
        return haystack.includes(normalizedSearchQuery);
      })
      .map((item) => ({
        id: `room:${item.room.id}`,
        title: item.room.name,
        subtitle: item.venue.name,
      }));

    const serviceSuggestions = businessServiceCatalog
      .filter((item) => item.searchText.includes(normalizedSearchQuery))
      .map((item) => ({
        id: `service:${item.service.id}`,
        title: item.service.name,
        subtitle: `${item.venue.name} · ${item.categoryLabel}`,
      }));

    return [...roomSuggestions, ...serviceSuggestions].slice(0, 6);
  }, [businessServiceCatalog, normalizedSearchQuery, roomCatalog]);

  const visibleVenueGroups = useMemo(() => {
    const roomsByVenueId = new Map<string, RoomCatalogCard[]>();
    visibleRooms.forEach((item) => {
      const nextRooms = roomsByVenueId.get(item.venue.id) ?? [];
      nextRooms.push(item);
      roomsByVenueId.set(item.venue.id, nextRooms);
    });

    const servicesByVenueId = new Map<string, BusinessServiceCard[]>();
    visibleBusinessServices.forEach((item) => {
      const nextServices = servicesByVenueId.get(item.venue.id) ?? [];
      nextServices.push(item);
      servicesByVenueId.set(item.venue.id, nextServices);
    });

    return venues
      .map((venue) => {
        const venueRooms = roomsByVenueId.get(venue.id) ?? [];
        const venueServices = servicesByVenueId.get(venue.id) ?? [];

        if (venueRooms.length === 0 && venueServices.length === 0) {
          return null;
        }

        return {
          venue,
          rooms: venueRooms,
          services: venueServices,
        };
      })
      .filter((group): group is { venue: Venue; rooms: RoomCatalogCard[]; services: BusinessServiceCard[] } => group !== null);
  }, [venues, visibleBusinessServices, visibleRooms]);

  const shouldShowSearchSuggestions = isSearchFocused && Boolean(normalizedSearchQuery);

  const handleSearchSuggestionSelect = (value: string) => {
    setSearchQuery(value);
    setIsSearchFocused(false);
  };

  const resolveBookingLink = (roomId: string) => {
    if (!isAuthenticated) return `/login?next=${encodeURIComponent(`/room/${roomId}`)}`;
    return `/room/${roomId}`;
  };

  const resolveBookingLabel = () => {
    if (!isAuthenticated) return t('Войти и забронировать');
    return t('Забронировать');
  };

  const resolveVenueLink = (venueId: string) => {
    if (!isAuthenticated) return `/login?next=${encodeURIComponent(`/venue/${venueId}`)}`;
    return `/venue/${venueId}`;
  };

  const isBusinessPortal = portal === 'business' || user?.role === 'admin';

  const fullName = [user?.firstName, user?.lastName]
    .filter((value): value is string => Boolean(value && value.trim()))
    .join(' ')
    .trim();

  const initials = fullName
    ? fullName
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join('')
    : user?.email?.charAt(0).toUpperCase() ?? 'U';

  const shortName = fullName || user?.email?.split('@')[0] || t('Гость');

  const roomsEmptyLabel = searchQuery.trim()
    ? t('По запросу «{query}» ничего не найдено', { query: searchQuery.trim() })
    : t('Пока нет доступных вариантов');

  return (
    <div className="marketplace-stage min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border/40 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-5 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <img
                src="/favicon.svg"
                alt=""
                aria-hidden="true"
                className="h-10 w-10 shrink-0 rounded-2xl shadow-[0_10px_24px_rgba(210,135,58,0.38)]"
              />
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-foreground">TezBron</p>
              </div>
            </div>

            <div className="relative mx-2 hidden flex-1 lg:block">
              <label className="flex items-center gap-2 rounded-xl border border-border/70 bg-background/50 px-3 py-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  value={searchQuery}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => window.setTimeout(() => setIsSearchFocused(false), 120)}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={t('Поиск пространства')}
                  className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/80 focus:outline-none"
                />
              </label>
              {shouldShowSearchSuggestions ? (
                <div className="absolute inset-x-0 top-[calc(100%+0.35rem)] z-50 overflow-hidden rounded-xl border border-border/70 bg-background/95 shadow-[0_18px_40px_-26px_rgba(0,0,0,0.95)] backdrop-blur">
                  {searchSuggestions.length > 0 ? (
                    <ul className="max-h-72 overflow-auto py-1">
                      {searchSuggestions.map((suggestion) => (
                        <li key={suggestion.id}>
                          <button
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => handleSearchSuggestionSelect(suggestion.title)}
                            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition hover:bg-muted/60"
                          >
                            <span className="text-sm text-foreground">{suggestion.title}</span>
                            <span className="truncate text-xs text-muted-foreground">{suggestion.subtitle}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="px-3 py-2 text-xs text-muted-foreground">
                      {t('По запросу «{query}» ничего не найдено', { query: searchQuery.trim() })}
                    </p>
                  )}
                </div>
              ) : null}
            </div>

            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              <LanguageSwitcher className="hidden sm:flex" />
              {isAuthenticated ? (
                <>
                  {isBusinessPortal ? (
                    <Button asChild size="sm" variant="outline" className="hidden sm:inline-flex">
                      <Link to="/my-venue">{t('Кабинет')}</Link>
                    </Button>
                  ) : null}
                  <Link to="/profile" aria-label={t('Профиль')}>
                    <Avatar className="h-9 w-9 border border-border/60">
                      {user?.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={fullName || user.email} /> : null}
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                  </Link>
                </>
              ) : (
                <>
                  <Button asChild variant="outline" size="sm">
                    <Link to="/login">{t('Вход')}</Link>
                  </Button>
                  <Button asChild size="sm">
                    <Link to="/business/landing">{t('Бизнес-вход')}</Link>
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="relative mt-3 lg:hidden">
            <label className="flex items-center gap-2 rounded-xl border border-border/70 bg-background/50 px-3 py-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={searchQuery}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => window.setTimeout(() => setIsSearchFocused(false), 120)}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={t('Поиск пространства')}
                className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/80 focus:outline-none"
              />
            </label>
            {shouldShowSearchSuggestions ? (
              <div className="absolute inset-x-0 top-[calc(100%+0.35rem)] z-50 overflow-hidden rounded-xl border border-border/70 bg-background/95 shadow-[0_18px_40px_-26px_rgba(0,0,0,0.95)] backdrop-blur">
                {searchSuggestions.length > 0 ? (
                  <ul className="max-h-72 overflow-auto py-1">
                    {searchSuggestions.map((suggestion) => (
                      <li key={suggestion.id}>
                        <button
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => handleSearchSuggestionSelect(suggestion.title)}
                          className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition hover:bg-muted/60"
                        >
                          <span className="text-sm text-foreground">{suggestion.title}</span>
                          <span className="truncate text-xs text-muted-foreground">{suggestion.subtitle}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-3 py-2 text-xs text-muted-foreground">
                    {t('По запросу «{query}» ничего не найдено', { query: searchQuery.trim() })}
                  </p>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-7 px-5 py-7 sm:px-6 sm:py-9 lg:px-8">
        <section className="marketplace-hero-panel group relative overflow-hidden rounded-3xl border border-white/10 p-6 sm:p-8 lg:p-10">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -left-16 top-10 h-36 w-36 rounded-full bg-white/5 blur-2xl transition-transform duration-700 group-hover:scale-110" />
            <div className="absolute -right-10 bottom-0 h-40 w-40 rounded-full bg-amber-300/10 blur-2xl transition-transform duration-700 group-hover:translate-y-[-6px]" />
          </div>

          <div className="relative">
            <div>
              <h1 className="max-w-3xl text-3xl font-semibold leading-tight text-white sm:text-5xl">
                {isAuthenticated
                  ? t('С возвращением, {name}. Время выбрать следующий слот.', { name: shortName })
                  : t('Находите, сравнивайте и бронируйте пространство за минуты')}
              </h1>
              <p className="mt-4 max-w-2xl text-sm text-white/75 sm:text-base">
                {t('Мы делаем поиск и бронирование пространств простыми: один каталог, понятные фильтры и быстрый путь до подтверждённого слота.')}
              </p>
              <Button
                asChild
                size="sm"
                variant="outline"
                className="mt-6 h-10 rounded-lg border-white/30 bg-transparent px-4 text-white transition hover:bg-white/10"
              >
                <Link to="/business/landing">
                  {t('Узнайте о нас больше')}
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="marketplace-control-deck rounded-2xl border border-border/55 bg-card/70 p-4 sm:p-5">
          <div className="flex flex-col gap-3">
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{t('Категории из текущих комнат')}</p>
            <div className="flex flex-wrap gap-2">
              {catalogCategoryStats.length > 0 ? (
                catalogCategoryStats.map((item) => (
                  <span
                    key={item.id}
                    className="rounded-xl border border-border/70 bg-background/40 px-3 py-2 text-sm text-muted-foreground"
                  >
                    {t(item.label)} <span className="text-foreground/80">({item.count})</span>
                  </span>
                ))
              ) : (
                <span className="rounded-xl border border-border/70 bg-background/40 px-3 py-2 text-sm text-muted-foreground">
                  {t('Категории появятся после добавления комнат')}
                </span>
              )}
            </div>
          </div>
        </section>

        {error ? (
          <Card className="border-red-800/40 bg-red-950/20">
            <CardContent className="py-4 text-sm text-red-300">{error}</CardContent>
          </Card>
        ) : null}

        {isLoading ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Card key={index} className="h-72 animate-pulse border-border/40 bg-card/40" />
            ))}
          </div>
        ) : visibleVenueGroups.length === 0 ? (
          <Card className="border-border/40">
            <CardContent className="py-16 text-center">
              <p className="text-sm text-muted-foreground">{roomsEmptyLabel}</p>
            </CardContent>
          </Card>
        ) : (
          <section className="space-y-6">
            {visibleVenueGroups.map((group) => (
              <section
                key={group.venue.id}
                className="rounded-[2rem] border border-border/50 bg-card/75 p-5 shadow-[0_14px_32px_-24px_rgba(0,0,0,0.9)]"
              >
                <div className="flex flex-col gap-4 border-b border-border/40 pb-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="truncate text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                          {group.venue.name}
                        </h2>
                        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                          <MapPin className="h-4 w-4 shrink-0" />
                          <span className="truncate">{group.venue.address}</span>
                        </p>
                      </div>
                    </div>
                    {group.venue.description ? (
                      <p className="mt-4 max-w-3xl text-sm text-muted-foreground">{group.venue.description}</p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    {group.rooms.length > 0 ? (
                      <Badge variant="outline" className="border-border/60 bg-background/35 px-3 py-1 text-sm text-foreground">
                        {t('Комнаты')} ({group.rooms.length})
                      </Badge>
                    ) : null}
                    {group.services.length > 0 ? (
                      <Badge variant="outline" className="border-border/60 bg-background/35 px-3 py-1 text-sm text-foreground">
                        {t('Услуги')} ({group.services.length})
                      </Badge>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-7 pt-6">
                  <div>
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{t('Комнаты')}</p>
                      <p className="text-xs text-muted-foreground">{group.rooms.length}</p>
                    </div>
                    <div className="-mx-1 overflow-x-auto px-1 pb-3">
                      {group.rooms.length > 0 ? (
                        <div className="flex min-w-max snap-x snap-mandatory gap-5">
                          {group.rooms.map(({ room, venue, category, photo }, index) => {
                            const CategoryIcon = categoryIcons[category];

                            return (
                              <Card
                                key={room.id}
                                className={`group marketplace-service-card card-hover stagger-${Math.min(index + 1, 6)} animate-fade-up w-[320px] shrink-0 snap-start overflow-hidden border-border/50 sm:w-[340px]`}
                              >
                                <div className="relative h-40 overflow-hidden">
                                  {photo ? (
                                    <img src={photo} alt={room.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                                  ) : (
                                    <div className="h-full w-full bg-[radial-gradient(circle_at_20%_0%,hsl(29_67%_53%_/_0.35),transparent_55%),linear-gradient(135deg,hsl(240_8%_18%),hsl(240_8%_8%))]" />
                                  )}
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
                                  <div className="absolute left-3 top-3 flex items-center gap-2">
                                    <Badge className="border border-white/15 bg-black/35 text-[11px] text-white hover:bg-black/35">
                                      <CategoryIcon className="mr-1 h-3 w-3" />
                                      {t(categoryLabelById[category])}
                                    </Badge>
                                  </div>
                                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                                    <Badge variant="secondary" className="bg-black/45 text-[11px] text-white">
                                      {t('до {count} человек', { count: room.capacity })}
                                    </Badge>
                                    <Badge variant="outline" className="border-white/30 bg-black/20 text-[11px] text-white">
                                      {t('Помещение')}
                                    </Badge>
                                  </div>
                                </div>

                                <CardContent className="space-y-4 p-4">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="flex items-center gap-1.5 text-lg font-semibold leading-tight text-foreground">
                                        <DoorOpen className="h-4 w-4 shrink-0" />
                                        <span className="truncate">{room.name}</span>
                                      </p>
                                      <p className="mt-1 text-sm text-muted-foreground">{venue.name}</p>
                                    </div>
                                    <Button asChild variant="ghost" size="icon" className="h-8 w-8 shrink-0 rounded-full">
                                      <Link to={`/venue/${venue.id}`} aria-label={t('Все комнаты и услуги')}>
                                        <ArrowRight className="h-4 w-4" />
                                      </Link>
                                    </Button>
                                  </div>

                                  <p className="flex items-start gap-2 text-sm text-muted-foreground">
                                    <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                                    <span className="line-clamp-2">{venue.address}</span>
                                  </p>

                                  <p className="flex items-start gap-2 text-sm text-muted-foreground">
                                    <DoorOpen className="mt-0.5 h-4 w-4 shrink-0" />
                                    <span className="line-clamp-2">{room.description || venue.description || t('Подробности доступны внутри карточки')}</span>
                                  </p>

                                  <Button asChild className="w-full rounded-xl">
                                    <Link to={resolveBookingLink(room.id)}>
                                      <span>{resolveBookingLabel()}</span>
                                      <ArrowRight className="ml-2 h-4 w-4" />
                                    </Link>
                                  </Button>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      ) : (
                        <Card className="w-[320px] border-dashed border-border/50 bg-background/30 sm:w-[340px]">
                          <CardContent className="py-6 text-sm text-muted-foreground">{t('Помещения пока не опубликованы')}</CardContent>
                        </Card>
                      )}
                    </div>
                  </div>

                  {group.services.length > 0 ? (
                    <div>
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{t('Услуги')}</p>
                        <p className="text-xs text-muted-foreground">{group.services.length}</p>
                      </div>
                      <div className="-mx-1 overflow-x-auto px-1 pb-3">
                        <div className="flex min-w-max snap-x snap-mandatory gap-5">
                          {group.services.map((entry, index) => (
                            <Card
                              key={entry.service.id}
                              className={`group marketplace-service-card card-hover stagger-${Math.min(index + 1, 6)} animate-fade-up w-[340px] shrink-0 snap-start overflow-hidden border-border/50 bg-[linear-gradient(180deg,rgba(22,22,26,0.94),rgba(16,16,18,0.98))] py-0 sm:w-[380px]`}
                            >
                              <div className="relative h-52 overflow-hidden">
                                {entry.coverPhoto ? (
                                  <img
                                    src={entry.coverPhoto}
                                    alt={entry.service.name}
                                    className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                                  />
                                ) : (
                                  <div className="h-full w-full bg-[radial-gradient(circle_at_20%_0%,hsl(29_67%_53%_/_0.35),transparent_52%),radial-gradient(circle_at_100%_100%,rgba(255,255,255,0.1),transparent_30%),linear-gradient(140deg,hsl(240_8%_18%),hsl(240_10%_8%))]" />
                                )}

                                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-transparent" />

                                <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                                  <Badge className="border border-white/15 bg-black/45 text-white hover:bg-black/45">
                                    <Sparkles className="h-3 w-3" />
                                    {entry.categoryLabel}
                                  </Badge>
                                  <Badge variant="outline" className="border-white/20 bg-black/20 text-white">
                                    <Users className="h-3 w-3" />
                                    {t('{count} специалистов', { count: entry.providerCount })}
                                  </Badge>
                                </div>

                                <div className="absolute bottom-4 left-4 right-4">
                                  <p className="text-xs uppercase tracking-[0.16em] text-white/55">{group.venue.name}</p>
                                  <h3 className="mt-2 text-2xl font-semibold leading-tight text-white">{entry.service.name}</h3>
                                </div>
                              </div>

                              <CardContent className="flex flex-1 flex-col gap-5 p-5">
                                <div className="space-y-3">
                                  <p className="flex items-start gap-2 text-sm text-muted-foreground">
                                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                                    <span className="line-clamp-2">{entry.venue.address}</span>
                                  </p>
                                  <p className="flex items-start gap-2 text-sm text-muted-foreground">
                                    <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                                    <span className="line-clamp-2">
                                      {entry.locations.length > 0
                                        ? entry.locations.join(', ')
                                        : entry.venue.description || t('Локация уточняется внутри бизнеса')}
                                    </span>
                                  </p>
                                </div>

                                <div className="grid grid-cols-3 gap-2">
                                  <div className="rounded-2xl border border-border/60 bg-white/[0.03] p-3">
                                    <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{t('Цена')}</p>
                                    <p className="mt-2 text-sm font-medium text-foreground">{entry.priceLabel}</p>
                                  </div>
                                  <div className="rounded-2xl border border-border/60 bg-white/[0.03] p-3">
                                    <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{t('Формат')}</p>
                                    <p className="mt-2 text-sm font-medium text-foreground">{entry.durationLabel}</p>
                                  </div>
                                  <div className="rounded-2xl border border-border/60 bg-white/[0.03] p-3">
                                    <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{t('Команда')}</p>
                                    <p className="mt-2 text-sm font-medium text-foreground">{entry.providerCount}</p>
                                  </div>
                                </div>

                                <div>
                                  <div className="mb-3 flex items-center gap-2 text-sm text-foreground/85">
                                    <CalendarClock className="h-4 w-4 text-primary" />
                                    <span>{t('Кто оказывает услугу')}</span>
                                  </div>

                                  {entry.featuredProviders.length > 0 ? (
                                    <div className="space-y-3">
                                      {entry.featuredProviders.map((provider) => (
                                        <div key={`${entry.service.id}:${provider.id}`} className="flex items-center gap-3 rounded-2xl border border-border/50 bg-white/[0.03] p-3">
                                          <Avatar className="h-10 w-10 border border-white/10">
                                            {provider.photoUrl ? <AvatarImage src={provider.photoUrl} alt={provider.name} /> : null}
                                            <AvatarFallback>{buildProviderFallback(provider)}</AvatarFallback>
                                          </Avatar>
                                          <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium text-foreground">{provider.name}</p>
                                            <p className="truncate text-xs text-muted-foreground">
                                              {provider.location || t('Локация уточняется')}
                                            </p>
                                          </div>
                                          <div className="shrink-0 text-right">
                                            <p className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
                                              <Clock3 className="h-3.5 w-3.5" />
                                              {buildProviderShift(provider, t)}
                                            </p>
                                            <p className="mt-1 flex items-center justify-end gap-1 text-xs text-muted-foreground">
                                              <Wallet className="h-3.5 w-3.5" />
                                              {provider.price > 0 ? `${buildCurrencyFormatter(intlLocale).format(provider.price)} ${t('сум')}` : t('Цена по запросу')}
                                            </p>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="rounded-2xl border border-dashed border-border/60 bg-white/[0.02] p-4 text-sm text-muted-foreground">
                                      {t('Специалисты появятся после заполнения услуги в кабинете бизнеса')}
                                    </div>
                                  )}
                                </div>

                                <div className="mt-auto flex gap-3">
                                  <Button asChild className="flex-1 rounded-xl">
                                    <Link to={resolveVenueLink(entry.venue.id)}>
                                      {isAuthenticated ? t('Открыть бизнес') : t('Войти и открыть бизнес')}
                                      <ArrowRight className="h-4 w-4" />
                                    </Link>
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </section>
            ))}
          </section>
        )}

        {serviceNotice ? (
          <Card className="border-border/40">
            <CardContent className="py-4 text-sm text-muted-foreground">{serviceNotice}</CardContent>
          </Card>
        ) : null}
      </main>
    </div>
  );
}
