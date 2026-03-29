import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Copy, ShieldCheck, Trash2, UserRound } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useVenueStore } from '@/store/venueStore';
import type { BusinessStaffAccount, BusinessStaffRole, CreatedBusinessStaffAccount, VenueSubscription } from '@/types';
import {
  createBusinessStaffAccount,
  deleteBusinessStaffAccount,
  listBusinessStaffAccounts,
  updateBusinessStaffAccountActiveState,
  updateBusinessStaffAccountRole,
} from '@/lib/businessStaffApi';
import { buildBusinessStaffLoginEmail } from '@/lib/businessStaffLogin';
import { canManageBusinessStaff, getAccessibleBusinessVenues, isBusinessPortalActive } from '@/lib/businessAccess';
import { getVenueSubscriptionSnapshot } from '@/lib/subscriptionApi';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useI18n } from '@/i18n/useI18n';
import { FREE_PLAN_ID, getCalendarOptionLabel, getPricingPlanTierById, getRecommendedUpgradePlanId } from '@/lib/pricingCatalog';
import { debugWarn } from '@/lib/frontendDebug';
import { cn } from '@/lib/utils';

const getRoleLabel = (
  role: BusinessStaffRole | 'business',
  t: (value: string, params?: Record<string, string | number>) => string,
) => {
  switch (role) {
    case 'business':
      return t('Владелец бизнеса');
    case 'manager':
      return t('Менеджер');
    case 'staff':
      return t('Сотрудник');
    default:
      return role;
  }
};

export default function EmployeesManagement() {
  const { t } = useI18n();
  const user = useAuthStore((state) => state.user);
  const portal = useAuthStore((state) => state.portal);
  const navigate = useNavigate();
  const venues = useVenueStore((state) => state.venues);
  const isBusinessPortal = isBusinessPortalActive(user, portal);
  const canManageEmployees = canManageBusinessStaff(user);
  const ownedVenues = useMemo(() => getAccessibleBusinessVenues(user, venues), [user, venues]);
  const [selectedVenueId, setSelectedVenueId] = useState('');
  const [staffAccounts, setStaffAccounts] = useState<BusinessStaffAccount[]>([]);
  const [subscription, setSubscription] = useState<VenueSubscription | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubscriptionLoading, setIsSubscriptionLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [createdCredentials, setCreatedCredentials] = useState<CreatedBusinessStaffAccount | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState<BusinessStaffRole>('staff');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [togglingStatusId, setTogglingStatusId] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !isBusinessPortal) {
      navigate('/');
      return;
    }
  }, [isBusinessPortal, navigate, user]);

  useEffect(() => {
    if (ownedVenues.length === 0) {
      setSelectedVenueId('');
      return;
    }

    setSelectedVenueId((current) =>
      current && ownedVenues.some((venue) => venue.id === current) ? current : ownedVenues[0]?.id ?? '',
    );
  }, [ownedVenues]);

  const selectedVenue = useMemo(
    () => ownedVenues.find((venue) => venue.id === selectedVenueId) ?? null,
    [ownedVenues, selectedVenueId],
  );

  const loadStaffAccounts = useCallback(async (venueId: string) => {
    setIsLoading(true);
    setError('');
    try {
      const rows = await listBusinessStaffAccounts({ venueId });
      setStaffAccounts(rows);
    } catch (err) {
      const message = err instanceof Error ? t(err.message) : t('Не удалось загрузить сотрудников');
      setError(message);
      setStaffAccounts([]);
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  const loadSubscription = useCallback(async (venueId: string) => {
    setIsSubscriptionLoading(true);
    try {
      const snapshot = await getVenueSubscriptionSnapshot(venueId);
      setSubscription(snapshot);
    } catch (err) {
      const message = err instanceof Error ? t(err.message) : t('Не удалось загрузить подписку');
      setError(message);
      setSubscription(null);
    } finally {
      setIsSubscriptionLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!selectedVenueId) {
      setStaffAccounts([]);
      setSubscription(null);
      return;
    }

    void loadStaffAccounts(selectedVenueId);
    void loadSubscription(selectedVenueId);
  }, [loadStaffAccounts, loadSubscription, selectedVenueId]);

  const previewEmail = useMemo(() => {
    if (!selectedVenue) return '';
    return buildBusinessStaffLoginEmail({
      firstName,
      lastName,
      venueId: selectedVenue.id,
      venueName: selectedVenue.name,
      existingEmails: staffAccounts.map((account) => account.email),
    });
  }, [firstName, lastName, selectedVenue, staffAccounts]);

  const activeStaffAccounts = useMemo(
    () => staffAccounts.filter((account) => account.isActive),
    [staffAccounts],
  );
  const usedCalendarCount = 1 + activeStaffAccounts.length;
  const remainingCalendarCount = useMemo(() => {
    if (!subscription || subscription.maxCalendars === null) return Number.POSITIVE_INFINITY;
    return Math.max(0, subscription.maxCalendars - usedCalendarCount);
  }, [subscription, usedCalendarCount]);
  const isAtCalendarLimit = Boolean(
    subscription
    && subscription.maxCalendars !== null
    && usedCalendarCount >= subscription.maxCalendars,
  );
  const currentPlanId = subscription?.planId ?? FREE_PLAN_ID;
  const recommendedPlanId = getRecommendedUpgradePlanId(currentPlanId);
  const upgradeHref = selectedVenue
    ? `/pricing?venueId=${selectedVenue.id}&plan=${currentPlanId}&recommended=${recommendedPlanId}&billing=${subscription?.billingCycle ?? 'annual'}`
    : '/pricing';

  const resetForm = () => {
    setFirstName('');
    setLastName('');
    setRole('staff');
  };

  const handleCreateEmployee = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setCreatedCredentials(null);

    if (!selectedVenue) return;
    if (!canManageEmployees) {
      setError(t('Только роль business может создавать сотрудников'));
      return;
    }

    if (!firstName.trim() || !lastName.trim()) {
      setError(t('Укажите имя и фамилию сотрудника'));
      return;
    }

    if (isAtCalendarLimit) {
      debugWarn('calendar-limit.reached.create-blocked', {
        venueId: selectedVenue.id,
        planId: subscription?.planId,
        currentCalendarsCount: usedCalendarCount,
        maxCalendars: subscription?.maxCalendars,
      });
      setError('To add another staff member or resource, upgrade to a plan with more calendars.');
      return;
    }

    setIsSaving(true);
    try {
      const created = await createBusinessStaffAccount({
        venueId: selectedVenue.id,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        role,
        email: previewEmail,
      });
      setCreatedCredentials(created);
      setSuccess(t('Сотрудник создан. Передайте ему логин и временный пароль'));
      resetForm();
      await loadStaffAccounts(selectedVenue.id);
      await loadSubscription(selectedVenue.id);
    } catch (err) {
      const message = err instanceof Error ? t(err.message) : t('Не удалось создать сотрудника');
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRoleChange = async (accountId: string, nextRole: BusinessStaffRole) => {
    if (!selectedVenue || !canManageEmployees) return;

    setUpdatingId(accountId);
    setError('');
    setSuccess('');
    try {
      await updateBusinessStaffAccountRole({ accountId, role: nextRole });
      await loadStaffAccounts(selectedVenue.id);
      setSuccess(t('Роль сотрудника обновлена'));
    } catch (err) {
      const message = err instanceof Error ? t(err.message) : t('Не удалось обновить роль сотрудника');
      setError(message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (accountId: string) => {
    if (!selectedVenue || !canManageEmployees) return;

    setDeletingId(accountId);
    setError('');
    setSuccess('');
    try {
      await deleteBusinessStaffAccount(accountId);
      await loadStaffAccounts(selectedVenue.id);
      await loadSubscription(selectedVenue.id);
      setSuccess(t('Сотрудник удалён'));
    } catch (err) {
      const message = err instanceof Error ? t(err.message) : t('Не удалось удалить сотрудника');
      setError(message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleActiveStateChange = async (account: BusinessStaffAccount, nextIsActive: boolean) => {
    if (!selectedVenue || !canManageEmployees) return;

    setTogglingStatusId(account.id);
    setError('');
    setSuccess('');

    try {
      await updateBusinessStaffAccountActiveState({ accountId: account.id, isActive: nextIsActive });
      await loadStaffAccounts(selectedVenue.id);
      await loadSubscription(selectedVenue.id);
      setSuccess(nextIsActive ? t('Сотрудник снова активен') : t('Сотрудник деактивирован'));
    } catch (err) {
      const message = err instanceof Error ? err.message : t('Не удалось обновить статус сотрудника');
      if (nextIsActive) {
        debugWarn('calendar-limit.reached.reactivate-blocked', {
          venueId: selectedVenue.id,
          planId: subscription?.planId,
          currentCalendarsCount: usedCalendarCount,
          maxCalendars: subscription?.maxCalendars,
          staffAccountId: account.id,
        });
      }
      setError(message);
    } finally {
      setTogglingStatusId(null);
    }
  };

  const handleCopy = async (value: string, message: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setSuccess(message);
    } catch {
      setError(t('Не удалось скопировать данные'));
    }
  };

  if (ownedVenues.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary/50">
          <ShieldCheck className="h-7 w-7 text-muted-foreground/50" />
        </div>
        <p className="mb-4 text-muted-foreground">{t('Сначала создайте заведение')}</p>
        <Button onClick={() => navigate('/my-venues')}>{t('Создать заведение')}</Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-semibold tracking-tight text-foreground">{t('Сотрудники')}</h1>
        <p className="mt-2 text-muted-foreground">
          {t('Управляйте активными календарями команды, доступами и статусами сотрудников в одном месте.')}
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

      {(error || success || subscription) ? (
        <div className="space-y-2">
          {subscription ? (
            <Alert className="border-border/60 bg-background/80">
              <AlertDescription className="space-y-2">
                <p>
                  {subscription.maxCalendars === null
                    ? t('Вы используете {count} календарей на текущем тарифе.', { count: usedCalendarCount })
                    : t('Вы используете {count} из {total} календарей на текущем тарифе.', {
                        count: usedCalendarCount,
                        total: subscription.maxCalendars,
                      })}
                </p>
                <p className="text-muted-foreground">
                  {t(getPricingPlanTierById(subscription.planId)?.plan.name ?? subscription.planName)} · {t(getCalendarOptionLabel(subscription.maxCalendars))}
                </p>
                {isAtCalendarLimit ? (
                  <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
                    <p>{t('Чтобы добавить ещё одного сотрудника или ресурс, перейдите на тариф с большим числом календарей.')}</p>
                    <Button asChild size="sm" className="rounded-full">
                      <a href={upgradeHref}>{t('Обновить тариф')}</a>
                    </Button>
                  </div>
                ) : null}
                {!isAtCalendarLimit && Number.isFinite(remainingCalendarCount) ? (
                  <p className="text-muted-foreground">
                    {t('Осталось календарей на этом тарифе: {count}', { count: remainingCalendarCount })}
                  </p>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : null}
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

      {createdCredentials ? (
        <Card className="border-emerald-800/40 bg-emerald-950/20">
          <CardHeader>
            <CardTitle>{t('Данные для входа')}</CardTitle>
            <CardDescription>{t('Сохраните эти данные и передайте сотруднику')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
              <Input value={createdCredentials.email} readOnly className="h-11 bg-input/30 font-mono text-sm" />
              <Button type="button" variant="outline" onClick={() => void handleCopy(createdCredentials.email, t('Логин скопирован'))}>
                <Copy className="mr-2 h-4 w-4" />
                {t('Скопировать логин')}
              </Button>
            </div>
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
              <Input value={createdCredentials.temporaryPassword} readOnly className="h-11 bg-input/30 font-mono text-sm" />
              <Button type="button" variant="outline" onClick={() => void handleCopy(createdCredentials.temporaryPassword, t('Пароль скопирован'))}>
                <Copy className="mr-2 h-4 w-4" />
                {t('Скопировать пароль')}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <Card className="border-border/40">
          <CardHeader>
            <CardTitle>{t('Новый сотрудник')}</CardTitle>
            <CardDescription>
              {canManageEmployees
                ? t('Введите имя и фамилию. Система создаст отдельный календарь сотрудника и сгенерирует логин для входа.')
                : t('Только роль business может создавать новых сотрудников')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-border/40 bg-input/20 p-4 text-sm text-muted-foreground">
              {subscription?.maxCalendars === null
                ? t('Активные календари: {count} · Безлимитно на текущем тарифе', { count: usedCalendarCount })
                : t('Активные календари: {count} из {total}', {
                    count: usedCalendarCount,
                    total: subscription?.maxCalendars ?? '—',
                  })}
            </div>

            <form onSubmit={handleCreateEmployee} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="employee-first-name">{t('Имя')}</Label>
                <Input
                  id="employee-first-name"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  disabled={!canManageEmployees}
                  className="h-11 bg-input/50 border-border/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="employee-last-name">{t('Фамилия')}</Label>
                <Input
                  id="employee-last-name"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  disabled={!canManageEmployees}
                  className="h-11 bg-input/50 border-border/50"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('Роль')}</Label>
                <Select value={role} onValueChange={(value: BusinessStaffRole) => setRole(value)} disabled={!canManageEmployees}>
                  <SelectTrigger className="h-11 bg-input/50 border-border/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manager">{getRoleLabel('manager', t)}</SelectItem>
                    <SelectItem value="staff">{getRoleLabel('staff', t)}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('Логин для входа')}</Label>
                <Input value={previewEmail} readOnly className="h-11 bg-input/30 border-border/50 font-mono text-sm" />
              </div>
              <Button
                type="submit"
                className="h-11 w-full"
                disabled={!canManageEmployees || isSaving || isSubscriptionLoading || isAtCalendarLimit}
              >
                {isSaving ? t('Создание…') : t('Создать сотрудника')}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-border/40">
          <CardHeader>
            <CardTitle>{t('Доступ в админку')}</CardTitle>
            <CardDescription>{t('Владелец всегда имеет роль business. Для сотрудников можно менять роли или удалить доступ.')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    <span>{[user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() || user?.email}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                </div>
                <span className="rounded-full border border-primary/40 bg-primary/15 px-2.5 py-1 text-xs text-primary">
                  {getRoleLabel('business', t)}
                </span>
              </div>
            </div>

            {isLoading ? (
              <p className="text-sm text-muted-foreground">{t('Загружаем сотрудников…')}</p>
            ) : staffAccounts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/50 p-6 text-sm text-muted-foreground">
                {t('Дополнительных сотрудников пока нет')}
              </div>
            ) : (
              <div className="space-y-3">
                {staffAccounts.map((account) => (
                  <div key={account.id} className="rounded-2xl border border-border/40 bg-card/30 p-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                          <UserRound className="h-4 w-4 text-primary" />
                          <span>{`${account.firstName} ${account.lastName}`.trim()}</span>
                          <span
                            className={cn(
                              'rounded-full px-2.5 py-0.5 text-xs',
                              account.isActive
                                ? 'border border-emerald-800/40 bg-emerald-950/20 text-emerald-300'
                                : 'border border-border/60 bg-background/80 text-muted-foreground',
                            )}
                          >
                            {account.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{account.email}</p>
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Select
                          value={account.role}
                          onValueChange={(value: BusinessStaffRole) => void handleRoleChange(account.id, value)}
                          disabled={!canManageEmployees || updatingId === account.id || !account.isActive}
                        >
                          <SelectTrigger className="h-10 w-[160px] border-border/50 bg-input/40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="manager">{getRoleLabel('manager', t)}</SelectItem>
                            <SelectItem value="staff">{getRoleLabel('staff', t)}</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-10 border-border/50"
                          onClick={() => void handleActiveStateChange(account, !account.isActive)}
                          disabled={!canManageEmployees || togglingStatusId === account.id}
                        >
                          {account.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-10 border-red-900/30 text-red-400 hover:bg-red-950/30 hover:text-red-300"
                          onClick={() => void handleDelete(account.id)}
                          disabled={!canManageEmployees || deletingId === account.id}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          {t('Удалить')}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
