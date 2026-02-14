import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useVenueStore } from '@/store/venueStore';
import type { Invitation } from '@/types';
import { createInvitation, listInvitations, revokeInvitation } from '@/lib/inviteApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, MapPin, FileText, AlertCircle, Link2, Copy, Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function VenueManagement() {
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const venues = useVenueStore((state) => state.venues);
  const createVenue = useVenueStore((state) => state.createVenue);
  const updateVenue = useVenueStore((state) => state.updateVenue);
  const existingVenue = useMemo(
    () => venues.find((venue) => venue.adminId === user?.id),
    [venues, user?.id]
  );
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteLoadError, setInviteLoadError] = useState('');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [inviteFirstName, setInviteFirstName] = useState('');
  const [inviteLastName, setInviteLastName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');

  const refreshInvitations = useCallback(async (venueId: string, options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setInviteLoading(true);
      setInviteLoadError('');
    }
    try {
      const data = await listInvitations(venueId);
      setInvitations(data);
    } catch (err) {
      if (!options?.silent) {
        const message = err instanceof Error ? err.message : 'Не удалось загрузить приглашения';
        setInviteLoadError(message);
        setInvitations([]);
      }
    } finally {
      if (!options?.silent) {
        setInviteLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!existingVenue) {
      setInvitations([]);
      setInviteLoadError('');
      return;
    }
    refreshInvitations(existingVenue.id);
    const interval = window.setInterval(() => {
      refreshInvitations(existingVenue.id, { silent: true });
    }, 15000);
    return () => window.clearInterval(interval);
  }, [existingVenue?.id, refreshInvitations]);

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
      setError('Название и адрес обязательны для заполнения');
      return;
    }

    setIsLoading(true);

    try {
      if (existingVenue) {
        await updateVenue(existingVenue.id, { name, description, address });
        setSuccess('Заведение успешно обновлено');
      } else {
        await createVenue({ name, description, address, adminId: user!.id });
        setSuccess('Заведение успешно создано');
      }
    } catch {
      setError('Произошла ошибка при сохранении');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    if (!existingVenue) return;
    setInviteError('');
    setInviteSuccess('');
    try {
      await revokeInvitation(inviteId);
      await refreshInvitations(existingVenue.id);
      setInviteSuccess('Приглашение отозвано');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось отозвать приглашение';
      setInviteError(message);
    }
  };

  const handleCreateInvite = async () => {
    if (!existingVenue || !user) return;
    setInviteError('');
    setInviteSuccess('');
    const trimmedFirstName = inviteFirstName.trim();
    const trimmedLastName = inviteLastName.trim();
    const trimmedEmail = inviteEmail.trim().toLowerCase();
    if (!trimmedFirstName || !trimmedLastName || !trimmedEmail) {
      setInviteError('Имя, фамилия и email обязательны для заполнения');
      return;
    }
    setInviteSubmitting(true);
    try {
      await createInvitation({
        venueId: existingVenue.id,
        venueName: existingVenue.name,
        createdByUserId: user.id,
        inviteeFirstName: trimmedFirstName,
        inviteeLastName: trimmedLastName,
        inviteeEmail: trimmedEmail,
      });
      await refreshInvitations(existingVenue.id);
      setInviteFirstName('');
      setInviteLastName('');
      setInviteEmail('');
      setInviteSuccess('Инвайт создан. Пользователь может перейти по ссылке и зарегистрироваться.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось создать приглашение';
      setInviteError(message);
    } finally {
      setInviteSubmitting(false);
    }
  };


  const sortedInvitations = useMemo(
    () => [...invitations].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [invitations]
  );

  const formatDateTime = (iso?: string) => {
    if (!iso) return '—';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('ru-RU', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  };

  const getConnectionStatus = (invitation: Invitation) => {
    const isConnected =
      invitation.status === 'connected' ||
      Boolean(invitation.connectedAt) ||
      invitation.uses > 0;
    return isConnected
      ? {
          text: 'Подключён',
          color: 'text-emerald-300',
          bg: 'bg-emerald-950/40 border-emerald-800/40',
        }
      : {
          text: 'Ожидает',
          color: 'text-amber-300',
          bg: 'bg-amber-950/30 border-amber-800/40',
        };
  };

  const getLinkStatus = (invitation: Invitation) => {
    if (invitation.revokedAt) {
      return {
        text: 'Отозвано',
        color: 'text-red-300',
        bg: 'bg-red-950/40 border-red-900/40',
        active: false,
      };
    }
    if (invitation.expiresAt && new Date(invitation.expiresAt) <= new Date()) {
      return {
        text: 'Истекло',
        color: 'text-amber-300',
        bg: 'bg-amber-950/30 border-amber-800/40',
        active: false,
      };
    }
    if (invitation.maxUses !== undefined && invitation.uses >= invitation.maxUses) {
      return {
        text: 'Использовано',
        color: 'text-amber-300',
        bg: 'bg-amber-950/30 border-amber-800/40',
        active: false,
      };
    }
    return {
      text: 'Активно',
      color: 'text-emerald-300',
      bg: 'bg-emerald-950/40 border-emerald-800/40',
      active: true,
    };
  };

  const buildInviteLink = (token: string) => `${window.location.origin}/invite/${token}`;

  const handleCopyLink = async (token: string) => {
    setInviteError('');
    setInviteSuccess('');
    try {
      await navigator.clipboard.writeText(buildInviteLink(token));
      setInviteSuccess('Ссылка скопирована');
    } catch {
      setInviteError('Не удалось скопировать ссылку');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-semibold text-foreground tracking-tight">
          {existingVenue ? 'Редактирование заведения' : 'Создание заведения'}
        </h1>
        <p className="text-muted-foreground mt-2">
          {existingVenue ? 'Обновите информацию о вашем заведении' : 'Добавьте своё заведение в систему'}
        </p>
      </div>

      {/* Venue Form */}
      <Card className="border-border/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5 text-lg">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            <span className="font-body font-semibold">Информация о заведении</span>
          </CardTitle>
          <CardDescription>
            Заполните основную информацию о вашем заведении
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
                <span>Название заведения *</span>
              </Label>
              <Input
                id="name"
                placeholder="Например: Коворкинг Центр"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="h-11 bg-input/50 border-border/50 focus:border-primary/60 transition-colors"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address" className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                <span>Адрес *</span>
              </Label>
              <Input
                id="address"
                placeholder="Например: ул. Ленина, 1"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
                className="h-11 bg-input/50 border-border/50 focus:border-primary/60 transition-colors"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-3.5 w-3.5" />
                <span>Описание</span>
              </Label>
              <Textarea
                id="description"
                placeholder="Опишите ваше заведение…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="bg-input/50 border-border/50 focus:border-primary/60 transition-colors resize-none"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={isLoading} className="flex-1 h-11">
                {isLoading ? 'Сохранение…' : existingVenue ? 'Обновить заведение' : 'Создать заведение'}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate('/app')} className="h-11 border-border/50 hover:border-primary/30">
                Отмена
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Invitation Management */}
      {existingVenue && (
        <div className="space-y-6">
          {(inviteLoadError || inviteError || inviteSuccess) && (
            <div className="space-y-2">
              {inviteLoadError && (
                <Alert variant="destructive" className="animate-scale-in">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{inviteLoadError}</AlertDescription>
                </Alert>
              )}
              {inviteError && (
                <Alert variant="destructive" className="animate-scale-in">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{inviteError}</AlertDescription>
                </Alert>
              )}
              {inviteSuccess && (
                <Alert className="bg-emerald-950/30 border-emerald-800/40 animate-scale-in">
                  <AlertDescription className="text-emerald-300">{inviteSuccess}</AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <Card className="border-border/40 animate-fade-up stagger-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2.5 text-lg">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Link2 className="h-4 w-4 text-primary" />
                </div>
                <span className="font-body font-semibold">Новая анкета</span>
              </CardTitle>
              <CardDescription>
                Заполните данные пользователя и создайте персональную ссылку
              </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCreateInvite();
              }}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="inviteFirstName" className="text-sm text-muted-foreground">
                      Имя *
                    </Label>
                    <Input
                      id="inviteFirstName"
                      value={inviteFirstName}
                      onChange={(e) => setInviteFirstName(e.target.value)}
                      required
                      className="h-11 bg-input/50 border-border/50 focus:border-primary/60 transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="inviteLastName" className="text-sm text-muted-foreground">
                      Фамилия *
                    </Label>
                    <Input
                      id="inviteLastName"
                      value={inviteLastName}
                      onChange={(e) => setInviteLastName(e.target.value)}
                      required
                      className="h-11 bg-input/50 border-border/50 focus:border-primary/60 transition-colors"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="inviteEmail" className="text-sm text-muted-foreground">
                      Email *
                    </Label>
                    <Input
                      id="inviteEmail"
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      required
                      className="h-11 bg-input/50 border-border/50 focus:border-primary/60 transition-colors"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <Button type="submit" className="h-11" disabled={inviteSubmitting || inviteLoading}>
                    {inviteSubmitting ? 'Создание…' : 'Создать ссылку'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="border-border/40">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-lg font-body font-semibold">
                  Инвайты ({sortedInvitations.length})
                </CardTitle>
                <CardDescription>
                  Статусы подключения и доступности ссылки
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refreshInvitations(existingVenue.id)}
                disabled={inviteLoading}
                className="h-9 border-border/50 hover:border-primary/30"
              >
                Обновить
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {inviteLoading && (
                <p className="text-xs text-muted-foreground">Обновляем список…</p>
              )}

              {sortedInvitations.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border/50 p-6 text-sm text-muted-foreground">
                  Пока нет инвайтов. Создайте первую анкету выше.
                </div>
              ) : (
                <div className="space-y-3">
                  {sortedInvitations.map((invitation) => {
                    const connectionStatus = getConnectionStatus(invitation);
                    const linkStatus = getLinkStatus(invitation);
                    const fullName = [invitation.inviteeFirstName, invitation.inviteeLastName]
                      .filter(Boolean)
                      .join(' ')
                      .trim() || 'Без имени';
                    const inviteAddress = invitation.inviteeEmail || '—';
                    const inviteLink = buildInviteLink(invitation.token);

                    return (
                      <div
                        key={invitation.id}
                        className="rounded-lg border border-border/40 bg-card/30 p-4 space-y-3"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-foreground">{fullName}</p>
                            <p className="text-xs text-muted-foreground">{inviteAddress}</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span
                              className={`inline-flex items-center rounded-full border px-2.5 py-1 font-medium ${connectionStatus.bg} ${connectionStatus.color}`}
                            >
                              {connectionStatus.text}
                            </span>
                            <span
                              className={`inline-flex items-center rounded-full border px-2.5 py-1 font-medium ${linkStatus.bg} ${linkStatus.color}`}
                            >
                              {linkStatus.text}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
                          <div>Создано: {formatDateTime(invitation.createdAt)}</div>
                          <div>Подключение: {formatDateTime(invitation.connectedAt)}</div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2 items-stretch">
                          <Input
                            value={inviteLink}
                            readOnly
                            className="h-10 bg-input/30 border-border/40 text-xs font-mono text-muted-foreground"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCopyLink(invitation.token)}
                            className="h-10 border-border/50 hover:border-primary/30"
                          >
                            <Copy className="h-3.5 w-3.5 mr-1.5" />
                            Копировать
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRevokeInvite(invitation.id)}
                            className="h-10 border-red-900/40 text-red-400 hover:bg-red-950/30 hover:text-red-300"
                            disabled={inviteLoading || Boolean(invitation.revokedAt)}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                            Отозвать
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
