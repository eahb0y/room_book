import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Building2, Edit2, FileText, MapPin, Plus } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useVenueStore } from '@/store/venueStore';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useI18n } from '@/i18n/useI18n';
import {
  BUSINESS_ACTIVITY_CUSTOM_ID,
  businessActivityOptions,
  decodeBusinessActivityValue,
  encodeBusinessActivityValue,
} from '@/lib/businessActivity';
import { canManageBusinessResources, getAccessibleBusinessVenues, isBusinessPortalActive } from '@/lib/businessAccess';
import BusinessActivityField from '@/components/BusinessActivityField';
import type { Venue } from '@/types';

const getVenueActivityLabel = (activityType: string) => {
  const decoded = decodeBusinessActivityValue(activityType);
  if (decoded.selectedValue === BUSINESS_ACTIVITY_CUSTOM_ID) {
    return decoded.customValue;
  }

  return businessActivityOptions.find((option) => option.id === decoded.selectedValue)?.label ?? decoded.selectedValue;
};

const sortByCreatedAtDesc = <T extends { createdAt: string }>(items: T[]) =>
  [...items].sort((left, right) => right.createdAt.localeCompare(left.createdAt));

export default function VenueManagement() {
  const { t } = useI18n();
  const user = useAuthStore((state) => state.user);
  const portal = useAuthStore((state) => state.portal);
  const refreshBusinessAccess = useAuthStore((state) => state.refreshBusinessAccess);
  const navigate = useNavigate();
  const isBusinessPortal = isBusinessPortalActive(user, portal);
  const venues = useVenueStore((state) => state.venues);
  const rooms = useVenueStore((state) => state.rooms);
  const createVenue = useVenueStore((state) => state.createVenue);
  const updateVenue = useVenueStore((state) => state.updateVenue);

  const accessibleVenues = useMemo(
    () => sortByCreatedAtDesc(getAccessibleBusinessVenues(user, venues)),
    [user, venues],
  );
  const canManageVenues = canManageBusinessResources(user);
  const roomCountsByVenue = useMemo(() => {
    const counts = new Map<string, number>();
    rooms.forEach((room) => {
      counts.set(room.venueId, (counts.get(room.venueId) ?? 0) + 1);
    });
    return counts;
  }, [rooms]);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingVenue, setEditingVenue] = useState<Venue | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [activityType, setActivityType] = useState('');
  const [customActivityType, setCustomActivityType] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!user || !isBusinessPortal) {
      navigate('/');
    }
  }, [isBusinessPortal, navigate, user]);

  const resetForm = () => {
    setEditingVenue(null);
    setName('');
    setDescription('');
    setAddress('');
    setActivityType('');
    setCustomActivityType('');
    setError('');
  };

  const handleOpenCreateDialog = () => {
    if (!canManageVenues) return;
    resetForm();
    setSuccess('');
    setIsDialogOpen(true);
  };

  const handleOpenEditDialog = (venue: Venue) => {
    const decodedActivityType = decodeBusinessActivityValue(venue.activityType);
    setEditingVenue(venue);
    setName(venue.name);
    setDescription(venue.description ?? '');
    setAddress(venue.address);
    setActivityType(decodedActivityType.selectedValue);
    setCustomActivityType(decodedActivityType.customValue);
    setError('');
    setSuccess('');
    setIsDialogOpen(true);
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (open) {
      setIsDialogOpen(true);
      return;
    }

    setIsDialogOpen(false);
    resetForm();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!user) return;
    if (!canManageVenues) {
      setError(t('Только роль business может изменять данные заведения'));
      return;
    }

    const normalizedName = name.trim();
    const normalizedAddress = address.trim();
    const normalizedDescription = description.trim();
    const normalizedActivityType = encodeBusinessActivityValue(activityType, customActivityType);

    if (!normalizedName || !normalizedAddress) {
      setError(t('Название и адрес обязательны для заполнения'));
      return;
    }

    if (activityType === BUSINESS_ACTIVITY_CUSTOM_ID && !normalizedActivityType) {
      setError(t('Укажите свой род деятельности'));
      return;
    }

    if (!editingVenue && !normalizedActivityType) {
      setError(t('Выберите род деятельности'));
      return;
    }

    setIsSaving(true);

    try {
      if (editingVenue) {
        await updateVenue(editingVenue.id, {
          name: normalizedName,
          description: normalizedDescription,
          address: normalizedAddress,
          activityType: normalizedActivityType,
        });
        setSuccess(t('Заведение успешно обновлено'));
      } else {
        await createVenue({
          name: normalizedName,
          description: normalizedDescription,
          address: normalizedAddress,
          activityType: normalizedActivityType,
          adminId: user.id,
        });
        await refreshBusinessAccess();
        setSuccess(t('Заведение успешно создано'));
      }

      setIsDialogOpen(false);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? t(err.message) : t('Не удалось создать заведение'));
    } finally {
      setIsSaving(false);
    }
  };

  if (accessibleVenues.length === 0) {
    return (
      <div className="space-y-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight text-foreground">{t('Мои заведения')}</h1>
            <p className="mt-2 text-muted-foreground">{t('Создавайте и редактируйте все свои заведения в одном месте')}</p>
          </div>
          {canManageVenues ? (
            <Button onClick={handleOpenCreateDialog} className="h-11 w-fit">
              <Plus className="mr-2 h-4 w-4" />
              {t('Создать заведение')}
            </Button>
          ) : null}
        </div>

        {(error || success) ? (
          <div className="space-y-2">
            {error ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            {success ? (
              <Alert className="border-emerald-800/40 bg-emerald-950/30">
                <AlertDescription className="text-emerald-300">{success}</AlertDescription>
              </Alert>
            ) : null}
          </div>
        ) : null}

        <Card className="border-border/40">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary/50">
              <Building2 className="h-7 w-7 text-muted-foreground/50" />
            </div>
            <p className="text-lg font-medium text-foreground">{t('У вас пока нет заведений')}</p>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              {canManageVenues
                ? t('Добавьте первое заведение, чтобы затем привязывать к нему комнаты, услуги и сотрудников.')
                : t('Заведения доступны только для просмотра. Создавать их может только роль business')}
            </p>
            {canManageVenues ? (
              <Button onClick={handleOpenCreateDialog} className="mt-6 h-11">
                <Plus className="mr-2 h-4 w-4" />
                {t('Добавить первое заведение')}
              </Button>
            ) : null}
          </CardContent>
        </Card>

        <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
          <DialogContent className="border-border/50 sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t('Создание заведения')}</DialogTitle>
              <DialogDescription>{t('Добавьте своё заведение в систему')}</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-5 py-4">
              {error ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="venue-name-create">{t('Название заведения *')}</Label>
                <Input
                  id="venue-name-create"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={t('Например: Коворкинг Центр')}
                  className="h-11 bg-input/50 border-border/50 focus:border-primary/60"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="venue-address-create">{t('Адрес *')}</Label>
                <Input
                  id="venue-address-create"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  placeholder={t('Например: ул. Ленина, 1')}
                  className="h-11 bg-input/50 border-border/50 focus:border-primary/60"
                />
              </div>

              <BusinessActivityField
                idPrefix="my-venues-create"
                selectedValue={activityType}
                customValue={customActivityType}
                onSelectedValueChange={setActivityType}
                onCustomValueChange={setCustomActivityType}
                required
              />

              <div className="space-y-2">
                <Label htmlFor="venue-description-create">{t('Описание')}</Label>
                <Textarea
                  id="venue-description-create"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder={t('Опишите ваше заведение…')}
                  rows={4}
                  className="bg-input/50 border-border/50 focus:border-primary/60 resize-none"
                />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button type="submit" className="h-11 sm:min-w-44" disabled={isSaving}>
                  {isSaving ? t('Сохранение…') : t('Создать заведение')}
                </Button>
                <Button type="button" variant="outline" className="h-11" onClick={() => handleDialogOpenChange(false)}>
                  {t('Отмена')}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-foreground">{t('Мои заведения')}</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            {t('Создавайте и редактируйте все свои заведения в одном месте')}
          </p>
        </div>
        {canManageVenues ? (
          <Button onClick={handleOpenCreateDialog} className="h-11 w-fit">
            <Plus className="mr-2 h-4 w-4" />
            {t('Добавить заведение')}
          </Button>
        ) : null}
      </div>

      {(error || success) ? (
        <div className="space-y-2">
          {error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {success ? (
            <Alert className="border-emerald-800/40 bg-emerald-950/30">
              <AlertDescription className="text-emerald-300">{success}</AlertDescription>
            </Alert>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
        {accessibleVenues.map((venue, index) => {
          const roomCount = roomCountsByVenue.get(venue.id) ?? 0;
          const activityLabel = getVenueActivityLabel(venue.activityType);

          return (
            <Card key={venue.id} className={`card-hover stagger-${Math.min(index + 1, 6)} animate-fade-up`}>
              <CardHeader className="space-y-4">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="truncate text-lg">{venue.name}</CardTitle>
                    <CardDescription className="mt-1 flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{venue.address}</span>
                    </CardDescription>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="rounded-full border border-border/45 bg-input/20 px-3 py-1 text-xs text-muted-foreground">
                    {t('Комнат: {count}', { count: roomCount })}
                  </div>
                  {activityLabel ? (
                    <div className="rounded-full border border-border/45 bg-input/20 px-3 py-1 text-xs text-muted-foreground">
                      {activityLabel}
                    </div>
                  ) : null}
                  {canManageVenues ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 max-w-full border-border/50 sm:ml-auto"
                      onClick={() => handleOpenEditDialog(venue)}
                    >
                      <Edit2 className="mr-2 h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{t('Редактировать')}</span>
                    </Button>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-2xl border border-border/45 bg-muted/10 p-4">
                  <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <FileText className="h-4 w-4 text-primary" />
                    <span>{t('Описание')}</span>
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {venue.description || t('Описание заведения пока не добавлено.')}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="border-border/50 sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingVenue ? t('Редактирование заведения') : t('Создание заведения')}</DialogTitle>
            <DialogDescription>
              {editingVenue ? t('Обновите информацию о вашем заведении') : t('Добавьте своё заведение в систему')}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5 py-4">
            {error ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="venue-name">{t('Название заведения *')}</Label>
              <Input
                id="venue-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t('Например: Коворкинг Центр')}
                className="h-11 bg-input/50 border-border/50 focus:border-primary/60"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="venue-address">{t('Адрес *')}</Label>
              <Input
                id="venue-address"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder={t('Например: ул. Ленина, 1')}
                className="h-11 bg-input/50 border-border/50 focus:border-primary/60"
              />
            </div>

            <BusinessActivityField
              idPrefix="my-venues"
              selectedValue={activityType}
              customValue={customActivityType}
              onSelectedValueChange={setActivityType}
              onCustomValueChange={setCustomActivityType}
              required={!editingVenue}
            />

            <div className="space-y-2">
              <Label htmlFor="venue-description">{t('Описание')}</Label>
              <Textarea
                id="venue-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={t('Опишите ваше заведение…')}
                rows={4}
                className="bg-input/50 border-border/50 focus:border-primary/60 resize-none"
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button type="submit" className="h-11 sm:min-w-44" disabled={isSaving}>
                {isSaving ? t('Сохранение…') : editingVenue ? t('Обновить заведение') : t('Создать заведение')}
              </Button>
              <Button type="button" variant="outline" className="h-11" onClick={() => handleDialogOpenChange(false)}>
                {t('Отмена')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
