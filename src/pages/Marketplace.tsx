import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  CalendarClock,
  Compass,
  DoorOpen,
  GraduationCap,
  MapPin,
  Search,
  Sparkles,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { listVenues } from '@/lib/venueApi';
import { listRooms } from '@/lib/roomApi';
import { getRoomPhotoUrls } from '@/lib/roomPhotos';
import type { Room, Venue } from '@/types';
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

interface ServiceCard {
  room: Room;
  venue: Venue;
  category: CategoryId;
  photo: string | null;
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

export default function Marketplace() {
  const { t } = useI18n();
  const { isAuthenticated, user, portal } = useAuthStore();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  useEffect(() => {
    let isActive = true;
    setIsLoading(true);
    setError('');

    void (async () => {
      try {
        const [allVenues, allRooms] = await Promise.all([
          listVenues({ publicAccess: true }),
          listRooms({ publicAccess: true }),
        ]);

        if (!isActive) return;
        setVenues(allVenues);
        setRooms(allRooms);
      } catch (err) {
        if (!isActive) return;
        const message = err instanceof Error ? err.message : t('Не удалось загрузить каталог');
        setError(t(message));
      } finally {
        if (isActive) setIsLoading(false);
      }
    })();

    return () => {
      isActive = false;
    };
  }, [t]);

  const venueById = useMemo(() => {
    const map = new Map<string, Venue>();
    venues.forEach((venue) => map.set(venue.id, venue));
    return map;
  }, [venues]);

  const services = useMemo(() => {
    const catalog: ServiceCard[] = [];

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

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();

  const visibleServices = useMemo(() => {
    return services.filter((service) => {
      if (!normalizedSearchQuery) return true;
      const haystack = `${service.room.name} ${service.venue.name} ${service.venue.address} ${service.venue.description}`.toLowerCase();
      return haystack.includes(normalizedSearchQuery);
    });
  }, [normalizedSearchQuery, services]);

  const searchSuggestions = useMemo(() => {
    if (!normalizedSearchQuery) return [];

    return services
      .filter((service) => {
        const haystack = `${service.room.name} ${service.venue.name} ${service.venue.address} ${service.venue.description}`.toLowerCase();
        return haystack.includes(normalizedSearchQuery);
      })
      .slice(0, 6)
      .map((service) => ({
        id: service.room.id,
        title: service.room.name,
        subtitle: service.venue.name,
      }));
  }, [normalizedSearchQuery, services]);

  const shouldShowSearchSuggestions = isSearchFocused && Boolean(normalizedSearchQuery);

  const handleSearchSuggestionSelect = (value: string) => {
    setSearchQuery(value);
    setIsSearchFocused(false);
  };

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

    services.forEach((service) => {
      counts[service.category] += 1;
      counts.all += 1;
    });

    return categories
      .filter((category) => category.id !== 'all' && counts[category.id] > 0)
      .map((category) => ({
        id: category.id,
        label: category.label,
        count: counts[category.id],
      }));
  }, [services]);

  const resolveBookingLink = (roomId: string) => {
    if (!isAuthenticated) return `/login?next=${encodeURIComponent(`/room/${roomId}`)}`;
    return `/room/${roomId}`;
  };

  const resolveBookingLabel = () => {
    if (!isAuthenticated) return t('Войти и забронировать');
    return t('Забронировать');
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

  const emptyStateLabel = searchQuery.trim()
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
                <span
                  className="rounded-xl border border-border/70 bg-background/40 px-3 py-2 text-sm text-muted-foreground"
                >
                  {t('Категории появятся после добавления комнат')}
                </span>
              )}
            </div>
          </div>
        </section>

        {error && (
          <Card className="border-red-800/40 bg-red-950/20">
            <CardContent className="py-4 text-sm text-red-300">{error}</CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Card key={index} className="h-72 animate-pulse border-border/40 bg-card/40" />
            ))}
          </div>
        ) : visibleServices.length === 0 ? (
          <Card className="border-border/40">
            <CardContent className="py-16 text-center">
              <p className="text-sm text-muted-foreground">{emptyStateLabel}</p>
            </CardContent>
          </Card>
        ) : (
          <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {visibleServices.map(({ room, venue, category, photo }, index) => {
              const CategoryIcon = categoryIcons[category];

              return (
                <Card
                  key={room.id}
                  className={`group marketplace-service-card card-hover stagger-${Math.min(index + 1, 6)} animate-fade-up overflow-hidden border-border/50`}
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
                        {t('Сервис')}
                      </Badge>
                    </div>
                  </div>

                  <CardContent className="space-y-4 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 text-lg font-semibold leading-tight text-foreground">
                          <Building2 className="h-4 w-4 shrink-0" />
                          <span className="truncate">{venue.name}</span>
                        </p>
                        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                          <DoorOpen className="h-4 w-4 shrink-0" />
                          <span className="line-clamp-2">{room.name}</span>
                        </p>
                      </div>
                      <Button asChild variant="ghost" size="icon" className="h-8 w-8 shrink-0 rounded-full">
                        <Link to={`/venue/${venue.id}`} aria-label={t('Все комнаты и сервисы')}>
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
                      <span className="line-clamp-2">{venue.description || t('Подробности доступны внутри карточки')}</span>
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
          </section>
        )}
      </main>
    </div>
  );
}
