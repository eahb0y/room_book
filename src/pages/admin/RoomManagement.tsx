import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, DoorOpen, Edit2, Plus, Star, Trash2, Users } from 'lucide-react';
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
import { getRoomPhotoUrls } from '@/lib/roomPhotos';
import { cn } from '@/lib/utils';
import type { Room } from '@/types';

const MAX_ROOM_PHOTO_SIDE = 1400;
const MAX_ROOM_PHOTO_BYTES = 1_500_000;
const ROOM_PHOTO_QUALITY = 0.82;
const MAX_ROOM_PHOTOS = 8;

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

export default function RoomManagement() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const venues = useVenueStore((state) => state.venues);
  const allRooms = useVenueStore((state) => state.rooms);
  const createRoom = useVenueStore((state) => state.createRoom);
  const updateRoom = useVenueStore((state) => state.updateRoom);
  const deleteRoom = useVenueStore((state) => state.deleteRoom);

  const venue = useMemo(() => venues.find((v) => v.adminId === user?.id), [venues, user?.id]);
  const rooms = useMemo(() => allRooms.filter((r) => r.venueId === venue?.id), [allRooms, venue?.id]);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState('');
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [isImageProcessing, setIsImageProcessing] = useState(false);
  const [error, setError] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/app');
      return;
    }
  }, [user, navigate]);

  useEffect(() => {
    setSelectedPhotoIndex((prev) => {
      if (photoUrls.length === 0) return 0;
      return Math.min(prev, photoUrls.length - 1);
    });
  }, [photoUrls.length]);

  const handleOpenDialog = (room?: Room) => {
    if (room) {
      setEditingRoom(room);
      setName(room.name);
      setCapacity(room.capacity.toString());
      setPhotoUrls(getRoomPhotoUrls(room));
    } else {
      setEditingRoom(null);
      setName('');
      setCapacity('');
      setPhotoUrls([]);
    }
    setSelectedPhotoIndex(0);
    setError('');
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingRoom(null);
    setName('');
    setCapacity('');
    setPhotoUrls([]);
    setSelectedPhotoIndex(0);
    setIsImageProcessing(false);
    setError('');
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    if (photoUrls.length + files.length > MAX_ROOM_PHOTOS) {
      setError(`Можно добавить максимум ${MAX_ROOM_PHOTOS} фото`);
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
      setError(err instanceof Error ? err.message : 'Не удалось загрузить фото');
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

    if (isImageProcessing) {
      setError('Дождитесь завершения обработки фото');
      return;
    }

    if (!name.trim()) {
      setError('Название комнаты обязательно');
      return;
    }

    const capacityNum = parseInt(capacity, 10);
    if (isNaN(capacityNum) || capacityNum < 1) {
      setError('Вместимость должна быть числом больше 0');
      return;
    }

    if (!venue) return;

    const roomName = name.trim();

    try {
      if (editingRoom) {
        await updateRoom(editingRoom.id, {
          name: roomName,
          capacity: capacityNum,
          photoUrls,
          photoUrl: photoUrls[0] ?? null,
        });
      } else {
        await createRoom({
          name: roomName,
          capacity: capacityNum,
          venueId: venue.id,
          photoUrls,
          photoUrl: photoUrls[0] ?? null,
        });
      }
      handleCloseDialog();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить комнату');
    }
  };

  const handleDelete = async (roomId: string) => {
    await deleteRoom(roomId);
    setDeleteConfirmId(null);
  };

  const selectedPhoto = photoUrls[selectedPhotoIndex] ?? photoUrls[0] ?? null;

  if (!venue) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-16 h-16 rounded-2xl bg-secondary/50 flex items-center justify-center mb-5">
          <Building2Icon className="h-7 w-7 text-muted-foreground/50" />
        </div>
        <p className="text-muted-foreground mb-4">Сначала создайте заведение</p>
        <Button onClick={() => navigate('/my-venue')}>Создать заведение</Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-semibold text-foreground tracking-tight">
            Управление комнатами
          </h1>
          <p className="text-muted-foreground mt-2">
            Добавляйте и управляйте переговорными комнатами
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()} className="flex items-center gap-2 h-11 shrink-0">
          <Plus className="h-4 w-4" />
          <span>Добавить комнату</span>
        </Button>
      </div>

      {rooms.length === 0 ? (
        <Card className="border-border/40 animate-fade-up">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-secondary/50 flex items-center justify-center mb-5">
              <DoorOpen className="h-7 w-7 text-muted-foreground/40" />
            </div>
            <p className="text-muted-foreground mb-4">У вас пока нет комнат</p>
            <Button onClick={() => handleOpenDialog()}>Добавить первую комнату</Button>
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
                  <CardDescription className="flex items-center gap-2 pl-[42px]">
                    <Users className="h-3.5 w-3.5" />
                    <span>Вместимость: {room.capacity} человек</span>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenDialog(room)}
                      className="flex-1 flex items-center justify-center gap-2 h-9 border-border/50 hover:border-primary/30"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      <span>Редактировать</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteConfirmId(room.id)}
                      className="h-9 px-3 border-red-900/30 text-red-400 hover:bg-red-950/30 hover:text-red-300 hover:border-red-800/40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="border-border/50">
          <DialogHeader>
            <DialogTitle>
              {editingRoom ? 'Редактировать комнату' : 'Добавить комнату'}
            </DialogTitle>
            <DialogDescription>
              {editingRoom ? 'Измените информацию о комнате' : 'Заполните информацию о новой комнате'}
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
                <Label htmlFor="name" className="text-sm text-muted-foreground">Название комнаты *</Label>
                <Input
                  id="name"
                  placeholder="Например: Переговорная А"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-11 bg-input/50 border-border/50 focus:border-primary/60 transition-colors"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="capacity" className="text-sm text-muted-foreground">Вместимость (человек) *</Label>
                <Input
                  id="capacity"
                  type="number"
                  min="1"
                  placeholder="Например: 10"
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  className="h-11 bg-input/50 border-border/50 focus:border-primary/60 transition-colors"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="photo" className="text-sm text-muted-foreground">
                  Фото комнаты (до {MAX_ROOM_PHOTOS})
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
                  JPG/PNG/WebP, каждое фото автоматически сжимается перед сохранением
                </p>
              </div>
              {selectedPhoto ? (
                <div className="space-y-3 rounded-xl border border-border/40 bg-muted/10 p-3">
                  <div className="relative w-full aspect-[16/10] overflow-hidden rounded-lg border border-border/50 bg-muted/20">
                    <img
                      src={selectedPhoto}
                      alt="Предпросмотр фото комнаты"
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
                          <img src={photo} alt={`Миниатюра ${index + 1}`} className="w-full h-full object-cover" />
                          {index === 0 ? (
                            <span className="absolute left-1 top-1 inline-flex items-center gap-1 rounded-full bg-black/45 px-1.5 py-0.5 text-[10px] text-white">
                              <Star className="h-2.5 w-2.5" />
                              Обложка
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
                          <span className="sr-only">Удалить фото {index + 1}</span>
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
                      Сделать обложкой
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
                      Очистить все
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog} className="border-border/50">
                Отмена
              </Button>
              <Button type="submit" disabled={isImageProcessing}>
                {editingRoom ? 'Сохранить' : 'Добавить'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="border-border/50">
          <DialogHeader>
            <DialogTitle>Подтвердите удаление</DialogTitle>
            <DialogDescription>
              Вы уверены, что хотите удалить эту комнату? Это действие нельзя отменить.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)} className="border-border/50">
              Отмена
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
            >
              Удалить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Building2Icon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/>
      <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/>
      <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/>
      <path d="M10 6h4"/>
      <path d="M10 10h4"/>
      <path d="M10 14h4"/>
      <path d="M10 18h4"/>
    </svg>
  );
}
