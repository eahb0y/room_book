import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { addDays, format, isBefore, parseISO, startOfToday, type Locale } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Building2,
  Check,
  CheckCircle2,
  Clock3,
  Edit2,
  ImagePlus,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  UserRound,
  X,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useVenueStore } from '@/store/venueStore';
import type { BusinessService, BusinessServiceCategory, BusinessServiceProvider } from '@/types';
import {
  createBusinessService,
  createBusinessServiceCategory,
  deleteBusinessService,
  listBusinessServiceCategories,
  listBusinessServices,
  updateBusinessService,
  updateBusinessServiceCategory,
} from '@/lib/serviceApi';
import { listServiceBookingBusySlots, type ServiceBookingBusySlot } from '@/lib/serviceBookingApi';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import { useI18n } from '@/i18n/useI18n';
import { canManageBusinessResources, getAccessibleBusinessVenues, isBusinessPortalActive } from '@/lib/businessAccess';
import { cn } from '@/lib/utils';

const MAX_SERVICE_PHOTO_SIDE = 1400;
const MAX_SERVICE_PHOTO_BYTES = 1_500_000;
const SERVICE_PHOTO_QUALITY = 0.82;
const SLOT_STEP_MINUTES = 15;
const MINUTES_IN_DAY = 24 * 60;

interface ServiceSlotItem {
  startTime: string;
  endTime: string;
  isBusy: boolean;
  bookingUserLabel?: string;
}

interface ServiceProviderDraft {
  id: string;
  templateId: string;
  name: string;
  location: string;
  workFrom: string;
  workTo: string;
  durationMinutes: string;
  price: string;
  photoUrl: string | null;
}

interface ExistingStaffOption {
  id: string;
  label: string;
  provider: BusinessServiceProvider;
}

const createDraftId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `staff-${Math.random().toString(36).slice(2, 10)}`;
};

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
      const scale = longestSide > MAX_SERVICE_PHOTO_SIDE ? MAX_SERVICE_PHOTO_SIDE / longestSide : 1;
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
      resolve(canvas.toDataURL('image/jpeg', SERVICE_PHOTO_QUALITY));
    };
    img.onerror = () => reject(new Error('Не удалось обработать изображение'));
    img.src = source;
  });

const estimateDataUrlBytes = (dataUrl: string) => {
  const base64 = dataUrl.split(',')[1];
  if (!base64) return 0;
  return Math.ceil((base64.length * 3) / 4);
};

const normalizeLocation = (value: string) => value.trim().replace(/\s+/g, ' ');
const normalizeCategoryName = (value: string) => value.trim().replace(/\s+/g, ' ');
const normalizePersonName = (value: string) => value.trim().replace(/\s+/g, ' ');
const normalizeInteger = (value: string) => value.replace(/[^\d]/g, '');
const normalizePriceInput = (value: string) => value.replace(/[^\d.,]/g, '').replace(',', '.');
const formatPriceLabel = (value: number) => `${value.toLocaleString('ru-RU')} ${'сум'}`;
const buildServicePriceSummary = (providers: BusinessServiceProvider[]) => {
  const prices = providers
    .map((provider) => provider.price)
    .filter((value) => Number.isFinite(value) && value > 0);

  if (prices.length === 0) return '';

  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  return minPrice === maxPrice
    ? formatPriceLabel(minPrice)
    : `${formatPriceLabel(minPrice)} - ${formatPriceLabel(maxPrice)}`;
};
const normalizeTimeValue = (value: string) => value.trim().slice(0, 5);
const toTimeMinutes = (value: string) => {
  const [hour, minute] = value.split(':');
  const parsedHour = Number(hour);
  const parsedMinute = Number(minute);

  if (!Number.isFinite(parsedHour) || !Number.isFinite(parsedMinute)) return null;
  return parsedHour * 60 + parsedMinute;
};

const toTimeLabel = (totalMinutes: number) => {
  const safeMinutes = Math.max(0, Math.min(totalMinutes, MINUTES_IN_DAY));
  if (safeMinutes >= MINUTES_IN_DAY) return '24:00';

  const hour = Math.floor(safeMinutes / 60).toString().padStart(2, '0');
  const minute = (safeMinutes % 60).toString().padStart(2, '0');
  return `${hour}:${minute}`;
};

const isOverlapping = (startA: string, endA: string, startB: string, endB: string) =>
  startA < endB && endA > startB;

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

const getServiceBookingUserLabel = (params: {
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
    <ScrollArea className="w-full max-w-full overflow-hidden whitespace-nowrap rounded-xl">
      <div className="flex w-max min-w-full gap-2 pb-2">
        {dates.map((dateValue) => {
          const isSelected = dateValue === value;

          return (
            <button
              key={dateValue}
              type="button"
              onClick={() => onChange(dateValue)}
              className={cn(
                'w-[104px] shrink-0 rounded-xl border px-3 py-3 text-left transition-colors',
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

const prepareImageFile = async (file: File) => {
  if (!file.type.startsWith('image/')) {
    throw new Error('Можно загружать только изображения');
  }

  const rawDataUrl = await readFileAsDataUrl(file);
  const compressedDataUrl = await compressImageDataUrl(rawDataUrl);
  const imageBytes = estimateDataUrlBytes(compressedDataUrl);

  if (imageBytes > MAX_SERVICE_PHOTO_BYTES) {
    throw new Error('Одно из фото слишком большое. Выберите изображение меньшего размера');
  }

  return compressedDataUrl;
};

export default function ServicesManagement() {
  const { t, dateLocale } = useI18n();
  const { user, portal } = useAuthStore();
  const navigate = useNavigate();
  const isBusinessPortal = isBusinessPortalActive(user, portal);
  const venues = useVenueStore((state) => state.venues);
  const serviceBookings = useVenueStore((state) => state.serviceBookings);

  const ownedVenues = useMemo(() => getAccessibleBusinessVenues(user, venues), [user, venues]);
  const canManageServices = canManageBusinessResources(user);
  const [selectedVenueId, setSelectedVenueId] = useState('');
  const selectedVenue = useMemo(
    () => ownedVenues.find((venue) => venue.id === selectedVenueId) ?? null,
    [ownedVenues, selectedVenueId],
  );
  const [categories, setCategories] = useState<BusinessServiceCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [dialogCategoryName, setDialogCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState<BusinessServiceCategory | null>(null);
  const [categoryEditName, setCategoryEditName] = useState('');
  const [services, setServices] = useState<BusinessService[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCategorySaving, setIsCategorySaving] = useState(false);
  const [isImageProcessing, setIsImageProcessing] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCategoryEditDialogOpen, setIsCategoryEditDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<BusinessService | null>(null);
  const [formCategoryId, setFormCategoryId] = useState('');
  const [isDialogCategoryCreateOpen, setIsDialogCategoryCreateOpen] = useState(false);
  const [serviceName, setServiceName] = useState('');
  const [servicePhotoUrl, setServicePhotoUrl] = useState<string | null>(null);
  const [providers, setProviders] = useState<ServiceProviderDraft[]>([]);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [selectedSlotServiceId, setSelectedSlotServiceId] = useState('');
  const [selectedSlotProviderId, setSelectedSlotProviderId] = useState('');
  const [selectedSlotDate, setSelectedSlotDate] = useState(() => format(startOfToday(), 'yyyy-MM-dd'));
  const [busySlots, setBusySlots] = useState<ServiceBookingBusySlot[]>([]);
  const [isBusySlotsLoading, setIsBusySlotsLoading] = useState(false);
  const [slotError, setSlotError] = useState('');

  useEffect(() => {
    if (!user || !isBusinessPortal) {
      navigate('/');
      return;
    }
  }, [isBusinessPortal, navigate, user]);

  useEffect(() => {
    if (!successMessage) return;
    const timeoutId = window.setTimeout(() => setSuccessMessage(''), 2500);
    return () => window.clearTimeout(timeoutId);
  }, [successMessage]);

  useEffect(() => {
    if (ownedVenues.length === 0) {
      setSelectedVenueId('');
      return;
    }

    setSelectedVenueId((current) =>
      current && ownedVenues.some((venue) => venue.id === current) ? current : ownedVenues[0]?.id ?? '',
    );
  }, [ownedVenues]);

  const resetForm = useCallback((nextCategoryId = '') => {
    setEditingService(null);
    setFormCategoryId(nextCategoryId);
    setDialogCategoryName('');
    setIsDialogCategoryCreateOpen(false);
    setServiceName('');
    setServicePhotoUrl(null);
    setProviders([
      {
        id: createDraftId(),
        templateId: '',
        name: '',
        location: '',
        workFrom: '',
        workTo: '',
        durationMinutes: '',
        price: '',
        photoUrl: null,
      },
    ]);
    setIsImageProcessing(false);
    setError('');
  }, []);

  const loadPageData = useCallback(async (venueId: string) => {
    setIsLoading(true);
    setError('');

    try {
      const [loadedCategories, loadedServices] = await Promise.all([
        listBusinessServiceCategories({ venueId }),
        listBusinessServices({ venueId }),
      ]);

      setCategories(loadedCategories);
      setServices(loadedServices);
    } catch (err) {
      const message = err instanceof Error ? t(err.message) : t('Не удалось загрузить сервисы');
      setError(message);
      setCategories([]);
      setServices([]);
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!selectedVenueId) {
      setCategories([]);
      setSelectedCategoryId('');
      setServices([]);
      return;
    }

    void loadPageData(selectedVenueId);
  }, [loadPageData, selectedVenueId]);

  useEffect(() => {
    if (categories.length === 0) {
      setSelectedCategoryId('');
      return;
    }

    setSelectedCategoryId((current) =>
      current && categories.some((category) => category.id === current) ? current : categories[0]?.id ?? '',
    );
  }, [categories]);

  useEffect(() => {
    if (services.length === 0) {
      setSelectedSlotServiceId('');
      return;
    }

    setSelectedSlotServiceId((current) =>
      current && services.some((service) => service.id === current) ? current : services[0]?.id ?? '',
    );
  }, [services]);

  const categoryServiceCount = useMemo(() => {
    const counts = new Map<string, number>();
    services.forEach((service) => {
      if (!service.categoryId) return;
      counts.set(service.categoryId, (counts.get(service.categoryId) ?? 0) + 1);
    });
    return counts;
  }, [services]);

  const servicesByCategory = useMemo(() => {
    const grouped = new Map<string, BusinessService[]>();

    services.forEach((service) => {
      if (!service.categoryId) return;

      const categoryServices = grouped.get(service.categoryId) ?? [];
      categoryServices.push(service);
      grouped.set(service.categoryId, categoryServices);
    });

    return grouped;
  }, [services]);

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === selectedCategoryId) ?? null,
    [categories, selectedCategoryId],
  );

  const selectedSlotService = useMemo(
    () => services.find((service) => service.id === selectedSlotServiceId) ?? null,
    [selectedSlotServiceId, services],
  );

  useEffect(() => {
    if (!selectedSlotService || selectedSlotService.providers.length === 0) {
      setSelectedSlotProviderId('');
      return;
    }

    setSelectedSlotProviderId((current) =>
      current && selectedSlotService.providers.some((provider) => provider.id === current)
        ? current
        : selectedSlotService.providers[0]?.id ?? '',
    );
  }, [selectedSlotService]);

  const selectedSlotProvider = useMemo(
    () => selectedSlotService?.providers.find((provider) => provider.id === selectedSlotProviderId) ?? null,
    [selectedSlotProviderId, selectedSlotService],
  );

  const selectedCategoryServices = useMemo(
    () => (selectedCategory ? servicesByCategory.get(selectedCategory.id) ?? [] : []),
    [selectedCategory, servicesByCategory],
  );

  const slotDateOptions = useMemo(() => buildFutureDateOptions(selectedSlotDate), [selectedSlotDate]);

  const selectedDateServiceBookings = useMemo(
    () =>
      serviceBookings
        .filter((booking) => booking.serviceId === selectedSlotServiceId)
        .filter((booking) => booking.providerId === selectedSlotProviderId)
        .filter((booking) => booking.bookingDate === selectedSlotDate)
        .sort((first, second) => first.startTime.localeCompare(second.startTime)),
    [selectedSlotDate, selectedSlotProviderId, selectedSlotServiceId, serviceBookings],
  );

  const activeDateServiceBookings = useMemo(
    () => selectedDateServiceBookings.filter((booking) => booking.status === 'active'),
    [selectedDateServiceBookings],
  );

  const cancelledDateServiceBookings = useMemo(
    () => selectedDateServiceBookings.filter((booking) => booking.status === 'cancelled'),
    [selectedDateServiceBookings],
  );

  useEffect(() => {
    if (!selectedSlotServiceId || !selectedSlotProviderId || !selectedSlotDate) {
      setBusySlots([]);
      setSlotError('');
      return;
    }

    let isActive = true;

    void (async () => {
      setIsBusySlotsLoading(true);
      setSlotError('');

      try {
        const loadedBusySlots = await listServiceBookingBusySlots({
          serviceId: selectedSlotServiceId,
          providerId: selectedSlotProviderId,
          bookingDate: selectedSlotDate,
        });

        if (!isActive) return;
        setBusySlots(loadedBusySlots);
      } catch (err) {
        if (!isActive) return;
        setBusySlots([]);
        setSlotError(err instanceof Error ? t(err.message) : t('Не удалось загрузить доступные слоты'));
      } finally {
        if (isActive) {
          setIsBusySlotsLoading(false);
        }
      }
    })();

    return () => {
      isActive = false;
    };
  }, [selectedSlotDate, selectedSlotProviderId, selectedSlotServiceId, t]);

  const slotItems = useMemo<ServiceSlotItem[]>(() => {
    if (!selectedSlotProvider) return [];

    const durationMinutes = selectedSlotProvider.durationMinutes;
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return [];

    const workFromMinutes = toTimeMinutes(selectedSlotProvider.workFrom?.trim() || '00:00') ?? 0;
    const workToMinutes = toTimeMinutes(selectedSlotProvider.workTo?.trim() || '24:00') ?? MINUTES_IN_DAY;
    const slotStartMinutes: number[] = [];

    for (let minute = workFromMinutes; minute + durationMinutes <= workToMinutes; minute += SLOT_STEP_MINUTES) {
      slotStartMinutes.push(minute);
    }

    return slotStartMinutes.map((minute) => {
      const startTime = toTimeLabel(minute);
      const endTime = toTimeLabel(minute + durationMinutes);
      const exactBooking = activeDateServiceBookings.find((booking) =>
        isOverlapping(startTime, endTime, booking.startTime, booking.endTime),
      );
      const busyByRpc = busySlots.some((slot) =>
        isOverlapping(startTime, endTime, slot.startTime, slot.endTime),
      );

      return {
        startTime,
        endTime,
        isBusy: Boolean(exactBooking) || busyByRpc,
        bookingUserLabel: exactBooking
          ? getServiceBookingUserLabel({
            userId: exactBooking.userId,
            userEmail: exactBooking.userEmail,
            userFirstName: exactBooking.userFirstName,
            userLastName: exactBooking.userLastName,
            t,
          })
          : undefined,
      };
    });
  }, [activeDateServiceBookings, busySlots, selectedSlotProvider, t]);

  const availableSlotCount = useMemo(
    () => slotItems.filter((slot) => !slot.isBusy).length,
    [slotItems],
  );

  const busySlotCount = useMemo(
    () => slotItems.filter((slot) => slot.isBusy).length,
    [slotItems],
  );

  const existingStaffOptions = useMemo<ExistingStaffOption[]>(() => {
    const byId = new Map<string, ExistingStaffOption>();
    const byFallbackKey = new Set<string>();

    services.forEach((service) => {
      service.providers.forEach((provider) => {
        const normalizedName = normalizePersonName(provider.name);
        if (!normalizedName) return;

        const fallbackKey = `${normalizedName.toLowerCase()}::${provider.photoUrl ?? ''}`;
        const optionId = provider.id || fallbackKey;

        if (byId.has(optionId) || byFallbackKey.has(fallbackKey)) return;

        byFallbackKey.add(fallbackKey);
        byId.set(optionId, {
          id: optionId,
          label: provider.location ? `${provider.name} · ${provider.location}` : provider.name,
          provider,
        });
      });
    });

    return Array.from(byId.values()).sort((first, second) => first.label.localeCompare(second.label, 'ru'));
  }, [services]);

  const openCreateDialog = (categoryId?: string) => {
    if (!canManageServices) return;
    const nextCategoryId = categoryId || selectedCategoryId || categories[0]?.id || '';

    resetForm(nextCategoryId);
    setSuccessMessage('');
    setIsDialogOpen(true);
  };

  const openCategoryEditDialog = (category: BusinessServiceCategory) => {
    if (!canManageServices) return;
    setEditingCategory(category);
    setCategoryEditName(category.name);
    setError('');
    setSuccessMessage('');
    setIsCategoryEditDialogOpen(true);
  };

  const openEditDialog = (service: BusinessService) => {
    if (!canManageServices) return;
    setEditingService(service);
    setFormCategoryId(service.categoryId ?? selectedCategoryId ?? categories[0]?.id ?? '');
    setServiceName(service.name);
    setServicePhotoUrl(service.photoUrl ?? null);
    const nextProviders = service.providers.map((provider) => ({
        id: provider.id,
        templateId: provider.id,
        name: provider.name,
        location: provider.location,
        workFrom: provider.workFrom ?? '',
        workTo: provider.workTo ?? '',
        durationMinutes: provider.durationMinutes > 0 ? String(provider.durationMinutes) : '',
        price: provider.price > 0 ? String(provider.price) : '',
        photoUrl: provider.photoUrl ?? null,
      }));
    setProviders(
      nextProviders.length > 0
        ? nextProviders
        : [{
          id: createDraftId(),
          templateId: '',
          name: '',
          location: '',
          workFrom: '',
          workTo: '',
          durationMinutes: '',
          price: '',
          photoUrl: null,
        }],
    );
    setIsImageProcessing(false);
    setError('');
    setSuccessMessage('');
    setIsDialogOpen(true);
  };

  const closeDialog = useCallback(() => {
    setIsDialogOpen(false);
    resetForm(selectedCategoryId || categories[0]?.id || '');
  }, [categories, resetForm, selectedCategoryId]);

  const handleDialogOpenChange = (open: boolean) => {
    if (open) {
      setIsDialogOpen(true);
      return;
    }

    closeDialog();
  };

  const addProviderRow = () => {
    if (!canManageServices) return;
    setProviders((current) => [
      ...current,
      {
        id: createDraftId(),
        templateId: '',
        name: '',
        location: '',
        workFrom: '',
        workTo: '',
        durationMinutes: '',
        price: '',
        photoUrl: null,
      },
    ]);
  };

  const updateProviderRow = (index: number, patch: Partial<ServiceProviderDraft>) => {
    setProviders((current) =>
      current.map((provider, currentIndex) => {
        if (currentIndex !== index) return provider;
        return { ...provider, ...patch };
      }),
    );
  };

  const handleSelectExistingProvider = (index: number, optionId: string) => {
    if (!canManageServices) return;
    const option = existingStaffOptions.find((item) => item.id === optionId);
    if (!option) return;

    updateProviderRow(index, {
      id: option.provider.id || optionId,
      templateId: optionId,
      name: option.provider.name,
      location: option.provider.location,
      workFrom: option.provider.workFrom ?? '',
      workTo: option.provider.workTo ?? '',
      durationMinutes: option.provider.durationMinutes > 0 ? String(option.provider.durationMinutes) : '',
      price: option.provider.price > 0 ? String(option.provider.price) : '',
      photoUrl: option.provider.photoUrl ?? null,
    });
  };

  const removeProviderRow = (index: number) => {
    if (!canManageServices) return;
    setProviders((current) => current.filter((_, currentIndex) => currentIndex !== index));
  };

  const handlePhotoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!canManageServices) return;
    const file = event.target.files?.[0];
    if (!file) return;

    setError('');
    setIsImageProcessing(true);

    try {
      const compressedDataUrl = await prepareImageFile(file);
      setServicePhotoUrl(compressedDataUrl);
    } catch (err) {
      setError(err instanceof Error ? t(err.message) : t('Не удалось загрузить фото'));
    } finally {
      setIsImageProcessing(false);
      event.target.value = '';
    }
  };

  const handleProviderPhotoChange = async (index: number, event: ChangeEvent<HTMLInputElement>) => {
    if (!canManageServices) return;
    const file = event.target.files?.[0];
    if (!file) return;

    setError('');
    setIsImageProcessing(true);

    try {
      const compressedDataUrl = await prepareImageFile(file);
      updateProviderRow(index, { photoUrl: compressedDataUrl });
    } catch (err) {
      setError(err instanceof Error ? t(err.message) : t('Не удалось загрузить фото'));
    } finally {
      setIsImageProcessing(false);
      event.target.value = '';
    }
  };

  const createCategoryWithName = useCallback(async (rawName: string) => {
    if (!canManageServices) {
      setError(t('Только роль business может создавать, удалять и редактировать услуги'));
      return null;
    }

    const normalizedName = normalizeCategoryName(rawName);

    if (!selectedVenueId) {
      setError(t('Сначала создайте заведение'));
      return null;
    }

    if (!normalizedName) {
      setError(t('Название категории обязательно'));
      return null;
    }

    if (categories.some((category) => category.name.trim().toLowerCase() === normalizedName.toLowerCase())) {
      setError(t('Такая категория уже существует'));
      return null;
    }

    setIsCategorySaving(true);

    try {
      const isFirstCategory = categories.length === 0;
      const createdCategory = await createBusinessServiceCategory({
        venueId: selectedVenueId,
        name: normalizedName,
      });
      await loadPageData(selectedVenueId);
      setSelectedCategoryId(createdCategory.id);

      return {
        createdCategory,
        isFirstCategory,
      };
    } catch (err) {
      const message = err instanceof Error ? t(err.message) : t('Не удалось создать категорию');
      setError(message);
      return null;
    } finally {
      setIsCategorySaving(false);
    }
  }, [canManageServices, categories, loadPageData, selectedVenueId, t]);

  const handleCreateDialogCategory = async () => {
    setError('');
    setSuccessMessage('');

    const result = await createCategoryWithName(dialogCategoryName);
    if (!result) return;

    setDialogCategoryName('');
    setFormCategoryId(result.createdCategory.id);
    setIsDialogCategoryCreateOpen(false);
    setSuccessMessage(t('Категория создана и выбрана для сервиса'));
  };

  const handleCreateCategory = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccessMessage('');

    const result = await createCategoryWithName(categoryName);
    if (!result) return;

    setCategoryName('');

    if (result.isFirstCategory) {
      resetForm(result.createdCategory.id);
      setSuccessMessage(t('Категория создана. Теперь добавьте первый сервис.'));
      setIsDialogOpen(true);
      return;
    }

    setSuccessMessage(t('Категория создана'));
  };

  const closeCategoryEditDialog = useCallback(() => {
    setIsCategoryEditDialogOpen(false);
    setEditingCategory(null);
    setCategoryEditName('');
  }, []);

  const handleCategoryEditOpenChange = (open: boolean) => {
    if (open) {
      setIsCategoryEditDialogOpen(true);
      return;
    }

    closeCategoryEditDialog();
  };

  const handleUpdateCategory = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!canManageServices) {
      setError(t('Только роль business может создавать, удалять и редактировать услуги'));
      return;
    }

    if (!editingCategory || !selectedVenueId) {
      setError(t('Категория не найдена'));
      return;
    }

    const normalizedName = normalizeCategoryName(categoryEditName);

    if (!normalizedName) {
      setError(t('Название категории обязательно'));
      return;
    }

    if (
      categories.some((category) =>
        category.id !== editingCategory.id && category.name.trim().toLowerCase() === normalizedName.toLowerCase(),
      )
    ) {
      setError(t('Такая категория уже существует'));
      return;
    }

    if (editingCategory.name.trim().toLowerCase() === normalizedName.toLowerCase()) {
      closeCategoryEditDialog();
      return;
    }

    setIsCategorySaving(true);

    try {
      await updateBusinessServiceCategory(editingCategory.id, { name: normalizedName });
      await loadPageData(selectedVenueId);
      setSelectedCategoryId(editingCategory.id);
      closeCategoryEditDialog();
      setSuccessMessage(t('Категория обновлена'));
    } catch (err) {
      const message = err instanceof Error ? t(err.message) : t('Не удалось обновить категорию');
      setError(message);
    } finally {
      setIsCategorySaving(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!canManageServices) {
      setError(t('Только роль business может создавать, удалять и редактировать услуги'));
      return;
    }

    if (isImageProcessing) {
      setError(t('Дождитесь завершения обработки фото'));
      return;
    }

    const normalizedName = serviceName.trim();
    if (!normalizedName) {
      setError(t('Название сервиса обязательно'));
      return;
    }

    if (!selectedVenueId) {
      setError(t('Сначала создайте заведение'));
      return;
    }

    const targetCategoryId = formCategoryId || editingService?.categoryId || selectedCategoryId;
    if (!targetCategoryId) {
      setError(t('Сначала создайте категорию сервиса'));
      return;
    }

    if (providers.length === 0) {
      setError(t('Добавьте хотя бы одного специалиста для сервиса'));
      return;
    }

    const normalizedProviders: BusinessServiceProvider[] = [];
    const seenProviderKeys = new Set<string>();

    for (const provider of providers) {
      const name = normalizePersonName(provider.name);
      const location = normalizeLocation(provider.location);
      const workFrom = normalizeTimeValue(provider.workFrom);
      const workTo = normalizeTimeValue(provider.workTo);
      const durationMinutes = Number(normalizeInteger(provider.durationMinutes));
      const price = Number(normalizePriceInput(provider.price));

      if (!name) {
        setError(t('Укажите имя специалиста для каждой строки'));
        return;
      }

      if (!location) {
        setError(t('Укажите локацию для каждого специалиста'));
        return;
      }

      if (!workFrom) {
        setError(t('Укажите время начала работы для каждого специалиста'));
        return;
      }

      if (!workTo) {
        setError(t('Укажите время окончания работы для каждого специалиста'));
        return;
      }

      const workFromMinutes = toTimeMinutes(workFrom);
      const workToMinutes = toTimeMinutes(workTo);
      if (workFromMinutes === null || workToMinutes === null || workFromMinutes >= workToMinutes) {
        setError(t('Время окончания работы должно быть позже времени начала'));
        return;
      }

      if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
        setError(t('Укажите длительность сервиса в минутах для каждого специалиста'));
        return;
      }

      if (!Number.isFinite(price) || price <= 0) {
        setError(t('Укажите цену для каждого специалиста'));
        return;
      }

      const duplicateKey = `${name.toLowerCase()}::${location.toLowerCase()}`;
      if (seenProviderKeys.has(duplicateKey)) {
        setError(t('Один и тот же специалист не должен повторяться в сервисе'));
        return;
      }

      seenProviderKeys.add(duplicateKey);
      normalizedProviders.push({
        id: provider.id || createDraftId(),
        name,
        location,
        workFrom,
        workTo,
        durationMinutes,
        price,
        photoUrl: provider.photoUrl ?? null,
      });
    }

    setIsSaving(true);

    try {
      if (editingService) {
        await updateBusinessService(editingService.id, {
          categoryId: targetCategoryId,
          name: normalizedName,
          providers: normalizedProviders,
          photoUrl: servicePhotoUrl ?? null,
        });
        setSuccessMessage(t('Сервис обновлён'));
      } else {
        await createBusinessService({
          venueId: selectedVenueId,
          categoryId: targetCategoryId,
          name: normalizedName,
          providers: normalizedProviders,
          photoUrl: servicePhotoUrl ?? null,
        });
        setSuccessMessage(t('Сервис создан'));
      }

      await loadPageData(selectedVenueId);
      setSelectedCategoryId(targetCategoryId);
      closeDialog();
    } catch (err) {
      const message = err instanceof Error ? t(err.message) : t('Не удалось сохранить сервис');
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmId || !selectedVenueId) return;
    if (!canManageServices) return;

    setError('');
    setSuccessMessage('');

    try {
      await deleteBusinessService(deleteConfirmId);
      await loadPageData(selectedVenueId);
      setSuccessMessage(t('Сервис удалён'));
    } catch (err) {
      const message = err instanceof Error ? t(err.message) : t('Не удалось удалить сервис');
      setError(message);
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const normalizedCategoryEditName = normalizeCategoryName(categoryEditName);
  const isCategoryEditUnchanged = editingCategory
    ? editingCategory.name.trim().toLowerCase() === normalizedCategoryEditName.toLowerCase()
    : true;

  if (ownedVenues.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary/50">
          <Building2 className="h-7 w-7 text-muted-foreground/50" />
        </div>
        <p className="mb-4 text-muted-foreground">{t('Сначала создайте заведение')}</p>
        <Button onClick={() => navigate('/my-venues')}>{t('Создать заведение')}</Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-semibold tracking-tight text-foreground">{t('Услуги')}</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          {canManageServices
            ? t('Создавайте категории и сразу наполняйте их услугами без лишних шагов.')
            : t('Услуги доступны только для просмотра. Менять их может только роль business')}
        </p>
      </div>

      {ownedVenues.length > 1 ? (
        <Card className="border-border/40">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">{t('Заведение')}</Label>
              <Select value={selectedVenueId} onValueChange={setSelectedVenueId}>
                <SelectTrigger className="h-11 border-border/50 bg-input/50">
                  <SelectValue placeholder={t('Выберите заведение')} />
                </SelectTrigger>
                <SelectContent>
                  {ownedVenues.map((venue) => (
                    <SelectItem key={venue.id} value={venue.id}>
                      {venue.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {(error || successMessage) ? (
        <div className="space-y-2">
          {error ? (
            <Alert variant="destructive" className="animate-scale-in">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {successMessage ? (
            <Alert className="animate-scale-in border-emerald-800/40 bg-emerald-950/30">
              <AlertDescription className="text-emerald-300">{successMessage}</AlertDescription>
            </Alert>
          ) : null}
        </div>
      ) : null}

      <Tabs defaultValue="catalog" className="space-y-6">
        <TabsList className="grid h-11 w-full max-w-[420px] grid-cols-2">
          <TabsTrigger value="catalog">{t('Каталог услуг')}</TabsTrigger>
          <TabsTrigger value="slots">{t('Слоты бронирования')}</TabsTrigger>
        </TabsList>

        <TabsContent value="catalog" className="space-y-6">
          <Card className="border-border/40">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">{t('Категории сервисов')}</CardTitle>
              <CardDescription>
                {t('Категории нужны только для структуры. Сервис можно добавить сразу из любой категории.')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <form onSubmit={handleCreateCategory} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                <Input
                  value={categoryName}
                  onChange={(event) => setCategoryName(event.target.value)}
                  placeholder={t('Например: Стрижка')}
                  disabled={!canManageServices}
                  className="h-11 border-border/50 bg-input/50 focus:border-primary/60"
                />
                <Button type="submit" className="h-11 w-full" disabled={isCategorySaving || !canManageServices}>
                  <Plus className="mr-2 h-4 w-4" />
                  {isCategorySaving ? t('Создание…') : t('Создать категорию')}
                </Button>
              </form>

              {categories.length > 0 ? (
                <div className="overflow-x-auto pb-1">
                  <div className="flex min-w-max gap-3">
                    {categories.map((category) => {
                      const isSelected = category.id === selectedCategoryId;
                      const count = categoryServiceCount.get(category.id) ?? 0;

                      return (
                        <button
                          key={category.id}
                          type="button"
                          onClick={() => setSelectedCategoryId(category.id)}
                          className={`w-[240px] shrink-0 rounded-2xl border p-4 text-left transition-all ${
                            isSelected
                              ? 'border-primary/60 bg-primary/10 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]'
                              : 'border-border/45 bg-muted/10 hover:border-primary/35 hover:bg-primary/5'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-foreground">{category.name}</p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {t('Сервисов: {count}', { count })}
                              </p>
                            </div>
                            {isSelected ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 text-[11px] font-medium text-primary">
                                <Check className="h-3.5 w-3.5" />
                                {t('По умолчанию')}
                              </span>
                            ) : (
                              <span className="rounded-full border border-border/50 px-2.5 py-1 text-[11px] text-muted-foreground">
                                {t('Сделать основной')}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border/50 bg-muted/10 px-4 py-4 text-sm text-muted-foreground">
                  {t('Создайте первую категорию, чтобы начать добавлять сервисы.')}
                </div>
              )}
            </CardContent>
          </Card>

          {isLoading ? (
            <Card className="border-border/40">
              <CardContent className="py-16 text-center text-sm text-muted-foreground">
                {t('Загружаем сервисы…')}
              </CardContent>
            </Card>
          ) : categories.length === 0 ? (
            <Card className="border-border/40">
              <CardContent className="py-16 text-center">
                <div className="mx-auto max-w-md space-y-3">
                  <p className="text-lg font-medium text-foreground">{t('Сначала создайте категорию сервиса')}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('Сначала создайте категорию или добавьте её прямо в форме создания сервиса.')}
                  </p>
                  <Button type="button" className="mt-2 h-10" onClick={() => openCreateDialog()} disabled={!canManageServices}>
                    <Plus className="mr-2 h-4 w-4" />
                    {t('Добавить сервис')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : selectedCategory ? (
            <Card className="border-border/40">
              <CardHeader className="gap-4 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-xl">{selectedCategory.name}</CardTitle>
                  <CardDescription>
                    {t('Сервисов: {count}', { count: selectedCategoryServices.length })}
                  </CardDescription>
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                  {canManageServices ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 border-border/50"
                      onClick={() => openCategoryEditDialog(selectedCategory)}
                    >
                      <Edit2 className="mr-2 h-4 w-4" />
                      {t('Редактировать категорию')}
                    </Button>
                  ) : null}
                  <Button type="button" className="h-10 shrink-0" onClick={() => openCreateDialog(selectedCategory.id)} disabled={!canManageServices}>
                    <Plus className="mr-2 h-4 w-4" />
                    {t('Добавить сервис')}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {selectedCategoryServices.length > 0 ? (
                  <div className="overflow-hidden rounded-2xl border border-border/45 bg-muted/5">
                    <ScrollArea className="h-[420px] xl:h-[620px]">
                      <div className="space-y-3 p-3">
                        {selectedCategoryServices.map((service) => {
                          const priceSummary = buildServicePriceSummary(service.providers);

                          return (
                            <div
                              key={service.id}
                              className="flex flex-col rounded-2xl border border-border/45 bg-background/60 p-3"
                            >
                              {service.photoUrl ? (
                                <img
                                  src={service.photoUrl}
                                  alt={t('Фото сервиса {serviceName}', { serviceName: service.name })}
                                  className="h-40 w-full rounded-xl object-cover"
                                />
                              ) : (
                                <div className="flex h-28 w-full items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 via-secondary/25 to-muted/25">
                                  <Sparkles className="h-6 w-6 text-primary/70" />
                                </div>
                              )}

                              <div className="mt-3 space-y-3">
                                <div className="space-y-2">
                                  <p className="break-words text-sm font-semibold leading-snug text-foreground">
                                    {service.name}
                                  </p>
                                  <span className="inline-flex rounded-full border border-border/45 bg-input/20 px-2.5 py-1 text-[11px] text-muted-foreground">
                                    {t('Специалистов: {count}', { count: service.providers.length })}
                                  </span>
                                </div>

                                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                  {priceSummary ? (
                                    <span className="rounded-full border border-border/45 bg-input/20 px-2.5 py-1">
                                      {t('Цена: {value}', { value: priceSummary })}
                                    </span>
                                  ) : null}
                                  {service.providers[0]?.name ? (
                                    <span className="rounded-full border border-border/45 bg-input/20 px-2.5 py-1">
                                      {service.providers[0].name}
                                    </span>
                                  ) : null}
                                  {service.providers.length > 1 ? (
                                    <span className="rounded-full border border-border/45 bg-input/20 px-2.5 py-1">
                                      {t('Ещё {count}', { count: service.providers.length - 1 })}
                                    </span>
                                  ) : null}
                                </div>
                              </div>

                              {canManageServices ? (
                                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-9 w-full border-border/50 hover:border-primary/30 sm:flex-1"
                                    onClick={() => openEditDialog(service)}
                                  >
                                    <Edit2 className="mr-2 h-3.5 w-3.5" />
                                    {t('Редактировать')}
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-9 w-full border-red-900/30 px-3 text-red-400 hover:border-red-800/40 hover:bg-red-950/30 hover:text-red-300 sm:w-auto"
                                    onClick={() => setDeleteConfirmId(service.id)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border/50 bg-muted/10 px-5 py-5">
                    <p className="text-sm text-muted-foreground">{t('В этой категории пока нет сервисов.')}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="slots" className="space-y-6">
          {isLoading ? (
            <Card className="border-border/40">
              <CardContent className="py-16 text-center text-sm text-muted-foreground">
                {t('Загружаем сервисы…')}
              </CardContent>
            </Card>
          ) : services.length === 0 ? (
            <Card className="border-border/40">
              <CardContent className="py-16 text-center">
                <div className="mx-auto max-w-md space-y-3">
                  <p className="text-lg font-medium text-foreground">{t('Сначала добавьте сервис')}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('После этого здесь появятся слоты бронирования по специалистам и датам.')}
                  </p>
                  <Button type="button" className="mt-2 h-10" onClick={() => openCreateDialog()} disabled={!canManageServices}>
                    <Plus className="mr-2 h-4 w-4" />
                    {t('Добавить сервис')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card className="border-border/40">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">{t('Слоты бронирования')}</CardTitle>
                  <CardDescription>
                    {t('Выберите сервис, специалиста и дату, чтобы посмотреть занятые и свободные слоты.')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">{t('Сервис')}</Label>
                      <Select value={selectedSlotServiceId} onValueChange={setSelectedSlotServiceId}>
                        <SelectTrigger className="h-11 border-border/50 bg-input/50">
                          <SelectValue placeholder={t('Выберите сервис')} />
                        </SelectTrigger>
                        <SelectContent>
                          {services.map((service) => (
                            <SelectItem key={service.id} value={service.id}>
                              {service.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">{t('Специалист')}</Label>
                      <Select
                        value={selectedSlotProviderId}
                        onValueChange={setSelectedSlotProviderId}
                        disabled={!selectedSlotService || selectedSlotService.providers.length === 0}
                      >
                        <SelectTrigger className="h-11 border-border/50 bg-input/50">
                          <SelectValue placeholder={t('Выберите специалиста')} />
                        </SelectTrigger>
                        <SelectContent>
                          {(selectedSlotService?.providers ?? []).map((provider) => (
                            <SelectItem key={provider.id} value={provider.id}>
                              {provider.location ? `${provider.name} · ${provider.location}` : provider.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">{t('Дата')}</Label>
                    <HorizontalDayScroller
                      value={selectedSlotDate}
                      dates={slotDateOptions}
                      dateLocale={dateLocale}
                      onChange={setSelectedSlotDate}
                    />
                  </div>

                  {selectedSlotService && selectedSlotProvider ? (
                    <>
                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="rounded-2xl border border-border/50 bg-background/55 p-4">
                          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{t('Свободных слотов')}</p>
                          <p className="mt-2 text-2xl font-semibold text-foreground">{availableSlotCount}</p>
                        </div>
                        <div className="rounded-2xl border border-border/50 bg-background/55 p-4">
                          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{t('Занятых слотов')}</p>
                          <p className="mt-2 text-2xl font-semibold text-foreground">{busySlotCount}</p>
                        </div>
                        <div className="rounded-2xl border border-border/50 bg-background/55 p-4">
                          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{t('Активных броней')}</p>
                          <p className="mt-2 text-2xl font-semibold text-foreground">{activeDateServiceBookings.length}</p>
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="rounded-2xl border border-border/50 bg-muted/10 p-4">
                          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{t('Сервис')}</p>
                          <p className="mt-2 text-sm font-medium text-foreground">{selectedSlotService.name}</p>
                        </div>
                        <div className="rounded-2xl border border-border/50 bg-muted/10 p-4">
                          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{t('График')}</p>
                          <p className="mt-2 text-sm font-medium text-foreground">
                            {t('Доступно: {from} — {to}', {
                              from: selectedSlotProvider.workFrom?.trim() || '00:00',
                              to: selectedSlotProvider.workTo?.trim() || '24:00',
                            })}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-border/50 bg-muted/10 p-4">
                          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{t('Длительность')}</p>
                          <p className="mt-2 text-sm font-medium text-foreground">
                            {selectedSlotProvider.durationMinutes > 0
                              ? t('{count} мин', { count: selectedSlotProvider.durationMinutes })
                              : '—'}
                          </p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-border/50 bg-muted/10 px-5 py-5 text-sm text-muted-foreground">
                      {t('Выберите сервис, чтобы посмотреть персонал, график и цены.')}
                    </div>
                  )}
                </CardContent>
              </Card>

              {slotError ? (
                <Alert variant="destructive" className="animate-scale-in">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{slotError}</AlertDescription>
                </Alert>
              ) : null}

              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_380px]">
                <Card className="border-border/40">
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold">{t('Сетка слотов')}</CardTitle>
                    <CardDescription>
                      {t('Свободные слоты отображаются автоматически')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isBusySlotsLoading ? (
                      <div className="py-16 text-center text-sm text-muted-foreground">{t('Загружаем доступные слоты…')}</div>
                    ) : slotItems.length > 0 ? (
                      <div className="overflow-hidden rounded-2xl border border-border/45 bg-muted/5">
                        <ScrollArea className="h-[460px]">
                          <div className="space-y-2 p-3">
                            {slotItems.map((slot) => (
                              <div
                                key={`${slot.startTime}-${slot.endTime}`}
                                className={cn(
                                  'flex flex-col gap-3 rounded-2xl border p-4 transition-colors sm:flex-row sm:items-center sm:justify-between',
                                  slot.isBusy
                                    ? 'border-primary/25 bg-primary/[0.08]'
                                    : 'border-[hsl(var(--success)/0.24)] bg-[hsl(var(--success)/0.10)]',
                                )}
                              >
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <Clock3 className="h-4 w-4 text-muted-foreground" />
                                    <p className="text-sm font-semibold text-foreground">
                                      {slot.startTime} - {slot.endTime}
                                    </p>
                                  </div>
                                  <p className="mt-1 text-sm text-muted-foreground">
                                    {slot.bookingUserLabel ?? t('Свободный слот')}
                                  </p>
                                </div>
                                <span
                                  className={cn(
                                    'inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-medium',
                                    slot.isBusy
                                      ? 'border-primary/25 bg-primary/10 text-primary'
                                      : 'border-[hsl(var(--success)/0.24)] bg-[hsl(var(--success)/0.12)] text-[hsl(var(--success-foreground))]',
                                  )}
                                >
                                  {slot.isBusy ? t('Занято') : t('Доступно')}
                                </span>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-border/50 bg-muted/10 px-5 py-8 text-center text-sm text-muted-foreground">
                        {t('На выбранную дату слоты пока не найдены')}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-border/40">
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold">{t('Брони на выбранную дату')}</CardTitle>
                    <CardDescription>
                      {t('Здесь собраны активные и отменённые записи по выбранному специалисту.')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {activeDateServiceBookings.length > 0 ? (
                      <div className="space-y-2">
                        {activeDateServiceBookings.map((booking) => (
                          <div key={booking.id} className="rounded-2xl border border-border/50 bg-background/55 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-medium text-foreground">
                                {getServiceBookingUserLabel({
                                  userId: booking.userId,
                                  userEmail: booking.userEmail,
                                  userFirstName: booking.userFirstName,
                                  userLastName: booking.userLastName,
                                  t,
                                })}
                              </p>
                              <span className="inline-flex items-center rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
                                <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                                {booking.startTime} - {booking.endTime}
                              </span>
                            </div>
                            <p className="mt-2 text-xs text-muted-foreground">{booking.userEmail ?? t('Пользователь')}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-border/50 bg-muted/10 px-4 py-4 text-sm text-muted-foreground">
                        {t('Активных броней на выбранную дату пока нет')}
                      </div>
                    )}

                    {cancelledDateServiceBookings.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{t('Отменённые')}</p>
                        {cancelledDateServiceBookings.map((booking) => (
                          <div key={booking.id} className="rounded-2xl border border-border/50 bg-muted/10 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-medium text-foreground">
                                {getServiceBookingUserLabel({
                                  userId: booking.userId,
                                  userEmail: booking.userEmail,
                                  userFirstName: booking.userFirstName,
                                  userLastName: booking.userLastName,
                                  t,
                                })}
                              </p>
                              <span className="inline-flex items-center rounded-full border border-border/50 bg-background/55 px-2.5 py-1 text-[11px] text-muted-foreground">
                                {booking.startTime} - {booking.endTime}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={isCategoryEditDialogOpen} onOpenChange={handleCategoryEditOpenChange}>
        <DialogContent className="border-border/50 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('Редактировать категорию')}</DialogTitle>
            <DialogDescription>{t('Измените название категории')}</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdateCategory} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="category-edit-name" className="text-sm text-muted-foreground">
                {t('Название категории')}
              </Label>
              <Input
                id="category-edit-name"
                value={categoryEditName}
                onChange={(event) => setCategoryEditName(event.target.value)}
                placeholder={t('Например: Стрижка')}
                disabled={isCategorySaving || !canManageServices}
                className="h-11 border-border/50 bg-input/50 focus:border-primary/60"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="border-border/50"
                onClick={closeCategoryEditDialog}
                disabled={isCategorySaving}
              >
                {t('Отмена')}
              </Button>
              <Button
                type="submit"
                disabled={isCategorySaving || !canManageServices || !normalizedCategoryEditName || isCategoryEditUnchanged}
              >
                {isCategorySaving ? t('Сохранение…') : t('Сохранить')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-h-[94vh] overflow-y-auto border-border/50 sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingService ? t('Редактировать сервис') : t('Добавить сервис')}</DialogTitle>
            <DialogDescription>
              {editingService ? t('Измените параметры сервиса') : t('Заполните параметры нового сервиса')}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            <div className="space-y-5 py-4">
            {error ? (
              <Alert variant="destructive" className="animate-scale-in">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">{t('Заведение *')}</Label>
                <div className="rounded-xl border border-border/45 bg-input/20 px-3 py-3 text-sm text-foreground">
                  {selectedVenue?.name ?? t('Заведение')}
                </div>
                {ownedVenues.length > 1 ? (
                  <p className="text-xs text-muted-foreground/70">
                    {t('Если нужно другое заведение, смените его в селекторе над списком сервисов.')}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">{t('Категория сервиса *')}</Label>
                <Select value={formCategoryId || undefined} onValueChange={setFormCategoryId}>
                  <SelectTrigger className="h-11 border-border/50 bg-input/50">
                    <SelectValue placeholder={t('Выберите категорию сервиса')} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="pt-1">
                  {!isDialogCategoryCreateOpen ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-8 px-0 text-sm text-primary hover:bg-transparent hover:text-primary/80"
                      onClick={() => setIsDialogCategoryCreateOpen(true)}
                      disabled={!canManageServices}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      {t('Добавить категорию')}
                    </Button>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border/45 bg-muted/10 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs text-muted-foreground">{t('Новая категория')}</p>
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-8 px-2 text-xs text-muted-foreground hover:bg-transparent"
                          onClick={() => {
                            setIsDialogCategoryCreateOpen(false);
                            setDialogCategoryName('');
                          }}
                        >
                          {t('Отмена')}
                        </Button>
                      </div>
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <Input
                          value={dialogCategoryName}
                          onChange={(event) => setDialogCategoryName(event.target.value)}
                          placeholder={t('Новая категория')}
                          disabled={!canManageServices}
                          className="h-10 border-border/50 bg-input/50 focus:border-primary/60"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="h-10 shrink-0 border-border/50"
                          disabled={isCategorySaving || !canManageServices}
                          onClick={() => void handleCreateDialogCategory()}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          {isCategorySaving ? t('Создание…') : t('Создать и выбрать')}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="service-name" className="text-sm text-muted-foreground">
                  {t('Название сервиса *')}
                </Label>
                <Input
                  id="service-name"
                  value={serviceName}
                  onChange={(event) => setServiceName(event.target.value)}
                  placeholder={t('Например: Стрижка')}
                  disabled={!canManageServices}
                  className="h-11 border-border/50 bg-input/50 focus:border-primary/60"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="service-photo" className="text-sm text-muted-foreground">
                  {t('Фото сервиса')}
                </Label>
                <Input
                  id="service-photo"
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  disabled={isImageProcessing || !canManageServices}
                  className="h-11 border-border/50 bg-input/50 file:mr-3 file:text-xs file:font-medium"
                />
                <p className="text-xs text-muted-foreground/70">
                  {t('JPG/PNG/WebP, фото автоматически сжимается перед сохранением')}
                </p>

                {servicePhotoUrl ? (
                  <div className="space-y-3 rounded-xl border border-border/40 bg-muted/10 p-3">
                    <div className="relative aspect-[16/10] overflow-hidden rounded-lg border border-border/50 bg-muted/20">
                      <img
                        src={servicePhotoUrl}
                        alt={t('Предпросмотр фото сервиса')}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 border-border/50"
                      onClick={() => setServicePhotoUrl(null)}
                      disabled={!canManageServices}
                    >
                      <X className="mr-2 h-4 w-4" />
                      {t('Удалить фото')}
                    </Button>
                  </div>
                ) : (
                  <div className="flex h-36 items-center justify-center rounded-xl border border-dashed border-border/50 bg-muted/10 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Upload className="h-4 w-4" />
                      <span>{t('Фото пока не добавлено')}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label className="text-sm text-muted-foreground">{t('Персонал сервиса *')}</Label>
                    <p className="mt-1 text-xs text-muted-foreground/70">
                      {t('Для каждого специалиста укажите имя, локацию, рабочие часы, длительность, цену и фото.')}
                    </p>
                  </div>
                  <Button type="button" variant="outline" className="h-9 border-border/50" onClick={addProviderRow} disabled={!canManageServices}>
                    <Plus className="mr-2 h-4 w-4" />
                    {t('Добавить специалиста')}
                  </Button>
                </div>

                <div className="space-y-3">
                  {providers.map((provider, index) => (
                    <div key={provider.id} className="space-y-4 rounded-xl border border-border/45 bg-muted/10 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                          <UserRound className="h-4 w-4 text-primary" />
                          <span>{t('Специалист #{index}', { index: index + 1 })}</span>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-9 border-border/50 px-3"
                          onClick={() => removeProviderRow(index)}
                          disabled={providers.length === 1 || !canManageServices}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        {existingStaffOptions.length > 0 ? (
                          <div className="space-y-2 md:col-span-2">
                            <Label className="text-xs text-muted-foreground">{t('Существующий персонал')}</Label>
                            <Select
                              value={provider.templateId || undefined}
                              onValueChange={(value) => handleSelectExistingProvider(index, value)}
                              disabled={!canManageServices}
                            >
                              <SelectTrigger className="h-11 border-border/50 bg-input/50">
                                <SelectValue placeholder={t('Выберите существующего специалиста')} />
                              </SelectTrigger>
                              <SelectContent>
                                {existingStaffOptions.map((option) => (
                                  <SelectItem key={option.id} value={option.id}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground/70">
                              {t('Можно выбрать уже созданного специалиста и не заполнять всё заново.')}
                            </p>
                          </div>
                        ) : null}

                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">{t('Имя специалиста *')}</Label>
                          <Input
                            value={provider.name}
                            onChange={(event) => updateProviderRow(index, { name: event.target.value, templateId: provider.templateId })}
                            placeholder={t('Например: Азиза')}
                            disabled={!canManageServices}
                            className="h-11 border-border/50 bg-input/50 focus:border-primary/60"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">{t('Локация специалиста *')}</Label>
                          <Input
                            value={provider.location}
                            onChange={(event) => updateProviderRow(index, { location: event.target.value })}
                            placeholder={t('Например: Кабинет 3')}
                            disabled={!canManageServices}
                            className="h-11 border-border/50 bg-input/50 focus:border-primary/60"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">{t('Работает с *')}</Label>
                          <Input
                            type="time"
                            value={provider.workFrom}
                            onChange={(event) => updateProviderRow(index, { workFrom: event.target.value })}
                            disabled={!canManageServices}
                            className="h-11 border-border/50 bg-input/50 focus:border-primary/60"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">{t('Работает до *')}</Label>
                          <Input
                            type="time"
                            value={provider.workTo}
                            onChange={(event) => updateProviderRow(index, { workTo: event.target.value })}
                            disabled={!canManageServices}
                            className="h-11 border-border/50 bg-input/50 focus:border-primary/60"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">{t('Длительность (минуты) *')}</Label>
                          <Input
                            value={provider.durationMinutes}
                            onChange={(event) => updateProviderRow(index, { durationMinutes: normalizeInteger(event.target.value) })}
                            inputMode="numeric"
                            placeholder={t('Например: 45')}
                            disabled={!canManageServices}
                            className="h-11 border-border/50 bg-input/50 focus:border-primary/60"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">{t('Цена за услугу *')}</Label>
                          <Input
                            value={provider.price}
                            onChange={(event) => updateProviderRow(index, { price: normalizePriceInput(event.target.value) })}
                            inputMode="decimal"
                            placeholder={t('Например: 120000')}
                            disabled={!canManageServices}
                            className="h-11 border-border/50 bg-input/50 focus:border-primary/60"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">{t('Фото специалиста')}</Label>
                        <div className="grid gap-3 md:grid-cols-[120px_minmax(0,1fr)]">
                          <div className="flex h-[120px] items-center justify-center overflow-hidden rounded-xl border border-border/45 bg-input/20">
                            {provider.photoUrl ? (
                              <img
                                src={provider.photoUrl}
                                alt={t('Фото специалиста {personName}', { personName: provider.name || String(index + 1) })}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
                                <ImagePlus className="h-5 w-5" />
                                <span>{t('Фото специалиста пока не добавлено')}</span>
                              </div>
                            )}
                          </div>

                          <div className="space-y-3">
                            <Input
                              type="file"
                              accept="image/*"
                              onChange={(event) => void handleProviderPhotoChange(index, event)}
                              disabled={isImageProcessing || !canManageServices}
                              className="h-11 border-border/50 bg-input/50 file:mr-3 file:text-xs file:font-medium"
                            />
                            {provider.photoUrl ? (
                              <Button
                                type="button"
                                variant="outline"
                                className="h-9 border-border/50"
                                onClick={() => updateProviderRow(index, { photoUrl: null })}
                                disabled={!canManageServices}
                              >
                                <X className="mr-2 h-4 w-4" />
                                {t('Удалить фото специалиста')}
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" className="border-border/50" onClick={closeDialog} disabled={isSaving}>
                {t('Отмена')}
              </Button>
              <Button type="submit" disabled={isSaving || isImageProcessing || !canManageServices}>
                {isSaving ? t('Сохранение…') : editingService ? t('Сохранить') : t('Добавить')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteConfirmId)} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Удалить сервис')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('Вы уверены, что хотите удалить этот сервис?')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Отмена')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>{t('Удалить')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
