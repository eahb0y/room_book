import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  History,
  MapPin,
  MessageCircle,
  Monitor,
  MoonStar,
  Palette,
  ShieldCheck,
  SunMedium,
  Trash2,
  UserRound,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useVenueStore } from '@/store/venueStore';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ClientBookingHistory from '@/components/ClientBookingHistory';
import BusinessActivityField from '@/components/BusinessActivityField';
import { useI18n } from '@/i18n/useI18n';
import { canManageBusinessResources, getAccessibleBusinessVenues, isBusinessPortalActive } from '@/lib/businessAccess';
import { getInvitationByToken, redeemInvitation } from '@/lib/inviteApi';
import {
  BUSINESS_ACTIVITY_CUSTOM_ID,
  decodeBusinessActivityValue,
  encodeBusinessActivityValue,
} from '@/lib/businessActivity';
import {
  getResidentPromoDescription,
  normalizeResidentPromoCode,
} from '@/lib/residentPromo';
import {
  createTelegramBotActivation,
  getTelegramBotConnectionStatus,
  type TelegramBotConnectionStatus,
} from '@/lib/telegramBotApi';
import { debugError, debugInfo, debugWarn } from '@/lib/frontendDebug';
import { cn } from '@/lib/utils';

const MAX_PROFILE_PHOTO_SIDE = 900;
const MAX_PROFILE_PHOTO_BYTES = 900_000;
const PROFILE_PHOTO_QUALITY = 0.84;
const TELEGRAM_BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME?.trim() ?? '';
const SUCCESS_ALERT_CLASS_NAME = 'border-[hsl(var(--success)/0.24)] bg-[hsl(var(--success)/0.12)]';
const SUCCESS_ALERT_TEXT_CLASS_NAME = 'text-[hsl(var(--success-foreground))]';
const WARNING_TEXT_CLASS_NAME = 'text-[hsl(var(--warning-foreground))]';

type ThemeChoice = 'light' | 'dark' | 'system';

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('Не удалось прочитать файл'));
    };
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
    reader.readAsDataURL(file);
  });

const compressImageDataUrl = (source: string) =>
  new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const longestSide = Math.max(img.width, img.height);
      const scale = longestSide > MAX_PROFILE_PHOTO_SIDE ? MAX_PROFILE_PHOTO_SIDE / longestSide : 1;
      const width = Math.max(1, Math.round(img.width * scale));
      const height = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Не удалось обработать изображение'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', PROFILE_PHOTO_QUALITY));
    };
    img.onerror = () => reject(new Error('Не удалось обработать изображение'));
    img.src = source;
  });

const estimateDataUrlBytes = (dataUrl: string) => {
  const base64 = dataUrl.split(',')[1];
  if (!base64) return 0;
  return Math.ceil((base64.length * 3) / 4);
};

const toInitials = (firstName?: string, lastName?: string, email?: string) => {
  const full = `${firstName ?? ''} ${lastName ?? ''}`.trim();
  if (full) {
    const parts = full.split(/\s+/).filter(Boolean);
    return parts
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }

  if (!email) return 'U';
  return email.charAt(0).toUpperCase();
};

export default function Profile() {
  const { t, intlLocale } = useI18n();
  const { user, portal, updateProfile, refreshBusinessAccess } = useAuthStore();
  const venues = useVenueStore((state) => state.venues);
  const memberships = useVenueStore((state) => state.memberships);
  const createVenue = useVenueStore((state) => state.createVenue);
  const updateVenue = useVenueStore((state) => state.updateVenue);
  const loadUserData = useVenueStore((state) => state.loadUserData);
  const navigate = useNavigate();
  const { resolvedTheme, setTheme, systemTheme, theme } = useTheme();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isImageProcessing, setIsImageProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [residentPromoCode, setResidentPromoCode] = useState('');
  const [residentPromoError, setResidentPromoError] = useState('');
  const [residentPromoSuccess, setResidentPromoSuccess] = useState('');
  const [isResidentPromoSubmitting, setIsResidentPromoSubmitting] = useState(false);
  const [selectedVenueId, setSelectedVenueId] = useState('');
  const [venueName, setVenueName] = useState('');
  const [venueAddress, setVenueAddress] = useState('');
  const [venueActivityType, setVenueActivityType] = useState('');
  const [venueCustomActivityType, setVenueCustomActivityType] = useState('');
  const [venueDescription, setVenueDescription] = useState('');
  const [isVenueSaving, setIsVenueSaving] = useState(false);
  const [venueError, setVenueError] = useState('');
  const [venueSuccess, setVenueSuccess] = useState('');
  const [telegramStatus, setTelegramStatus] = useState<TelegramBotConnectionStatus | null>(null);
  const [isTelegramStatusLoading, setIsTelegramStatusLoading] = useState(false);
  const [isTelegramConnecting, setIsTelegramConnecting] = useState(false);
  const [telegramError, setTelegramError] = useState('');
  const [telegramSuccess, setTelegramSuccess] = useState('');
  const [isThemeReady, setIsThemeReady] = useState(false);

  useEffect(() => {
    setFirstName(user?.firstName ?? '');
    setLastName(user?.lastName ?? '');
    setAvatarUrl(user?.avatarUrl ?? null);
    setError('');
    setSuccess('');
  }, [user?.id, user?.firstName, user?.lastName, user?.avatarUrl]);

  useEffect(() => {
    setIsThemeReady(true);
  }, []);

  const initials = useMemo(
    () => toInitials(firstName.trim(), lastName.trim(), user?.email),
    [firstName, lastName, user?.email],
  );

  const isBusinessPortal = isBusinessPortalActive(user, portal);
  const isSimpleUser = !isBusinessPortal;
  const accessibleBusinessVenues = useMemo(() => getAccessibleBusinessVenues(user, venues), [user, venues]);
  const existingVenue = useMemo(
    () => accessibleBusinessVenues.find((venue) => venue.id === selectedVenueId) ?? accessibleBusinessVenues[0] ?? null,
    [accessibleBusinessVenues, selectedVenueId],
  );
  const canEditVenue = canManageBusinessResources(user);
  const connectedResidentVenues = useMemo(
    () =>
      memberships
        .map((membership) => ({
          membership,
          venue: venues.find((venue) => venue.id === membership.venueId) ?? null,
        }))
        .sort((left, right) => right.membership.joinedAt.localeCompare(left.membership.joinedAt)),
    [memberships, venues],
  );
  const selectedTheme = (theme ?? 'light') as ThemeChoice;
  const activeTheme = selectedTheme === 'system' ? (resolvedTheme === 'dark' ? 'dark' : 'light') : selectedTheme;
  const activeThemeLabel = activeTheme === 'light' ? t('Светлая') : t('Тёмная');
  const selectedThemeLabel =
    selectedTheme === 'light'
      ? t('Светлая тема')
      : selectedTheme === 'dark'
        ? t('Тёмная тема')
        : t('Системная тема');
  const systemThemeLabel = systemTheme === 'dark' ? t('Тёмная') : t('Светлая');
  const themeOptions = [
    {
      value: 'light' as const,
      icon: SunMedium,
      title: t('Светлая тема'),
      description: t('Воздушные карточки, мягкие синие акценты и светлый фон TezBron'),
      previewClassName:
        'border-[#D7E0EE] bg-[linear-gradient(145deg,rgba(255,255,255,0.98),rgba(232,238,248,0.94))] text-[#162033]',
      chipClassName: 'bg-[#1274E7] text-white',
      surfaceClassName: 'bg-white/90 border-[#D7E0EE]',
    },
    {
      value: 'dark' as const,
      icon: MoonStar,
      title: t('Тёмная тема'),
      description: t('Контрастная вечерняя палитра, которая уже используется в приложении'),
      previewClassName:
        'border-white/10 bg-[linear-gradient(145deg,rgba(20,20,24,0.98),rgba(11,11,14,0.98))] text-[#F2F0E9]',
      chipClassName: 'bg-[#D4853A] text-[#161616]',
      surfaceClassName: 'bg-white/5 border-white/10',
    },
    {
      value: 'system' as const,
      icon: Monitor,
      title: t('Системная тема'),
      description: t('TezBron автоматически повторяет светлый или тёмный режим устройства'),
      previewClassName:
        'border-[#D7E0EE] bg-[linear-gradient(90deg,rgba(253,254,255,0.96)_0%,rgba(253,254,255,0.96)_50%,rgba(16,16,18,0.98)_50%,rgba(16,16,18,0.98)_100%)] text-[#162033]',
      chipClassName: 'bg-[#4BC1B4] text-[#162033]',
      surfaceClassName: 'bg-white/80 border-[#D7E0EE]',
    },
  ];

  useEffect(() => {
    if (!isBusinessPortal) {
      setSelectedVenueId('');
      return;
    }

    if (accessibleBusinessVenues.length === 0) {
      setSelectedVenueId('');
      return;
    }

    setSelectedVenueId((current) =>
      current && accessibleBusinessVenues.some((venue) => venue.id === current) ? current : accessibleBusinessVenues[0]?.id ?? '',
    );
  }, [accessibleBusinessVenues, isBusinessPortal]);

  useEffect(() => {
    if (!isBusinessPortal) return;
    const decodedActivityType = decodeBusinessActivityValue(existingVenue?.activityType);
    setVenueName(existingVenue?.name ?? '');
    setVenueAddress(existingVenue?.address ?? '');
    setVenueActivityType(decodedActivityType.selectedValue);
    setVenueCustomActivityType(decodedActivityType.customValue);
    setVenueDescription(existingVenue?.description ?? '');
    setVenueError('');
    setVenueSuccess('');
  }, [
    existingVenue?.activityType,
    existingVenue?.address,
    existingVenue?.description,
    existingVenue?.id,
    existingVenue?.name,
    isBusinessPortal,
  ]);

  useEffect(() => {
    if (!isBusinessPortal || !existingVenue?.id) {
      setTelegramStatus(null);
      setIsTelegramStatusLoading(false);
      setTelegramError('');
      setTelegramSuccess('');
      return;
    }

    let isCancelled = false;

    const loadStatus = async () => {
      setIsTelegramStatusLoading(true);

      try {
        const nextStatus = await getTelegramBotConnectionStatus(existingVenue.id);
        if (isCancelled) return;
        setTelegramStatus(nextStatus);
        setTelegramError('');
      } catch (err) {
        if (isCancelled) return;
        const message = err instanceof Error ? t(err.message) : t('Не удалось загрузить статус Telegram-бота');
        setTelegramError(message);
      } finally {
        if (!isCancelled) {
          setIsTelegramStatusLoading(false);
        }
      }
    };

    void loadStatus();

    const handleFocus = () => {
      void loadStatus();
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      isCancelled = true;
      window.removeEventListener('focus', handleFocus);
    };
  }, [existingVenue?.id, isBusinessPortal, t]);

  if (!user) return null;

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(isBusinessPortal ? '/my-venue' : '/');
  };

  const handlePhotoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError('');
    setSuccess('');
    setIsImageProcessing(true);

    try {
      if (!file.type.startsWith('image/')) {
        throw new Error('Можно загружать только изображения');
      }

      const rawDataUrl = await readFileAsDataUrl(file);
      const compressedDataUrl = await compressImageDataUrl(rawDataUrl);
      const imageBytes = estimateDataUrlBytes(compressedDataUrl);

      if (imageBytes > MAX_PROFILE_PHOTO_BYTES) {
        throw new Error('Одно из фото слишком большое. Выберите изображение меньшего размера');
      }

      setAvatarUrl(compressedDataUrl);
    } catch (err) {
      const message = err instanceof Error ? t(err.message) : t('Не удалось загрузить фото');
      setError(message);
    } finally {
      setIsImageProcessing(false);
      event.target.value = '';
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setIsSaving(true);

    try {
      const normalizedFirstName = firstName.trim();
      const normalizedLastName = lastName.trim();
      const normalizedCurrentFirstName = user.firstName?.trim() ?? '';
      const normalizedCurrentLastName = user.lastName?.trim() ?? '';

      const payload: {
        firstName?: string;
        lastName?: string;
        avatarUrl?: string | null;
      } = {};

      if (normalizedFirstName !== normalizedCurrentFirstName) {
        payload.firstName = normalizedFirstName;
      }

      if (normalizedLastName !== normalizedCurrentLastName) {
        payload.lastName = normalizedLastName;
      }

      if (avatarUrl !== (user.avatarUrl ?? null)) {
        payload.avatarUrl = avatarUrl;
      }

      await updateProfile(payload);
      setSuccess(t('Профиль обновлён'));
    } catch (err) {
      const message = err instanceof Error ? t(err.message) : t('Произошла ошибка при сохранении');
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleBusinessVenueSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setVenueError('');
    setVenueSuccess('');

    const normalizedName = venueName.trim();
    const normalizedAddress = venueAddress.trim();
    const normalizedActivityType = encodeBusinessActivityValue(venueActivityType, venueCustomActivityType);
    const normalizedDescription = venueDescription.trim();

    if (!normalizedName || !normalizedAddress) {
      setVenueError(t('Название и адрес обязательны для заполнения'));
      return;
    }

    if (venueActivityType === BUSINESS_ACTIVITY_CUSTOM_ID && !normalizedActivityType) {
      setVenueError(t('Укажите свой род деятельности'));
      return;
    }

    if (!existingVenue && !normalizedActivityType) {
      setVenueError(t('Выберите род деятельности'));
      return;
    }

    if (!user) return;
    if (!canEditVenue) {
      setVenueError(t('Эта роль может только просматривать данные заведения'));
      return;
    }

    setIsVenueSaving(true);
    try {
      if (existingVenue) {
        await updateVenue(existingVenue.id, {
          name: normalizedName,
          address: normalizedAddress,
          activityType: normalizedActivityType,
          description: normalizedDescription,
        });
        setVenueSuccess(t('Данные заведения обновлены'));
      } else {
        await createVenue({
          adminId: user.id,
          name: normalizedName,
          address: normalizedAddress,
          activityType: normalizedActivityType,
          description: normalizedDescription,
        });
        await refreshBusinessAccess();
        setVenueSuccess(t('Заведение создано'));
      }
    } catch (err) {
      const message = err instanceof Error ? t(err.message) : t('Произошла ошибка при сохранении');
      setVenueError(message);
    } finally {
      setIsVenueSaving(false);
    }
  };

  const formatJoinedAt = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(intlLocale, {
      dateStyle: 'medium',
    }).format(date);
  };

  const formatDateTime = (value?: string | null) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return new Intl.DateTimeFormat(intlLocale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  };

  const handleResidentPromoSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;

    setResidentPromoError('');
    setResidentPromoSuccess('');

    const normalizedPromoCode = normalizeResidentPromoCode(residentPromoCode);
    if (!normalizedPromoCode) {
      setResidentPromoError(t('Введите промокод'));
      return;
    }

    setIsResidentPromoSubmitting(true);
    try {
      const invitation = await getInvitationByToken(normalizedPromoCode);
      await redeemInvitation(normalizedPromoCode);
      await loadUserData(user.id);
      setResidentPromoCode('');
      setResidentPromoSuccess(
        t('Промокод применён. Доступ к заведению «{venue}» открыт', {
          venue: invitation.venueName ?? t('Заведение'),
        }),
      );
    } catch (err) {
      const message = err instanceof Error ? t(err.message) : t('Не удалось применить приглашение');
      setResidentPromoError(message);
    } finally {
      setIsResidentPromoSubmitting(false);
    }
  };

  const handleTelegramBotConnect = async () => {
    if (!existingVenue?.id) {
      debugWarn('telegram.connect.blocked.missing_venue');
      setTelegramError(t('Сначала сохраните заведение, затем подключите Telegram-бота'));
      setTelegramSuccess('');
      return;
    }

    if (!TELEGRAM_BOT_USERNAME) {
      debugWarn('telegram.connect.blocked.missing_bot_username', {
        venueId: existingVenue.id,
      });
      setTelegramError(t('Укажите VITE_TELEGRAM_BOT_USERNAME, чтобы включить кнопку подключения'));
      setTelegramSuccess('');
      return;
    }

    debugInfo('telegram.connect.flow.started', {
      venueId: existingVenue.id,
      botUsername: TELEGRAM_BOT_USERNAME,
    });

    setTelegramError('');
    setTelegramSuccess('');
    setIsTelegramConnecting(true);

    try {
      const activation = await createTelegramBotActivation(existingVenue.id);
      const botUrl = `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${activation.token}`;
      debugInfo('telegram.connect.flow.bot_url_ready', {
        venueId: existingVenue.id,
        expiresAt: activation.expiresAt,
        tokenLength: activation.token.length,
      });

      const openedWindow = window.open(botUrl, '_blank', 'noopener,noreferrer');
      if (!openedWindow) {
        debugWarn('telegram.connect.flow.window_open_blocked', {
          venueId: existingVenue.id,
        });
        window.location.assign(botUrl);
      } else {
        debugInfo('telegram.connect.flow.window_opened', {
          venueId: existingVenue.id,
        });
      }

      setTelegramSuccess(
        t('Telegram открыт. Нажмите Start в боте, чтобы завершить подключение. Ссылка действует до {value}', {
          value: formatDateTime(activation.expiresAt),
        }),
      );
      debugInfo('telegram.connect.flow.succeeded', {
        venueId: existingVenue.id,
        expiresAt: activation.expiresAt,
      });
    } catch (err) {
      const message = err instanceof Error ? t(err.message) : t('Не удалось создать ссылку для Telegram-бота');
      debugError('telegram.connect.flow.failed', {
        venueId: existingVenue.id,
        error: err instanceof Error ? err.message : String(err),
      });
      setTelegramError(message);
    } finally {
      setIsTelegramConnecting(false);
    }
  };

  const handleTelegramStatusRefresh = async () => {
    if (!existingVenue?.id) return;

    debugInfo('telegram.status.refresh.started', {
      venueId: existingVenue.id,
    });

    setTelegramError('');
    setIsTelegramStatusLoading(true);

    try {
      const nextStatus = await getTelegramBotConnectionStatus(existingVenue.id);
      setTelegramStatus(nextStatus);
      setTelegramError('');
      debugInfo('telegram.status.refresh.succeeded', {
        venueId: existingVenue.id,
        isConnected: nextStatus.isConnected,
        chatLabel: nextStatus.chatLabel ?? null,
        connectedAt: nextStatus.connectedAt ?? null,
        lastNotificationAt: nextStatus.lastNotificationAt ?? null,
      });
    } catch (err) {
      const message = err instanceof Error ? t(err.message) : t('Не удалось загрузить статус Telegram-бота');
      debugError('telegram.status.refresh.failed', {
        venueId: existingVenue.id,
        error: err instanceof Error ? err.message : String(err),
      });
      setTelegramError(message);
    } finally {
      setIsTelegramStatusLoading(false);
    }
  };

  const appearanceSection = (
    <Card id="profile-appearance" className="scroll-mt-28 overflow-hidden border-border/50">
      <CardHeader className="relative overflow-hidden border-b border-border/50 bg-card/70">
        <div className="pointer-events-none absolute inset-y-0 right-0 w-[34%] bg-[radial-gradient(circle_at_top_right,hsl(var(--teal)/0.12),transparent_34%),radial-gradient(circle_at_center,hsl(var(--primary)/0.08),transparent_46%)]" />
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-primary" />
              {t('Оформление')}
            </CardTitle>
            <CardDescription>
              {t('Выберите тему интерфейса для TezBron. Настройка применяется ко всему приложению.')}
            </CardDescription>
          </div>
          <Badge variant="outline" className="w-fit rounded-full border-border/70 bg-background/92 px-3 py-1 text-foreground shadow-[0_10px_24px_-20px_rgba(15,23,42,0.22)]">
            {t('Активная тема: {value}', { value: activeThemeLabel })}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-[1.75rem] border border-border/60 bg-background/55 p-4 text-sm text-muted-foreground backdrop-blur">
          <p>{t('Светлая тема использует мягкие карточки, чистый фон и спокойные брендовые акценты без перегруза.')}</p>
          <p className="mt-2">
            {selectedTheme === 'system'
              ? t('Сейчас выбрана системная тема. Устройство сообщает режим: {value}.', { value: systemThemeLabel })
              : t('Сейчас выбрана опция: {value}.', { value: selectedThemeLabel })}
          </p>
        </div>

        <div role="radiogroup" aria-label={t('Тема интерфейса')} className="grid gap-4 lg:grid-cols-3">
          {themeOptions.map((option) => {
            const isActive = selectedTheme === option.value;
            const PreviewIcon = option.icon;

            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={isActive}
                onClick={() => setTheme(option.value)}
                disabled={!isThemeReady}
                className={cn(
                  'group rounded-[1.9rem] border p-4 text-left transition duration-300',
                  isActive
                    ? 'border-primary/28 bg-primary/[0.06] shadow-[0_18px_42px_-30px_hsl(var(--primary)/0.34)]'
                    : 'border-border/60 bg-card/70 hover:border-primary/18 hover:bg-background/72',
                  !isThemeReady && 'cursor-wait opacity-70',
                )}
              >
                <div
                  className={cn(
                    'relative overflow-hidden rounded-[1.55rem] border p-3 shadow-[0_14px_36px_-28px_rgba(15,23,42,0.28)]',
                    option.previewClassName,
                  )}
                >
                  <div className="absolute inset-x-3 top-3 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-current/20" />
                      <span className="h-2.5 w-2.5 rounded-full bg-current/12" />
                    </div>
                    <span className={cn('rounded-full px-2 py-1 text-[10px] font-semibold', option.chipClassName)}>
                      TezBron
                    </span>
                  </div>
                  <div className="mt-10 space-y-3">
                    <div className="h-3 w-24 rounded-full bg-current/85" />
                    <div className="h-2.5 w-36 rounded-full bg-current/35" />
                    <div className="grid gap-2">
                      <div className={cn('rounded-[1.2rem] border p-3', option.surfaceClassName)}>
                        <div className="h-2.5 w-20 rounded-full bg-current/75" />
                        <div className="mt-2 h-2 w-28 rounded-full bg-current/24" />
                      </div>
                      <div className={cn('flex items-center justify-between rounded-[1.2rem] border p-3', option.surfaceClassName)}>
                        <div className="space-y-2">
                          <div className="h-2.5 w-16 rounded-full bg-current/75" />
                          <div className="h-2 w-20 rounded-full bg-current/24" />
                        </div>
                        <div className={cn('h-8 w-14 rounded-full', option.chipClassName)} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-foreground">{option.title}</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{option.description}</p>
                  </div>
                  <div
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border transition-colors',
                      isActive ? 'border-primary/25 bg-primary/12 text-primary' : 'border-border/60 bg-background/70 text-muted-foreground',
                    )}
                  >
                    <PreviewIcon className="h-4 w-4" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );

  const profileSections = (
    <div className="space-y-8">
      <Card id="profile-business" className="border-border/40 scroll-mt-28">
        <CardHeader>
          <CardTitle>{isBusinessPortal ? t('Данные заведения') : t('Бизнес-профиль')}</CardTitle>
          {isBusinessPortal ? (
            <CardDescription>
              {t('Редактируйте название, адрес и описание вашего заведения')}
            </CardDescription>
          ) : null}
        </CardHeader>
        {isBusinessPortal ? (
          <CardContent>
            <form onSubmit={handleBusinessVenueSubmit} className="space-y-5">
              {(venueError || venueSuccess) && (
                <Alert
                  variant={venueError ? 'destructive' : 'default'}
                  className={!venueError ? SUCCESS_ALERT_CLASS_NAME : ''}
                >
                  {venueError ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className={cn('h-4 w-4', SUCCESS_ALERT_TEXT_CLASS_NAME)} />}
                  <AlertDescription className={!venueError ? SUCCESS_ALERT_TEXT_CLASS_NAME : ''}>
                    {venueError || venueSuccess}
                  </AlertDescription>
                </Alert>
              )}

              {accessibleBusinessVenues.length > 1 ? (
                <div className="space-y-2">
                  <Label>{t('Заведение')}</Label>
                  <Select value={selectedVenueId} onValueChange={setSelectedVenueId}>
                    <SelectTrigger className="h-11 bg-input/50 border-border/50 focus:border-primary/60 transition-colors">
                      <SelectValue placeholder={t('Выберите заведение')} />
                    </SelectTrigger>
                    <SelectContent>
                      {accessibleBusinessVenues.map((venue) => (
                        <SelectItem key={venue.id} value={venue.id}>
                          {venue.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="venueName">{t('Название заведения')}</Label>
                <Input
                  id="venueName"
                  value={venueName}
                  onChange={(event) => setVenueName(event.target.value)}
                  placeholder={t('Например: Nura Spaces')}
                  required
                  disabled={!canEditVenue}
                  className="h-11 bg-input/50 border-border/50 focus:border-primary/60 transition-colors"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="venueAddress">{t('Адрес')}</Label>
                <Input
                  id="venueAddress"
                  value={venueAddress}
                  onChange={(event) => setVenueAddress(event.target.value)}
                  placeholder={t('Например: ул. Ленина, 1')}
                  required
                  disabled={!canEditVenue}
                  className="h-11 bg-input/50 border-border/50 focus:border-primary/60 transition-colors"
                />
              </div>

              <BusinessActivityField
                idPrefix="profile-venue"
                selectedValue={venueActivityType}
                customValue={venueCustomActivityType}
                onSelectedValueChange={setVenueActivityType}
                onCustomValueChange={setVenueCustomActivityType}
                disabled={!canEditVenue}
                required={!existingVenue}
              />

              <div className="space-y-2">
                <Label htmlFor="venueDescription">{t('Описание')}</Label>
                <Textarea
                  id="venueDescription"
                  value={venueDescription}
                  onChange={(event) => setVenueDescription(event.target.value)}
                  rows={4}
                  placeholder={t('Коротко опишите ваше заведение')}
                  disabled={!canEditVenue}
                  className="bg-input/50 border-border/50 focus:border-primary/60 transition-colors resize-none"
                />
              </div>

              {canEditVenue ? (
                <div className="pt-1">
                  <Button type="submit" className="h-11 min-w-44" disabled={isVenueSaving}>
                    {isVenueSaving ? t('Сохранение…') : existingVenue ? t('Обновить заведение') : t('Создать заведение')}
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t('Только роль business может изменять данные заведения')}
                </p>
              )}

              <div className="rounded-2xl border border-border/50 bg-background/35 p-4 space-y-4">
                <div className="space-y-1">
                  <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <MessageCircle className="h-4 w-4 text-primary" />
                    <span>{t('Telegram-бот для броней')}</span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t('Бот отправляет в Telegram уведомления о новых и изменённых бронях.')}
                  </p>
                </div>

                {(telegramError || telegramSuccess) ? (
                  <Alert
                    variant={telegramError ? 'destructive' : 'default'}
                    className={!telegramError ? SUCCESS_ALERT_CLASS_NAME : ''}
                  >
                    {telegramError ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className={cn('h-4 w-4', SUCCESS_ALERT_TEXT_CLASS_NAME)} />}
                    <AlertDescription className={!telegramError ? SUCCESS_ALERT_TEXT_CLASS_NAME : ''}>
                      {telegramError || telegramSuccess}
                    </AlertDescription>
                  </Alert>
                ) : null}

                <div className="rounded-2xl border border-border/50 bg-background/55 p-4">
                  {telegramStatus?.isConnected ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-foreground">
                        {t('Уведомления приходят в чат: {chat}', {
                          chat: telegramStatus.chatLabel ?? t('Telegram'),
                        })}
                      </p>
                      {telegramStatus.connectedAt ? (
                        <p className="text-xs text-muted-foreground">
                          {t('Подключено {value}', { value: formatDateTime(telegramStatus.connectedAt) })}
                        </p>
                      ) : null}
                      {telegramStatus.lastNotificationAt ? (
                        <p className="text-xs text-muted-foreground">
                          {t('Последнее уведомление: {value}', { value: formatDateTime(telegramStatus.lastNotificationAt) })}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {t('Telegram пока не подключён')}
                    </p>
                  )}
                </div>

                {!TELEGRAM_BOT_USERNAME ? (
                  <p className={cn('text-xs', WARNING_TEXT_CLASS_NAME)}>
                    {t('Укажите VITE_TELEGRAM_BOT_USERNAME, чтобы включить кнопку подключения')}
                  </p>
                ) : null}

                <div className="flex flex-col gap-3 sm:flex-row">
                  {canEditVenue ? (
                    <Button
                      type="button"
                      className="h-11 sm:min-w-56"
                      onClick={handleTelegramBotConnect}
                      disabled={isTelegramConnecting || !existingVenue || !TELEGRAM_BOT_USERNAME}
                    >
                      {isTelegramConnecting
                        ? t('Сохранение…')
                        : telegramStatus?.isConnected
                          ? t('Переподключить Telegram-бота')
                          : t('Подключить Telegram-бота')}
                    </Button>
                  ) : null}

                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 sm:min-w-44"
                    onClick={handleTelegramStatusRefresh}
                    disabled={isTelegramStatusLoading || !existingVenue}
                  >
                    {isTelegramStatusLoading ? t('Обновление…') : t('Проверить статус')}
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground">
                  {t('После нажатия откроется Telegram. В боте нужно нажать Start, чтобы завершить подключение.')}
                </p>
              </div>
            </form>
          </CardContent>
        ) : (
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {t('Нажмите кнопку, чтобы открыть страницу с условиями и подключением бизнеса')}
            </p>
            <Button
              type="button"
              onClick={() => {
                navigate('/business/register');
              }}
              className="h-11 sm:min-w-56"
            >
              {t('Добавить бизнес')}
            </Button>
          </CardContent>
        )}
      </Card>

      {!isBusinessPortal && (
        <Card id="profile-personal" className="border-border/40 scroll-mt-28">
          <CardHeader>
            <CardTitle>{t('Личные данные')}</CardTitle>
            <CardDescription>{t('Имя, фото и контактный email')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {(error || success) && (
                <Alert
                  variant={error ? 'destructive' : 'default'}
                  className={!error ? SUCCESS_ALERT_CLASS_NAME : ''}
                >
                  {error ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className={cn('h-4 w-4', SUCCESS_ALERT_TEXT_CLASS_NAME)} />}
                  <AlertDescription className={!error ? SUCCESS_ALERT_TEXT_CLASS_NAME : ''}>
                    {error || success}
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <Avatar className="h-24 w-24 border border-border/50">
                  {avatarUrl ? <AvatarImage src={avatarUrl} alt={t('Фото профиля')} /> : null}
                  <AvatarFallback className="text-xl">{initials}</AvatarFallback>
                </Avatar>

                <div className="flex flex-wrap gap-2">
                  <Label
                    htmlFor="profilePhoto"
                    className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-border/50 px-4 text-sm text-foreground hover:bg-secondary/50"
                  >
                    <Camera className="h-4 w-4" />
                    <span>{t('Загрузить фото')}</span>
                  </Label>
                  <input
                    id="profilePhoto"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoChange}
                    disabled={isImageProcessing || isSaving}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setAvatarUrl(null)}
                    disabled={!avatarUrl || isImageProcessing || isSaving}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>{t('Удалить фото')}</span>
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName">{t('Имя')}</Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    maxLength={100}
                    placeholder={t('Имя')}
                    className="h-11 bg-input/50 border-border/50 focus:border-primary/60 transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">{t('Фамилия')}</Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    maxLength={100}
                    placeholder={t('Фамилия')}
                    className="h-11 bg-input/50 border-border/50 focus:border-primary/60 transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">{t('Email')}</Label>
                <Input
                  id="email"
                  value={user.email}
                  readOnly
                  disabled
                  className="h-11 bg-input/30 border-border/50 text-muted-foreground"
                />
                <p className="text-xs text-muted-foreground">{t('Email нельзя изменить')}</p>
              </div>

              <div className="pt-2">
                <Button type="submit" className="h-11 min-w-44" disabled={isSaving || isImageProcessing}>
                  {isSaving ? t('Сохранение…') : t('Сохранить')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {appearanceSection}

      {!isBusinessPortal ? (
        <Card className="border-border/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              {t('Я являюсь резидентом')}
            </CardTitle>
            <CardDescription>{t('Введите промокод бизнеса, чтобы открыть комнаты для резидентов')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {(residentPromoError || residentPromoSuccess) ? (
              <Alert
                variant={residentPromoError ? 'destructive' : 'default'}
                className={!residentPromoError ? SUCCESS_ALERT_CLASS_NAME : ''}
              >
                {residentPromoError ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className={cn('h-4 w-4', SUCCESS_ALERT_TEXT_CLASS_NAME)} />}
                <AlertDescription className={!residentPromoError ? SUCCESS_ALERT_TEXT_CLASS_NAME : ''}>
                  {residentPromoError || residentPromoSuccess}
                </AlertDescription>
              </Alert>
            ) : null}

            <form onSubmit={handleResidentPromoSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="residentPromoCode">{t('Промокод')}</Label>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Input
                    id="residentPromoCode"
                    value={residentPromoCode}
                    onChange={(event) => setResidentPromoCode(event.target.value)}
                    placeholder={t('Вставьте промокод')}
                    className="h-11 bg-input/50 border-border/50 font-mono focus:border-primary/60"
                  />
                  <Button type="submit" className="h-11 sm:min-w-52" disabled={isResidentPromoSubmitting}>
                    {isResidentPromoSubmitting ? t('Сохранение…') : t('Применить промокод')}
                  </Button>
                </div>
              </div>
            </form>

            <div className="rounded-2xl border border-border/50 bg-background/35 p-4">
              <p className="text-sm leading-6 text-muted-foreground">{getResidentPromoDescription(t)}</p>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-foreground">{t('Мои резидентские доступы')}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t('Площадки, которые открылись по промокоду')}</p>
              </div>

              {connectedResidentVenues.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/50 bg-background/20 p-4 text-sm text-muted-foreground">
                  {t('Пока нет подключений по промокоду')}
                </div>
              ) : (
                <div className="space-y-3">
                  {connectedResidentVenues.map(({ membership, venue }) => (
                    <div key={membership.id} className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium text-foreground">
                              {venue?.name ?? t('Заведение')}
                            </p>
                            <Badge variant="outline" className="border-primary/35 bg-primary/10 text-primary">
                              {t('Подключено через промокод')}
                            </Badge>
                          </div>
                          {venue?.address ? (
                            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                              <MapPin className="h-3.5 w-3.5" />
                              <span>{venue.address}</span>
                            </p>
                          ) : null}
                          <p className="mt-2 text-xs text-muted-foreground">
                            {t('Подключено {value}', { value: formatJoinedAt(membership.joinedAt) })}
                          </p>
                        </div>
                        <Button asChild variant="outline" className="h-10 border-border/50">
                          <Link to={`/venue/${membership.venueId}`}>
                            {t('Открыть заведение')}
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}

    </div>
  );

  const clientTabs = (
    <Tabs defaultValue="profile" className="space-y-6">
      <TabsList className="grid h-11 w-full max-w-[360px] grid-cols-2">
        <TabsTrigger value="profile" className="gap-2">
          <UserRound className="h-4 w-4" />
          {t('Профиль')}
        </TabsTrigger>
        <TabsTrigger value="history" className="gap-2">
          <History className="h-4 w-4" />
          {t('История')}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="profile" className="space-y-8">
        {profileSections}
      </TabsContent>

      <TabsContent value="history" className="space-y-8">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-foreground">
            {t('История бронирований')}
          </h2>
          <p className="mt-2 text-muted-foreground">{t('Управляйте своими бронированиями')}</p>
        </div>
        <ClientBookingHistory showHeader={false} />
      </TabsContent>
    </Tabs>
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-4xl font-semibold text-foreground tracking-tight">{t('Профиль')}</h1>
          <p className="text-muted-foreground mt-2">
            {isBusinessPortal
              ? t('Редактируйте данные вашего заведения')
              : t('Редактируйте персональные данные аккаунта')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isBusinessPortal ? (
            <Button type="button" variant="outline" onClick={() => navigate('/my-venues')} className="h-10 w-fit">
              <span>{t('Мои заведения')}</span>
            </Button>
          ) : null}
          {isSimpleUser ? (
            <Button type="button" variant="outline" onClick={handleBack} className="h-10 w-fit">
              <ArrowLeft className="h-4 w-4" />
              <span>{t('Назад')}</span>
            </Button>
          ) : null}
        </div>
      </div>

      {isSimpleUser ? clientTabs : profileSections}
    </div>
  );
}
