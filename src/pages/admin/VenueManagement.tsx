import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useVenueStore } from '@/store/venueStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, MapPin, FileText, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useI18n } from '@/i18n/useI18n';

export default function VenueManagement() {
  const { t } = useI18n();
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const venues = useVenueStore((state) => state.venues);
  const createVenue = useVenueStore((state) => state.createVenue);
  const updateVenue = useVenueStore((state) => state.updateVenue);
  const existingVenue = useMemo(
    () => venues.find((venue) => venue.adminId === user?.id),
    [venues, user?.id]
  );

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/app');
      return;
    }

    if (!existingVenue) {
      return;
    }

    if (name !== existingVenue.name) setName(existingVenue.name);
    if (description !== existingVenue.description) setDescription(existingVenue.description);
    if (address !== existingVenue.address) setAddress(existingVenue.address);
  }, [user, navigate, existingVenue?.id, existingVenue?.name, existingVenue?.description, existingVenue?.address, name, description, address]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!name.trim() || !address.trim()) {
      setError(t('Название и адрес обязательны для заполнения'));
      return;
    }

    setIsLoading(true);

    try {
      if (existingVenue) {
        await updateVenue(existingVenue.id, { name, description, address });
        setSuccess(t('Заведение успешно обновлено'));
      } else {
        await createVenue({ name, description, address, adminId: user!.id });
        setSuccess(t('Заведение успешно создано'));
      }
    } catch {
      setError(t('Произошла ошибка при сохранении'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-4xl font-semibold text-foreground tracking-tight">
          {existingVenue ? t('Редактирование заведения') : t('Создание заведения')}
        </h1>
        <p className="text-muted-foreground mt-2">
          {existingVenue ? t('Обновите информацию о вашем заведении') : t('Добавьте своё заведение в систему')}
        </p>
      </div>

      <Card className="border-border/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5 text-lg">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            <span className="font-body font-semibold">{t('Информация о заведении')}</span>
          </CardTitle>
          <CardDescription>
            {t('Заполните основную информацию о вашем заведении')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <Alert variant="destructive" className="animate-scale-in">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {success && (
              <Alert className="bg-emerald-950/30 border-emerald-800/40 animate-scale-in">
                <AlertDescription className="text-emerald-300">{success}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="name" className="flex items-center gap-2 text-sm text-muted-foreground">
                <Building2 className="h-3.5 w-3.5" />
                <span>{t('Название заведения *')}</span>
              </Label>
              <Input
                id="name"
                placeholder={t('Например: Коворкинг Центр')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="h-11 bg-input/50 border-border/50 focus:border-primary/60 transition-colors"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address" className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                <span>{t('Адрес *')}</span>
              </Label>
              <Input
                id="address"
                placeholder={t('Например: ул. Ленина, 1')}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
                className="h-11 bg-input/50 border-border/50 focus:border-primary/60 transition-colors"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-3.5 w-3.5" />
                <span>{t('Описание')}</span>
              </Label>
              <Textarea
                id="description"
                placeholder={t('Опишите ваше заведение…')}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="bg-input/50 border-border/50 focus:border-primary/60 transition-colors resize-none"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={isLoading} className="flex-1 h-11">
                {isLoading ? t('Сохранение…') : existingVenue ? t('Обновить заведение') : t('Создать заведение')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/app')}
                className="h-11 border-border/50 hover:border-primary/30"
              >
                {t('Отмена')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
