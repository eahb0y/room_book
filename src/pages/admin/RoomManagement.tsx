import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Building2, Clock3, DoorOpen, Edit2, Globe, ListPlus, MapPin, Plus, ShieldCheck, Star, Trash2, Users, X } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useVenueStore } from '@/store/venueStore';
import { RoomPhotoGallery } from '@/components/RoomPhotoGallery';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { getRoomPhotoUrls } from '@/lib/roomPhotos';
import { cn } from '@/lib/utils';
import type { Room } from '@/types';
import { useI18n } from '@/i18n/useI18n';
import { canManageBusinessResources, getAccessibleBusinessVenues, isBusinessPortalActive } from '@/lib/businessAccess';

const MAX_ROOM_PHOTO_SIDE = 1400;
const MAX_ROOM_PHOTO_BYTES = 1_500_000;
const ROOM_PHOTO_QUALITY = 0.82;
const MAX_ROOM_PHOTOS = 8;
const TIME_STEP_MINUTES = 15;
const MINUTES_IN_DAY = 24 * 60;
const DEFAULT_AVAILABLE_FROM = '00:00';
const DEFAULT_AVAILABLE_TO = '24:00';
const DEFAULT_MIN_BOOKING_MINUTES = 30;
const DEFAULT_MAX_BOOKING_MINUTES = 240;
const DEFAULT_ROOM_SERVICE_OPTIONS = [
  'Wi-Fi',
  'Проектор',
  'Экран',
  'Флипчарт',
  'Кондиционер',
  'Кофе/чай',
  'Парковка',
  'Видеосвязь',
  'Ресепшен',
  'Вода',
];

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
      const scale = longestSide > MAX_ROOM_PHOTO_SIDE ? MAX_ROOM_PHOTO_SIDE / longestSide : 1;
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
      resolve(canvas.toDataURL('image/jpeg', ROOM_PHOTO_QUALITY));
    };
    img.onerror = () => reject(new Error('Не удалось обработать изображение'));
    img.src = source;
  });

const estimateDataUrlBytes = (dataUrl: string) => {
  const base64 = dataUrl.split(',')[1];
  if (!base64) return 0;
  return Math.ceil((base64.length * 3) / 4);
};

const normalizeService = (value: string) => value.trim().replace(/\s+/g, ' ');

const toTime = (totalMinutes: number) => {
  if (totalMinutes >= MINUTES_IN_DAY) return '24:00';
  const safeMinutes = Math.max(0, totalMinutes);
  const hour = Math.floor(safeMinutes / 60).toString().padStart(2, '0');
  const minute = (safeMinutes % 60).toString().padStart(2, '0');
  return `${hour}:${minute}`;
};

const toMinutes = (time: string) => {
  if (time === '24:00') return MINUTES_IN_DAY;
  const [hour, minute] = time.split(':');
  return parseInt(hour, 10) * 60 + parseInt(minute, 10);
};

const TIME_OPTIONS = Array.from(
  { length: MINUTES_IN_DAY / TIME_STEP_MINUTES + 1 },
  (_, index) => toTime(index * TIME_STEP_MINUTES),
);

export default function RoomManagement() {
  const { t } = useI18n();
  const { user, portal } = useAuthStore();
  const navigate = useNavigate();
  const isBusinessPortal = isBusinessPortalActive(user, portal);
  const venues = useVenueStore((state) => state.venues);
  const allRooms = useVenueStore((state) => state.rooms);
  const createRoom = useVenueStore((state) => state.createRoom);
  const updateRoom = useVenueStore((state) => state.updateRoom);
  const deleteRoom = useVenueStore((state) => state.deleteRoom);

  const businessVenues = useMemo(() => getAccessibleBusinessVenues(user, venues), [user, venues]);
  const canManageRooms = canManageBusinessResources(user);
  const ownedVenueIds = useMemo(() => new Set(businessVenues.map((venue) => venue.id)), [businessVenues]);
  const [selectedVenueId, setSelectedVenueId] = useState('');
  const [formVenueId, setFormVenueId] = useState('');
  const selectedVenue = useMemo(
    () => businessVenues.find((venue) => venue.id === selectedVenueId) ?? null,
    [businessVenues, selectedVenueId],
  );
  const rooms = useMemo(
    () => allRooms.filter((room) => room.venueId === selectedVenueId && ownedVenueIds.has(room.venueId)),
    [allRooms, ownedVenueIds, selectedVenueId],
  );

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [locationLabel, setLocationLabel] = useState('');
  const [accessType, setAccessType] = useState<Room['accessType']>('public');
  const [availableFrom, setAvailableFrom] = useState(DEFAULT_AVAILABLE_FROM);
  const [availableTo, setAvailableTo] = useState(DEFAULT_AVAILABLE_TO);
  const [minBookingMinutes, setMinBookingMinutes] = useState(DEFAULT_MIN_BOOKING_MINUTES.toString());
  const [maxBookingMinutes, setMaxBookingMinutes] = useState(DEFAULT_MAX_BOOKING_MINUTES.toString());
  const [capacity, setCapacity] = useState('');
  const [services, setServices] = useState<string[]>([]);
  const [customService, setCustomService] = useState('');
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [isImageProcessing, setIsImageProcessing] = useState(false);
  const [error, setError] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !isBusinessPortal) {
      navigate('/');
      return;
    }
  }, [isBusinessPortal, user, navigate]);

  useEffect(() => {
    setSelectedPhotoIndex((prev) => {
      if (photoUrls.length === 0) return 0;
      return Math.min(prev, photoUrls.length - 1);
    });
  }, [photoUrls.length]);

  useEffect(() => {
    if (businessVenues.length === 0) {
      setSelectedVenueId('');
      return;
    }

    setSelectedVenueId((current) =>
      current && businessVenues.some((venue) => venue.id === current) ? current : businessVenues[0]?.id ?? '',
    );
  }, [businessVenues]);

  const handleOpenDialog = (room?: Room) => {
    if (!canManageRooms) return;
    if (room) {
      setEditingRoom(room);
      setFormVenueId(room.venueId);
      setName(room.name);
      setDescription(room.description ?? '');
      setLocationLabel(room.location ?? '');
      setAccessType(room.accessType ?? 'public');
      setAvailableFrom(room.availableFrom ?? DEFAULT_AVAILABLE_FROM);
      setAvailableTo(room.availableTo ?? DEFAULT_AVAILABLE_TO);
      setMinBookingMinutes((room.minBookingMinutes ?? DEFAULT_MIN_BOOKING_MINUTES).toString());
      setMaxBookingMinutes((room.maxBookingMinutes ?? DEFAULT_MAX_BOOKING_MINUTES).toString());
      setCapacity(room.capacity.toString());
      setServices(room.services ?? []);
      setPhotoUrls(getRoomPhotoUrls(room));
    } else {
      setEditingRoom(null);
      setFormVenueId(selectedVenueId || (businessVenues[0]?.id ?? ''));
      setName('');
      setDescription('');
      setLocationLabel('');
      setAccessType('public');
      setAvailableFrom(DEFAULT_AVAILABLE_FROM);
      setAvailableTo(DEFAULT_AVAILABLE_TO);
      setMinBookingMinutes(DEFAULT_MIN_BOOKING_MINUTES.toString());
      setMaxBookingMinutes(DEFAULT_MAX_BOOKING_MINUTES.toString());
      setCapacity('');
      setServices([]);
      setPhotoUrls([]);
    }
    setCustomService('');
    setSelectedPhotoIndex(0);
    setError('');
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingRoom(null);
    setFormVenueId('');
    setName('');
    setDescription('');
    setLocationLabel('');
    setAccessType('public');
    setAvailableFrom(DEFAULT_AVAILABLE_FROM);
    setAvailableTo(DEFAULT_AVAILABLE_TO);
    setMinBookingMinutes(DEFAULT_MIN_BOOKING_MINUTES.toString());
    setMaxBookingMinutes(DEFAULT_MAX_BOOKING_MINUTES.toString());
    setCapacity('');
    setServices([]);
    setCustomService('');
    setPhotoUrls([]);
    setSelectedPhotoIndex(0);
    setIsImageProcessing(false);
    setError('');
  };

  const toggleService = (serviceOption: string) => {
    const normalized = normalizeService(serviceOption);
    if (!normalized) return;

    setServices((prev) =>
      prev.includes(normalized)
        ? prev.filter((value) => value !== normalized)
        : [...prev, normalized],
    );
  };

  const addCustomService = () => {
    const normalized = normalizeService(customService);
    if (!normalized) return;
    if (services.includes(normalized)) {
      setCustomService('');
      return;
    }
    setServices((prev) => [...prev, normalized]);
    setCustomService('');
  };

  const removeService = (serviceOption: string) => {
    setServices((prev) => prev.filter((value) => value !== serviceOption));
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    if (photoUrls.length + files.length > MAX_ROOM_PHOTOS) {
      setError(t('Можно добавить максимум {count} фото', { count: MAX_ROOM_PHOTOS }));
      e.target.value = '';
      return;
    }

    setError('');
    setIsImageProcessing(true);

    try {
      const processedPhotos: string[] = [];

      for (const file of files) {
        if (!file.type.startsWith('image/')) {
          throw new Error('Можно загружать только изображения');
        }

        const rawDataUrl = await readFileAsDataUrl(file);
        const compressedDataUrl = await compressImageDataUrl(rawDataUrl);
        const imageBytes = estimateDataUrlBytes(compressedDataUrl);

        if (imageBytes > MAX_ROOM_PHOTO_BYTES) {
          throw new Error('Одно из фото слишком большое. Выберите изображение меньшего размера');
        }

        processedPhotos.push(compressedDataUrl);
      }

      setPhotoUrls((prev) => [...prev, ...processedPhotos]);
      if (photoUrls.length === 0 && processedPhotos.length > 0) {
        setSelectedPhotoIndex(0);
      }
    } catch (err) {
      setError(err instanceof Error ? t(err.message) : t('Не удалось загрузить фото'));
    } finally {
      setIsImageProcessing(false);
      e.target.value = '';
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotoUrls((prev) => prev.filter((_, i) => i !== index));
    setSelectedPhotoIndex((prev) => {
      if (prev > index) return prev - 1;
      if (prev === index) return Math.max(prev - 1, 0);
      return prev;
    });
  };

  const handleSetCoverPhoto = (index: number) => {
    if (index === 0) return;

    setPhotoUrls((prev) => {
      if (index < 0 || index >= prev.length) return prev;

      const next = [...prev];
      const [selected] = next.splice(index, 1);
      if (!selected) return prev;
      return [selected, ...next];
    });
    setSelectedPhotoIndex(0);
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (open) {
      setIsDialogOpen(true);
      return;
    }

    handleCloseDialog();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!canManageRooms) {
      setError(t('Только роль business может создавать, удалять и редактировать комнаты'));
      return;
    }

    if (isImageProcessing) {
      setError(t('Дождитесь завершения обработки фото'));
      return;
    }

    if (!name.trim()) {
      setError(t('Название комнаты обязательно'));
      return;
    }

    if (!description.trim()) {
      setError(t('Описание комнаты обязательно'));
      return;
    }

    if (!locationLabel.trim()) {
      setError(t('Укажите location комнаты'));
      return;
    }

    const capacityNum = parseInt(capacity, 10);
    if (isNaN(capacityNum) || capacityNum < 1) {
      setError(t('Вместимость должна быть числом больше 0'));
      return;
    }

    const availableFromMinutes = toMinutes(availableFrom);
    const availableToMinutes = toMinutes(availableTo);
    if (!Number.isFinite(availableFromMinutes) || !Number.isFinite(availableToMinutes)) {
      setError(t('Укажите корректное время доступности комнаты'));
      return;
    }

    if (availableFromMinutes >= availableToMinutes) {
      setError(t('Время окончания доступности должно быть позже времени начала'));
      return;
    }

    const minBookingMinutesNum = parseInt(minBookingMinutes, 10);
    const maxBookingMinutesNum = parseInt(maxBookingMinutes, 10);
    if (isNaN(minBookingMinutesNum) || minBookingMinutesNum < TIME_STEP_MINUTES || minBookingMinutesNum % TIME_STEP_MINUTES !== 0) {
      setError(t('Минимальная длительность должна быть кратна {step} минутам', { step: TIME_STEP_MINUTES }));
      return;
    }

    if (isNaN(maxBookingMinutesNum) || maxBookingMinutesNum < TIME_STEP_MINUTES || maxBookingMinutesNum % TIME_STEP_MINUTES !== 0) {
      setError(t('Максимальная длительность должна быть кратна {step} минутам', { step: TIME_STEP_MINUTES }));
      return;
    }

    if (maxBookingMinutesNum < minBookingMinutesNum) {
      setError(t('Максимальная длительность не может быть меньше минимальной'));
      return;
    }

    const availabilityWindowMinutes = availableToMinutes - availableFromMinutes;
    if (minBookingMinutesNum > availabilityWindowMinutes) {
      setError(t('Минимальная длительность не помещается в окно доступности комнаты'));
      return;
    }

    if (maxBookingMinutesNum > availabilityWindowMinutes) {
      setError(t('Максимальная длительность не может превышать окно доступности комнаты'));
      return;
    }

    const normalizedServices = services.map(normalizeService).filter(Boolean);
    if (normalizedServices.length === 0) {
      setError(t('Выберите хотя бы одну услугу для комнаты'));
      return;
    }

    const targetVenueId = editingRoom?.venueId ?? formVenueId;
    if (!targetVenueId) {
      setError(t('Выберите заведение'));
      return;
    }

    const roomName = name.trim();
    const roomDescription = description.trim();
    const roomLocation = locationLabel.trim();

    try {
      if (editingRoom) {
        await updateRoom(editingRoom.id, {
          name: roomName,
          description: roomDescription,
          location: roomLocation,
          accessType,
          availableFrom,
          availableTo,
          minBookingMinutes: minBookingMinutesNum,
          maxBookingMinutes: maxBookingMinutesNum,
          capacity: capacityNum,
          services: normalizedServices,
          photoUrls,
          photoUrl: photoUrls[0] ?? null,
        });
      } else {
        await createRoom({
          name: roomName,
          description: roomDescription,
          location: roomLocation,
          accessType,
          availableFrom,
          availableTo,
          minBookingMinutes: minBookingMinutesNum,
          maxBookingMinutes: maxBookingMinutesNum,
          capacity: capacityNum,
          services: normalizedServices,
          venueId: targetVenueId,
          photoUrls,
          photoUrl: photoUrls[0] ?? null,
        });
      }
      handleCloseDialog();
    } catch (err) {
      setError(err instanceof Error ? t(err.message) : t('Не удалось сохранить комнату'));
    }
  };

  const handleDelete = async (roomId: string) => {
    if (!canManageRooms) return;
    await deleteRoom(roomId);
    setDeleteConfirmId(null);
  };

  const selectedPhoto = photoUrls[selectedPhotoIndex] ?? photoUrls[0] ?? null;

  if (businessVenues.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-16 h-16 rounded-2xl bg-secondary/50 flex items-center justify-center mb-5">
          <Building2 className="h-7 w-7 text-muted-foreground/50" />
        </div>
        <p className="text-muted-foreground mb-4">{t('Сначала создайте заведение')}</p>
        <Button onClick={() => navigate('/my-venues')}>{t('Создать заведение')}</Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-semibold text-foreground tracking-tight">
            {t('Управление комнатами')}
          </h1>
          <p className="text-muted-foreground mt-2">
            {canManageRooms
              ? t('Добавляйте и управляйте переговорными комнатами')
              : t('Комнаты доступны только для просмотра. Изменять их может только роль business')}
          </p>
        </div>
        {canManageRooms ? (
          <Button onClick={() => handleOpenDialog()} className="flex items-center gap-2 h-11 shrink-0">
            <Plus className="h-4 w-4" />
            <span>{t('Добавить комнату')}</span>
          </Button>
        ) : null}
      </div>

      {businessVenues.length > 1 ? (
        <Card className="border-border/40">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">{t('Заведение')}</Label>
              <Select value={selectedVenueId} onValueChange={setSelectedVenueId}>
                <SelectTrigger className="h-11 border-border/50 bg-input/50">
                  <SelectValue placeholder={t('Выберите заведение')} />
                </SelectTrigger>
                <SelectContent>
                  {businessVenues.map((venue) => (
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

      {rooms.length === 0 ? (
        <Card className="border-border/40 animate-fade-up">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-secondary/50 flex items-center justify-center mb-5">
              <DoorOpen className="h-7 w-7 text-muted-foreground/40" />
            </div>
            <p className="text-muted-foreground mb-4">
              {selectedVenue ? t('В этом заведении пока нет комнат') : t('У вас пока нет комнат')}
            </p>
            {canManageRooms ? <Button onClick={() => handleOpenDialog()}>{t('Добавить первую комнату')}</Button> : null}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {rooms.map((room, i) => {
            const roomPhotos = getRoomPhotoUrls(room);

            return (
              <Card key={room.id} className={`card-hover stagger-${Math.min(i + 1, 6)} animate-fade-up`}>
                {roomPhotos.length > 0 ? (
                  <RoomPhotoGallery
                    photos={roomPhotos}
                    roomName={room.name}
                    imageContainerClassName="w-full aspect-[16/10] rounded-t-xl border-x-0 border-t-0 border-b border-border/40 bg-muted/30"
                  />
                ) : null}
                <CardHeader className={`pb-3 ${roomPhotos.length > 0 ? 'pt-4' : ''}`}>
                  <CardTitle className="flex items-center gap-2.5 text-base">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <DoorOpen className="h-4 w-4 text-primary" />
                    </div>
                    <span className="font-body font-semibold truncate">{room.name}</span>
                  </CardTitle>
                  <div className="space-y-1.5 pl-[42px]">
                    <CardDescription className="flex items-center gap-2">
                      <Users className="h-3.5 w-3.5" />
                      <span>{t('Вместимость: {count} человек', { count: room.capacity })}</span>
                    </CardDescription>
                    {room.location ? (
                      <CardDescription className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5" />
                        <span>{room.location}</span>
                      </CardDescription>
                    ) : null}
                    <CardDescription className="flex items-center gap-2">
                      {room.accessType === 'public' ? (
                        <Globe className="h-3.5 w-3.5" />
                      ) : (
                        <ShieldCheck className="h-3.5 w-3.5" />
                      )}
                      <span>
                        {room.accessType === 'public'
                          ? t('Доступ: Публичная')
                          : t('Доступ: Только резиденты')}
                      </span>
                    </CardDescription>
                    <CardDescription className="flex items-center gap-2">
                      <Clock3 className="h-3.5 w-3.5" />
                      <span>
                        {t('Доступно: {from} — {to}', { from: room.availableFrom, to: room.availableTo })}
                      </span>
                    </CardDescription>
                    <CardDescription className="flex items-center gap-2">
                      <Clock3 className="h-3.5 w-3.5" />
                      <span>
                        {t('Бронь: от {min} до {max} мин', { min: room.minBookingMinutes, max: room.maxBookingMinutes })}
                      </span>
                    </CardDescription>
                    {room.description ? (
                      <p className="line-clamp-2 text-xs text-muted-foreground/90">{room.description}</p>
                    ) : null}
                    {room.services.length > 0 ? (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {room.services.slice(0, 3).map((service) => (
                          <span
                            key={`${room.id}-${service}`}
                            className="rounded-full border border-border/45 bg-input/30 px-2 py-0.5 text-[11px] text-muted-foreground"
                          >
                            {service}
                          </span>
                        ))}
                        {room.services.length > 3 ? (
                          <span className="rounded-full border border-border/45 bg-input/20 px-2 py-0.5 text-[11px] text-muted-foreground">
                            +{room.services.length - 3}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    {canManageRooms ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenDialog(room)}
                          className="flex-1 flex items-center justify-center gap-2 h-9 border-border/50 hover:border-primary/30"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                          <span>{t('Редактировать')}</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleteConfirmId(room.id)}
                          className="h-9 px-3 border-red-900/30 text-red-400 hover:bg-red-950/30 hover:text-red-300 hover:border-red-800/40"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ) : (
                      <div className="text-xs text-muted-foreground">
                        {t('Редактирование и удаление доступны только роли business')}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-h-[94vh] overflow-y-auto border-border/50 sm:max-w-4xl lg:max-w-5xl">
          <DialogHeader>
            <DialogTitle>
              {editingRoom ? t('Редактировать комнату') : t('Добавить комнату')}
            </DialogTitle>
            <DialogDescription>
              {editingRoom ? t('Измените информацию о комнате') : t('Заполните информацию о новой комнате')}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              {error && (
                <Alert variant="destructive" className="animate-scale-in">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">{t('Заведение *')}</Label>
                <Select
                  value={editingRoom ? editingRoom.venueId : formVenueId}
                  onValueChange={setFormVenueId}
                  disabled={Boolean(editingRoom)}
                >
                  <SelectTrigger className="h-11 border-border/50 bg-input/50">
                    <SelectValue placeholder={t('Выберите заведение')} />
                  </SelectTrigger>
                  <SelectContent>
                    {businessVenues.map((venue) => (
                      <SelectItem key={venue.id} value={venue.id}>
                        {venue.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {editingRoom ? (
                  <p className="text-xs text-muted-foreground/70">
                    {t('Для переноса существующей комнаты в другое заведение создайте новую комнату в нужном заведении.')}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm text-muted-foreground">{t('Название комнаты *')}</Label>
                <Input
                  id="name"
                  placeholder={t('Например: Переговорная А')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-11 bg-input/50 border-border/50 focus:border-primary/60 transition-colors"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm text-muted-foreground">{t('Описание *')}</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder={t('Опишите комнату и формат использования')}
                  className="bg-input/50 border-border/50 focus:border-primary/60 transition-colors resize-none"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location" className="text-sm text-muted-foreground">{t('Location *')}</Label>
                <Input
                  id="location"
                  placeholder={t('Например: 2 этаж, блок B')}
                  value={locationLabel}
                  onChange={(e) => setLocationLabel(e.target.value)}
                  className="h-11 bg-input/50 border-border/50 focus:border-primary/60 transition-colors"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">{t('Тип доступности комнаты *')}</Label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setAccessType('public')}
                    className={cn(
                      'h-auto min-h-11 justify-start border-border/50 py-2.5 whitespace-normal text-left',
                      accessType === 'public' ? 'border-primary/60 bg-primary/15 text-primary' : '',
                    )}
                  >
                    <Globe className="mr-2 h-4 w-4 shrink-0" />
                    <span className="min-w-0 break-words leading-snug">
                      {t('Публичная (доступна всем)')}
                    </span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setAccessType('residents_only')}
                    className={cn(
                      'h-auto min-h-11 justify-start border-border/50 py-2.5 whitespace-normal text-left',
                      accessType === 'residents_only' ? 'border-primary/60 bg-primary/15 text-primary' : '',
                    )}
                  >
                    <ShieldCheck className="mr-2 h-4 w-4 shrink-0" />
                    <span className="min-w-0 break-words leading-snug">
                      {t('Закрытая (только резиденты)')}
                    </span>
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground/70">
                  {accessType === 'public'
                    ? t('Комнату увидят и смогут бронировать все авторизованные пользователи.')
                    : t('Комнату увидят и смогут бронировать только резиденты вашего бизнеса.')}
                </p>
              </div>
              <div className="space-y-3">
                <Label className="text-sm text-muted-foreground">{t('Доступность комнаты по времени *')}</Label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground/80">{t('Доступно с')}</p>
                    <Select value={availableFrom} onValueChange={setAvailableFrom}>
                      <SelectTrigger className="h-11 border-border/50 bg-input/50">
                        <SelectValue placeholder={t('Выберите время')} />
                      </SelectTrigger>
                      <SelectContent>
                        {TIME_OPTIONS.slice(0, -1).map((time) => (
                          <SelectItem key={`from-${time}`} value={time}>
                            {time}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground/80">{t('Доступно до')}</p>
                    <Select value={availableTo} onValueChange={setAvailableTo}>
                      <SelectTrigger className="h-11 border-border/50 bg-input/50">
                        <SelectValue placeholder={t('Выберите время')} />
                      </SelectTrigger>
                      <SelectContent>
                        {TIME_OPTIONS.slice(1).map((time) => (
                          <SelectItem key={`to-${time}`} value={time}>
                            {time}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <Label className="text-sm text-muted-foreground">{t('Ограничения длительности брони *')}</Label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground/80">{t('Минимум (минут)')}</p>
                    <Input
                      type="number"
                      min={TIME_STEP_MINUTES}
                      step={TIME_STEP_MINUTES}
                      value={minBookingMinutes}
                      onChange={(e) => setMinBookingMinutes(e.target.value)}
                      className="h-11 bg-input/50 border-border/50 focus:border-primary/60 transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground/80">{t('Максимум (минут)')}</p>
                    <Input
                      type="number"
                      min={TIME_STEP_MINUTES}
                      step={TIME_STEP_MINUTES}
                      value={maxBookingMinutes}
                      onChange={(e) => setMaxBookingMinutes(e.target.value)}
                      className="h-11 bg-input/50 border-border/50 focus:border-primary/60 transition-colors"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground/70">
                  {t('Рекомендуемый шаг: {step} минут', { step: TIME_STEP_MINUTES })}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="capacity" className="text-sm text-muted-foreground">{t('Вместимость (человек) *')}</Label>
                <Input
                  id="capacity"
                  type="number"
                  min="1"
                  placeholder={t('Например: 10')}
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  className="h-11 bg-input/50 border-border/50 focus:border-primary/60 transition-colors"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">{t('Что предоставляет бизнес в этой комнате *')}</Label>
                <div className="flex flex-wrap gap-2">
                  {DEFAULT_ROOM_SERVICE_OPTIONS.map((serviceOption) => {
                    const isSelected = services.includes(serviceOption);
                    return (
                      <Button
                        key={serviceOption}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => toggleService(serviceOption)}
                        className={cn(
                          'h-8 border-border/50 px-3 text-xs',
                          isSelected ? 'border-primary/60 bg-primary/15 text-primary' : 'text-muted-foreground',
                        )}
                      >
                        {serviceOption}
                      </Button>
                    );
                  })}
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={customService}
                    onChange={(e) => setCustomService(e.target.value)}
                    placeholder={t('Добавить свою услугу')}
                    className="h-10 bg-input/50 border-border/50 focus:border-primary/60 transition-colors"
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        addCustomService();
                      }
                    }}
                  />
                  <Button type="button" variant="outline" className="h-10 border-border/50" onClick={addCustomService}>
                    <ListPlus className="mr-2 h-4 w-4" />
                    {t('Добавить')}
                  </Button>
                </div>
                {services.length > 0 ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {services.map((serviceOption) => (
                      <button
                        key={serviceOption}
                        type="button"
                        onClick={() => removeService(serviceOption)}
                        className="inline-flex items-center gap-1 rounded-full border border-primary/35 bg-primary/10 px-2.5 py-1 text-xs text-primary transition hover:bg-primary/20"
                      >
                        <span>{serviceOption}</span>
                        <X className="h-3 w-3" />
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="photo" className="text-sm text-muted-foreground">
                  {t('Фото комнаты (до {count})', { count: MAX_ROOM_PHOTOS })}
                </Label>
                <Input
                  id="photo"
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handlePhotoChange}
                  disabled={isImageProcessing || photoUrls.length >= MAX_ROOM_PHOTOS}
                  className="h-11 bg-input/50 border-border/50 file:mr-3 file:text-xs file:font-medium"
                />
                <p className="text-xs text-muted-foreground/70">
                  {t('JPG/PNG/WebP, каждое фото автоматически сжимается перед сохранением')}
                </p>
              </div>
              {selectedPhoto ? (
                <div className="space-y-3 rounded-xl border border-border/40 bg-muted/10 p-3">
                  <div className="relative w-full aspect-[16/10] overflow-hidden rounded-lg border border-border/50 bg-muted/20">
                    <img
                      src={selectedPhoto}
                      alt={t('Предпросмотр фото комнаты')}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute right-2 top-2 rounded-full bg-black/45 px-2 py-0.5 text-[11px] font-medium text-white">
                      {selectedPhotoIndex + 1}/{photoUrls.length}
                    </div>
                  </div>

                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {photoUrls.map((photo, index) => (
                      <div key={`${photo}-${index}`} className="relative">
                        <button
                          type="button"
                          onClick={() => setSelectedPhotoIndex(index)}
                          className={cn(
                            'group relative w-full aspect-square overflow-hidden rounded-md border transition-all',
                            index === selectedPhotoIndex
                              ? 'border-primary ring-2 ring-primary/30'
                              : 'border-border/40 hover:border-primary/45',
                          )}
                        >
                          <img src={photo} alt={t('Миниатюра {index}', { index: index + 1 })} className="w-full h-full object-cover" />
                          {index === 0 ? (
                            <span className="absolute left-1 top-1 inline-flex items-center gap-1 rounded-full bg-black/45 px-1.5 py-0.5 text-[10px] text-white">
                              <Star className="h-2.5 w-2.5" />
                              {t('Обложка')}
                            </span>
                          ) : null}
                        </button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute -top-2 -right-2 h-6 w-6 rounded-full shadow-sm"
                          onClick={() => handleRemovePhoto(index)}
                        >
                          <Trash2 className="h-3 w-3" />
                          <span className="sr-only">{t('Удалить фото {index}', { index: index + 1 })}</span>
                        </Button>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="border-border/50"
                      disabled={selectedPhotoIndex === 0}
                      onClick={() => handleSetCoverPhoto(selectedPhotoIndex)}
                    >
                      {t('Сделать обложкой')}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="border-border/50"
                      onClick={() => {
                        setPhotoUrls([]);
                        setSelectedPhotoIndex(0);
                      }}
                    >
                      {t('Очистить все')}
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog} className="border-border/50">
                {t('Отмена')}
              </Button>
              <Button type="submit" disabled={isImageProcessing}>
                {editingRoom ? t('Сохранить') : t('Добавить')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="border-border/50">
          <DialogHeader>
            <DialogTitle>{t('Подтвердите удаление')}</DialogTitle>
            <DialogDescription>
              {t('Вы уверены, что хотите удалить эту комнату? Это действие нельзя отменить.')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)} className="border-border/50">
              {t('Отмена')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
            >
              {t('Удалить')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
