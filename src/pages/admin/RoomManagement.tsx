import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useVenueStore } from '@/store/venueStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DoorOpen, Users, Plus, Edit2, Trash2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { Room } from '@/types';

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
  const [error, setError] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/app');
      return;
    }
  }, [user, navigate]);

  const handleOpenDialog = (room?: Room) => {
    if (room) {
      setEditingRoom(room);
      setName(room.name);
      setCapacity(room.capacity.toString());
    } else {
      setEditingRoom(null);
      setName('');
      setCapacity('');
    }
    setError('');
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingRoom(null);
    setName('');
    setCapacity('');
    setError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

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

    if (editingRoom) {
      updateRoom(editingRoom.id, { name, capacity: capacityNum });
    } else {
      createRoom({ name, capacity: capacityNum, venueId: venue.id });
    }

    handleCloseDialog();
  };

  const handleDelete = (roomId: string) => {
    deleteRoom(roomId);
    setDeleteConfirmId(null);
  };

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
      {/* Header */}
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

      {/* Room grid */}
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
          {rooms.map((room, i) => (
            <Card key={room.id} className={`card-hover stagger-${Math.min(i + 1, 6)} animate-fade-up`}>
              <CardHeader className="pb-3">
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
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
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
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog} className="border-border/50">
                Отмена
              </Button>
              <Button type="submit">
                {editingRoom ? 'Сохранить' : 'Добавить'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
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
