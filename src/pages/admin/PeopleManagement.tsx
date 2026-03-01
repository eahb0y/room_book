import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useVenueStore } from '@/store/venueStore';
import type { Invitation, VenueMembership } from '@/types';
import { createInvitation, listInvitations, revokeInvitation } from '@/lib/inviteApi';
import { deleteMembership, listMemberships } from '@/lib/membershipApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Copy, QrCode, Trash2 } from 'lucide-react';
import { useI18n } from '@/i18n/useI18n';
import { canManageBusinessResidents, getAccessibleBusinessVenues, isBusinessPortalActive } from '@/lib/businessAccess';
import {
  formatResidentPromoCode,
  getResidentPromoDescription,
  getResidentPromoTitle,
} from '@/lib/residentPromo';

interface ConnectedResident {
  membership: VenueMembership;
  invitation?: Invitation;
  fullName: string;
  email: string;
  promoCode: string;
  promoTitle: string;
}

export default function PeopleManagement() {
  const { t, intlLocale } = useI18n();
  const user = useAuthStore((state) => state.user);
  const portal = useAuthStore((state) => state.portal);
  const navigate = useNavigate();
  const isBusinessPortal = isBusinessPortalActive(user, portal);
  const venues = useVenueStore((state) => state.venues);
  const rooms = useVenueStore((state) => state.rooms);
  const canManageResidents = canManageBusinessResidents(user);
  const existingVenue = useMemo(
    () => getAccessibleBusinessVenues(user, venues)[0],
    [user, venues]
  );
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [memberships, setMemberships] = useState<VenueMembership[]>([]);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [memberLoading, setMemberLoading] = useState(false);
  const [sharedInviteSubmitting, setSharedInviteSubmitting] = useState(false);
  const [inviteLoadError, setInviteLoadError] = useState('');
  const [memberLoadError, setMemberLoadError] = useState('');
  const [deletingMembershipId, setDeletingMembershipId] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');

  useEffect(() => {
    if (!inviteSuccess) return;
    const timeoutId = window.setTimeout(() => {
      setInviteSuccess('');
    }, 2500);
    return () => window.clearTimeout(timeoutId);
  }, [inviteSuccess]);

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
        const message = err instanceof Error ? t(err.message) : t('Не удалось загрузить приглашения');
        setInviteLoadError(message);
        setInvitations([]);
      }
    } finally {
      if (!options?.silent) {
        setInviteLoading(false);
      }
    }
  }, [t]);

  const refreshResidents = useCallback(async (venueId: string, options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setMemberLoading(true);
      setMemberLoadError('');
    }
    try {
      const data = await listMemberships({ venueId });
      setMemberships(data);
    } catch (err) {
      if (!options?.silent) {
        const message = err instanceof Error ? t(err.message) : t('Не удалось загрузить резидентов');
        setMemberLoadError(message);
        setMemberships([]);
      }
    } finally {
      if (!options?.silent) {
        setMemberLoading(false);
      }
    }
  }, [t]);

  useEffect(() => {
    if (!user || !isBusinessPortal) {
      navigate('/');
      return;
    }
  }, [isBusinessPortal, user, navigate]);

  const existingVenueId = existingVenue?.id;

  useEffect(() => {
    if (!existingVenueId) {
      setInvitations([]);
      setMemberships([]);
      setInviteLoadError('');
      setMemberLoadError('');
      return;
    }

    void Promise.all([
      refreshInvitations(existingVenueId),
      refreshResidents(existingVenueId),
    ]);

    const interval = window.setInterval(() => {
      void Promise.all([
        refreshInvitations(existingVenueId, { silent: true }),
        refreshResidents(existingVenueId, { silent: true }),
      ]);
    }, 15000);

    return () => window.clearInterval(interval);
  }, [existingVenueId, refreshInvitations, refreshResidents]);

  const sortedInvitations = useMemo(
    () => [...invitations].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [invitations]
  );

  const sharedInvitation = useMemo(
    () => sortedInvitations.find((invitation) =>
      !invitation.revokedAt &&
      !invitation.inviteeFirstName &&
      !invitation.inviteeLastName &&
      !invitation.inviteeEmail &&
      invitation.maxUses === undefined
    ),
    [sortedInvitations]
  );

  const invitationById = useMemo(
    () => new Map(sortedInvitations.map((invitation) => [invitation.id, invitation])),
    [sortedInvitations]
  );

  const connectedResidents = useMemo<ConnectedResident[]>(
    () =>
      memberships
        .map((membership) => {
          const invitation = membership.invitationId ? invitationById.get(membership.invitationId) : undefined;
          const fullName = [invitation?.inviteeFirstName, invitation?.inviteeLastName]
            .filter((value): value is string => Boolean(value && value.trim()))
            .join(' ')
            .trim();
          const fallbackId = membership.userId.slice(0, 8);
          return {
            membership,
            invitation,
            fullName: fullName || t('Резидент #{id}', { id: fallbackId }),
            email: invitation?.inviteeEmail ?? '—',
            promoCode: invitation?.token ? formatResidentPromoCode(invitation.token) : '—',
            promoTitle: getResidentPromoTitle(invitation?.venueName ?? existingVenue?.name, t),
          };
        })
        .sort((a, b) => b.membership.joinedAt.localeCompare(a.membership.joinedAt)),
    [existingVenue?.name, invitationById, memberships, t]
  );

  const residentRoomCount = useMemo(
    () =>
      rooms.filter((room) => room.venueId === existingVenueId && room.accessType === 'residents_only').length,
    [existingVenueId, rooms],
  );

  const formatDateTime = (iso?: string) => {
    if (!iso) return '—';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat(intlLocale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  };

  const buildInviteLink = (token: string) => `${window.location.origin}/invite/${token}`;

  const buildInviteQrCode = (token: string) => (
    `https://api.qrserver.com/v1/create-qr-code/?size=420x420&margin=0&data=${encodeURIComponent(buildInviteLink(token))}`
  );

  const handleCreateSharedInvite = async (options?: { regenerate?: boolean }) => {
    if (!existingVenue || !user) return;
    if (!canManageResidents) return;
    setInviteError('');
    setInviteSuccess('');
    setSharedInviteSubmitting(true);
    try {
      if (options?.regenerate && sharedInvitation) {
        await revokeInvitation(sharedInvitation.id);
      }

      if (!sharedInvitation || options?.regenerate) {
        await createInvitation({
          venueId: existingVenue.id,
          venueName: existingVenue.name,
          createdByUserId: user.id,
          maxUses: null,
        });
      }

      await refreshInvitations(existingVenue.id);
      setInviteSuccess(options?.regenerate ? t('Общая ссылка обновлена') : t('Общая ссылка создана'));
    } catch {
      setInviteError(options?.regenerate ? t('Не удалось обновить общую ссылку') : t('Не удалось создать общую ссылку'));
    } finally {
      setSharedInviteSubmitting(false);
    }
  };

  const handleCopySharedLink = async () => {
    if (!sharedInvitation) return;
    setInviteError('');
    setInviteSuccess('');
    try {
      await navigator.clipboard.writeText(buildInviteLink(sharedInvitation.token));
      setInviteSuccess(t('Ссылка скопирована'));
    } catch {
      setInviteError(t('Не удалось скопировать ссылку'));
    }
  };

  const handleRemoveResident = async (membershipId: string) => {
    if (!existingVenue) return;
    if (!canManageResidents) return;
    setDeletingMembershipId(membershipId);
    setInviteError('');
    setInviteSuccess('');
    try {
      await deleteMembership(membershipId);
      await refreshResidents(existingVenue.id);
      setInviteSuccess(t('Резидент удалён'));
    } catch (err) {
      const message = err instanceof Error ? t(err.message) : t('Не удалось удалить резидента');
      setInviteError(message);
    } finally {
      setDeletingMembershipId(null);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-4xl font-semibold text-foreground tracking-tight">{t('Резиденты')}</h1>
        <p className="text-muted-foreground mt-2">
          {canManageResidents
            ? t('Резиденты получают доступ к закрытым комнатам после подключения по ссылке или QR-коду')
            : t('Резиденты доступны для просмотра. Управлять ими могут только роли business и manager')}
        </p>
      </div>

      {!existingVenue ? (
        <Card className="border-border/40">
          <CardHeader>
            <CardTitle className="text-lg font-body font-semibold">{t('Сначала создайте заведение')}</CardTitle>
            <CardDescription>
              {t('Раздел «Резиденты» станет доступен после создания заведения.')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/profile')}>{t('Перейти в профиль бизнеса')}</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {(inviteLoadError || memberLoadError || inviteError || inviteSuccess) && (
            <div className="space-y-2">
              {inviteLoadError && (
                <Alert variant="destructive" className="animate-scale-in">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{inviteLoadError}</AlertDescription>
                </Alert>
              )}
              {memberLoadError && (
                <Alert variant="destructive" className="animate-scale-in">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{memberLoadError}</AlertDescription>
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
              <CardTitle className="text-lg font-body font-semibold">{t('Промокод резидентов')}</CardTitle>
              <CardDescription>
                {t('Отправьте код, ссылку или QR, чтобы человек получил доступ к закрытым комнатам')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {inviteLoading && !sharedInvitation ? (
                <p className="text-xs text-muted-foreground">{t('Обновляем список…')}</p>
              ) : null}

              {!sharedInvitation ? (
                <div className="space-y-3">
                  <div className="rounded-lg border border-dashed border-border/50 p-4 text-sm text-muted-foreground">
                    {t('Промокод ещё не создан')}
                  </div>
                  {canManageResidents ? (
                    <Button
                      onClick={() => handleCreateSharedInvite()}
                      disabled={sharedInviteSubmitting || inviteLoading}
                      className="h-11"
                    >
                      {sharedInviteSubmitting ? t('Создание…') : t('Создать промокод')}
                    </Button>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-border/50 bg-background/35 p-4">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{t('Промокод')}</p>
                    <p className="mt-2 text-lg font-semibold text-foreground">
                      {getResidentPromoTitle(existingVenue.name, t)}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {getResidentPromoDescription(t)}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <div className="rounded-full border border-border/50 bg-background/50 px-3 py-1.5 text-xs text-muted-foreground">
                        {t('Закрытых комнат: {count}', { count: residentRoomCount })}
                      </div>
                      <div className="rounded-full border border-border/50 bg-background/50 px-3 py-1.5 text-xs text-muted-foreground">
                        {t('Подключений по этой ссылке: {count}', { count: sharedInvitation.uses })}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div>{t('Ссылка создана: {value}', { value: formatDateTime(sharedInvitation.createdAt) })}</div>
                    <div>{t('Промокод активен для резидентов этого заведения')}</div>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      value={formatResidentPromoCode(sharedInvitation.token)}
                      readOnly
                      className="h-10 bg-input/30 border-border/40 text-xs font-mono text-foreground"
                    />
                    {canManageResidents ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(formatResidentPromoCode(sharedInvitation.token));
                            setInviteSuccess(t('Код скопирован'));
                          } catch {
                            setInviteError(t('Не удалось скопировать ссылку'));
                          }
                        }}
                        className="h-10 border-border/50 hover:border-primary/30"
                      >
                        <Copy className="h-3.5 w-3.5 mr-1.5" />
                        {t('Скопировать код')}
                      </Button>
                    ) : null}
                  </div>

                  <div className="w-fit rounded-lg border border-border/40 bg-background/40 p-2">
                    <div className="mb-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <QrCode className="h-3.5 w-3.5" />
                      <span>{t('QR-код промокода')}</span>
                    </div>
                    <img
                      src={buildInviteQrCode(sharedInvitation.token)}
                      alt={t('QR-код промокода')}
                      className="h-52 w-52 rounded border border-border/40 bg-white p-1"
                      loading="lazy"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 items-stretch">
                    <Input
                      value={buildInviteLink(sharedInvitation.token)}
                      readOnly
                      className="h-10 bg-input/30 border-border/40 text-xs font-mono text-muted-foreground"
                    />
                    {canManageResidents ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleCopySharedLink}
                          className="h-10 border-border/50 hover:border-primary/30"
                        >
                          <Copy className="h-3.5 w-3.5 mr-1.5" />
                          {t('Скопировать ссылку')}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCreateSharedInvite({ regenerate: true })}
                          className="h-10 border-border/50 hover:border-primary/30"
                          disabled={sharedInviteSubmitting}
                        >
                          {t('Обновить промокод')}
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/40">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-lg font-body font-semibold">
                  {t('Подключившиеся резиденты ({count})', { count: connectedResidents.length })}
                </CardTitle>
                <CardDescription>
                  {t('Резиденты, которые могут бронировать закрытые комнаты')}
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refreshResidents(existingVenue.id)}
                disabled={memberLoading}
                className="h-9 border-border/50 hover:border-primary/30"
              >
                {t('Обновить')}
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {memberLoading && (
                <p className="text-xs text-muted-foreground">{t('Обновляем список…')}</p>
              )}

              {connectedResidents.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border/50 p-6 text-sm text-muted-foreground">
                  {t('Пока никто не подключился по приглашению.')}
                </div>
              ) : (
                <div className="space-y-3">
                  {connectedResidents.map((resident) => (
                    <div
                      key={resident.membership.id}
                      className="rounded-lg border border-border/40 bg-card/30 p-4 space-y-3"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-medium text-foreground">{resident.fullName}</p>
                          <p className="text-xs text-muted-foreground">{resident.email}</p>
                        </div>
                        {canManageResidents ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemoveResident(resident.membership.id)}
                            className="h-10 border-red-900/40 text-red-400 hover:bg-red-950/30 hover:text-red-300"
                            disabled={deletingMembershipId === resident.membership.id}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                            {t('Удалить')}
                          </Button>
                        ) : null}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
                        <div>
                          {t('Подключение: {value}', {
                            value: formatDateTime(resident.invitation?.connectedAt ?? resident.membership.joinedAt),
                          })}
                        </div>
                        <div>
                          {t('Создано: {value}', {
                            value: formatDateTime(resident.invitation?.createdAt),
                          })}
                        </div>
                        <div>{t('По промокоду: {value}', { value: resident.promoCode })}</div>
                        <div>{resident.promoTitle}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
