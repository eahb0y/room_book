import { useEffect, useMemo, useState } from 'react';
import { Check, Minus } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import MarketingFinalCta from '@/components/marketing/MarketingFinalCta';
import MarketingShell from '@/components/marketing/MarketingShell';
import { pricingComparisonSections, type PricingComparisonValue } from '@/content/b2bMarketing';
import { useI18n } from '@/i18n/useI18n';
import {
  FREE_PLAN_ID,
  formatSumPrice,
  getAdditionalCalendarPriceInSom,
  getCalendarOptionLabel,
  getDefaultTierForFamily,
  getPlanFamilyById,
  getPriceForPlanTier,
  getPricingPlanByFamily,
  getPricingPlanTierById,
  getRecommendedUpgradePlanId,
  getSubscriptionBillingModeForPlanId,
  pricingPlanCatalog,
  type PricingPlanFamily,
} from '@/lib/pricingCatalog';
import type { SubscriptionBillingMode, VenueSubscription } from '@/types';
import { getVenueSubscriptionSnapshot, changeVenueSubscriptionPlan } from '@/lib/subscriptionApi';
import { hasBusinessAccess, isBusinessOwner, getAccessibleBusinessVenues } from '@/lib/businessAccess';
import { useAuthStore } from '@/store/authStore';
import { useVenueStore } from '@/store/venueStore';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

type PaidPlanSelection = Record<'plus' | 'pro', string>;

const initialPlanSelections = (): PaidPlanSelection => ({
  plus: getDefaultTierForFamily('plus')?.planId ?? 'plus_1cal',
  pro: getDefaultTierForFamily('pro')?.planId ?? 'pro_1cal',
});

const formatPrice = (
  value: number | null,
  labels?: {
    freeLabel?: string;
    customLabel?: string;
  },
) => {
  if (value === null) return labels?.customLabel ?? 'Индивидуально';
  if (value === 0) return labels?.freeLabel ?? 'Бесплатно';
  return formatSumPrice(value);
};

const renderComparisonValue = (value: PricingComparisonValue) => {
  if (typeof value === 'boolean') {
    return value ? (
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border/60 bg-white/82 text-primary shadow-[0_16px_32px_-24px_rgba(18,44,87,0.18)]">
        <Check className="h-4.5 w-4.5" />
      </span>
    ) : (
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border/70 bg-white/72 text-muted-foreground">
        <Minus className="h-4 w-4" />
      </span>
    );
  }

  return (
    <span className="inline-flex min-h-11 items-center justify-center rounded-full border border-border/70 bg-white/72 px-3 py-2 text-sm font-semibold text-foreground">
      {value}
    </span>
  );
};

export default function B2BPricing() {
  const { t } = useI18n();
  const user = useAuthStore((state) => state.user);
  const venues = useVenueStore((state) => state.venues);
  const loadAdminData = useVenueStore((state) => state.loadAdminData);
  const [searchParams] = useSearchParams();
  const [selectedPlans, setSelectedPlans] = useState<PaidPlanSelection>(() => initialPlanSelections());
  const [selectedVenueId, setSelectedVenueId] = useState(searchParams.get('venueId') ?? '');
  const [subscription, setSubscription] = useState<VenueSubscription | null>(null);
  const [subscriptionError, setSubscriptionError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [isSubscriptionLoading, setIsSubscriptionLoading] = useState(false);
  const [changingPlanId, setChangingPlanId] = useState<string | null>(null);

  const isOwner = isBusinessOwner(user);
  const ownedVenues = useMemo(() => getAccessibleBusinessVenues(user, venues), [user, venues]);

  useEffect(() => {
    if (!user || !hasBusinessAccess(user) || !user.businessAccess.isOwner || venues.length > 0) return;

    void loadAdminData(user).catch(() => {
      // Pricing page can still work without venue-aware actions.
    });
  }, [loadAdminData, user, venues.length]);

  useEffect(() => {
    if (ownedVenues.length === 0) {
      setSelectedVenueId('');
      return;
    }

    setSelectedVenueId((current) => {
      const queryVenueId = searchParams.get('venueId');
      if (queryVenueId && ownedVenues.some((venue) => venue.id === queryVenueId)) {
        return queryVenueId;
      }

      return current && ownedVenues.some((venue) => venue.id === current) ? current : ownedVenues[0]?.id ?? '';
    });
  }, [ownedVenues, searchParams]);

  useEffect(() => {
    const planFromQuery = searchParams.get('plan');
    const recommendedFromQuery = searchParams.get('recommended');
    const nextState = initialPlanSelections();

    if (planFromQuery) {
      const family = getPlanFamilyById(planFromQuery);
      if (family === 'plus' || family === 'pro') {
        nextState[family] = planFromQuery;
      }
    }

    if (recommendedFromQuery) {
      const family = getPlanFamilyById(recommendedFromQuery);
      if ((family === 'plus' || family === 'pro') && !planFromQuery) {
        nextState[family] = recommendedFromQuery;
      }
    }

    setSelectedPlans(nextState);
  }, [searchParams]);

  useEffect(() => {
    if (!selectedVenueId || !isOwner) {
      setSubscription(null);
      setSubscriptionError('');
      return;
    }

    setIsSubscriptionLoading(true);
    setSubscriptionError('');

    void getVenueSubscriptionSnapshot(selectedVenueId)
      .then((snapshot) => {
        setSubscription(snapshot);

        const family = getPlanFamilyById(snapshot.planId);
        if (family === 'plus' || family === 'pro') {
          setSelectedPlans((current) => ({ ...current, [family]: snapshot.planId }));
        }
      })
      .catch((error) => {
        const message = error instanceof Error ? t(error.message) : t('Не удалось загрузить подписку');
        setSubscription(null);
        setSubscriptionError(message);
      })
      .finally(() => {
        setIsSubscriptionLoading(false);
      });
  }, [isOwner, selectedVenueId, t]);

  const currentPlanIdFromQuery = searchParams.get('plan');
  const recommendedPlanId = searchParams.get('recommended') ?? (
    currentPlanIdFromQuery ? getRecommendedUpgradePlanId(currentPlanIdFromQuery) : null
  );

  const currentPlanName = useMemo(() => {
    if (!subscription) return null;
    const currentPlan = getPricingPlanTierById(subscription.planId);
    if (!currentPlan) return null;
    return `${t(currentPlan.plan.name)} · ${t(getCalendarOptionLabel(currentPlan.tier.maxCalendars))}`;
  }, [subscription, t]);

  const usageLabel = useMemo(() => {
    if (!subscription) return null;
    if (subscription.maxCalendars === null) {
      return t('Вы используете {count} календарей на текущем тарифе.', {
        count: subscription.currentCalendarsCount,
      });
    }

    return t('Вы используете {count} из {total} календарей на текущем тарифе.', {
      count: subscription.currentCalendarsCount,
      total: subscription.maxCalendars,
    });
  }, [subscription, t]);

  const localizedPricingPlanCatalog = pricingPlanCatalog.map((plan) => ({
    ...plan,
    tagline: t(plan.tagline),
    description: t(plan.description),
    badge: plan.badge ? t(plan.badge) : undefined,
    ctaLabel: t(plan.ctaLabel),
    billingNote: plan.billingNote ? t(plan.billingNote) : undefined,
    durationLabel: t(plan.durationLabel),
    features: plan.features.map((feature) => t(feature)),
  }));
  const localizedComparisonSections = pricingComparisonSections.map((section) => ({
    title: t(section.title),
    rows: section.rows.map((row) => ({
      ...row,
      label: t(row.label),
      description: row.description ? t(row.description) : undefined,
      starter: typeof row.starter === 'string' ? t(row.starter) : row.starter,
      growth: typeof row.growth === 'string' ? t(row.growth) : row.growth,
      scale: typeof row.scale === 'string' ? t(row.scale) : row.scale,
    })),
  }));

  const getSelectedTier = (family: PricingPlanFamily) => {
    if (family === 'free') {
      return getPricingPlanTierById(FREE_PLAN_ID)?.tier ?? null;
    }

    const selectedPlanId = selectedPlans[family];
    return getPricingPlanTierById(selectedPlanId)?.tier ?? null;
  };

  const comparisonHeaderPlans = [
    { plan: getPricingPlanByFamily('free'), tier: getSelectedTier('free') },
    { plan: getPricingPlanByFamily('plus'), tier: getSelectedTier('plus') },
    { plan: getPricingPlanByFamily('pro'), tier: getSelectedTier('pro') },
  ];
  const recommendedPlan = recommendedPlanId ? getPricingPlanTierById(recommendedPlanId) : null;

  const handlePlanSelection = (family: 'plus' | 'pro', value: string) => {
    setSelectedPlans((current) => ({ ...current, [family]: value }));
  };

  const handleChoosePlan = async (planId: string) => {
    setActionError('');
    setActionSuccess('');

    if (!selectedVenueId || !isOwner) {
      return;
    }

    setChangingPlanId(planId);

    try {
      const updated = await changeVenueSubscriptionPlan({
        venueId: selectedVenueId,
        planId,
        billingCycle: getSubscriptionBillingModeForPlanId(planId) as SubscriptionBillingMode,
      });

      setSubscription(updated);
      setActionSuccess(
        t('Тариф обновлён: {plan}', {
          plan: `${t(getPricingPlanTierById(updated.planId)?.plan.name ?? updated.planName)} · ${t(getCalendarOptionLabel(updated.maxCalendars))}`,
        }),
      );
    } catch (error) {
      const message = error instanceof Error ? t(error.message) : t('Не удалось обновить тариф');
      setActionError(message);
    } finally {
      setChangingPlanId(null);
    }
  };

  return (
    <MarketingShell>
      <section className="mx-auto max-w-7xl px-4 pb-20 pt-14 sm:px-6 lg:px-8 lg:pt-20">
        <div className="relative overflow-hidden rounded-[2.6rem] border border-primary/15 bg-[linear-gradient(145deg,rgba(255,255,255,0.95),rgba(237,243,250,0.96))] px-6 py-8 shadow-[0_28px_80px_-48px_rgba(18,44,87,0.32)] sm:px-8 lg:px-10 lg:py-10">
          <div className="absolute right-[-3rem] top-[-4rem] h-52 w-52 rounded-full bg-primary/12 blur-3xl" />
          <div className="absolute bottom-[-5rem] left-[-3rem] h-48 w-48 rounded-full bg-[hsl(var(--teal)/0.12)] blur-3xl" />

          <div className="relative">
            <div className="max-w-4xl">
              <h1 className="text-4xl font-semibold leading-[0.96] text-foreground sm:text-5xl lg:text-6xl">
                {t('Сравните планы и выберите подписку, которая подходит вашей команде.')}
              </h1>
              <p className="mt-6 max-w-3xl text-base leading-8 text-muted-foreground sm:text-lg">
                {t(
                  'Посмотрите разницу между тарифами, условия запуска и выберите подходящий вариант для вашего бизнеса без лишних шагов.',
                )}
              </p>

              {isOwner && ownedVenues.length > 0 ? (
                <div className="mt-8 w-full min-w-[240px] max-w-sm">
                  <Select value={selectedVenueId} onValueChange={setSelectedVenueId}>
                    <SelectTrigger className="h-[58px] w-full rounded-[1.1rem] border-border/70 bg-white/72 px-4">
                      <SelectValue placeholder={t('Выберите бизнес')} />
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
              ) : null}
            </div>
          </div>
        </div>

        {(usageLabel || actionError || actionSuccess || subscriptionError || recommendedPlanId) ? (
          <div className="mt-6 space-y-3">
            {usageLabel ? (
              <Alert className="border-border/60 bg-background/80">
                <AlertDescription className="space-y-2">
                  <p>{usageLabel}</p>
                  {currentPlanName ? (
                    <p className="text-muted-foreground">{t('Текущий тариф: {value}', { value: currentPlanName })}</p>
                  ) : null}
                  {recommendedPlanId ? (
                    <p className="text-muted-foreground">
                      {t('Рекомендуемый следующий уровень: {value}', {
                        value: (() => {
                          const recommended = getPricingPlanTierById(recommendedPlanId);
                          if (!recommended) return recommendedPlanId;
                          return `${t(recommended.plan.name)} · ${t(getCalendarOptionLabel(recommended.tier.maxCalendars))}`;
                        })(),
                      })}
                    </p>
                  ) : null}
                </AlertDescription>
              </Alert>
            ) : null}

            {subscriptionError ? (
              <Alert variant="destructive">
                <AlertDescription>{subscriptionError}</AlertDescription>
              </Alert>
            ) : null}

            {actionError ? (
              <Alert variant="destructive">
                <AlertDescription>{actionError}</AlertDescription>
              </Alert>
            ) : null}

            {actionSuccess ? (
              <Alert className="border-[hsl(var(--success)/0.24)] bg-[hsl(var(--success)/0.12)]">
                <AlertDescription className="text-[hsl(var(--success-foreground))]">{actionSuccess}</AlertDescription>
              </Alert>
            ) : null}
          </div>
        ) : null}

        <div className="mt-10">
          <div className="grid gap-6 xl:grid-cols-[0.98fr_1.04fr_0.98fr]">
          {localizedPricingPlanCatalog.map((plan) => {
            const selectedTier = getSelectedTier(plan.family);
            const price = selectedTier ? getPriceForPlanTier(selectedTier) : null;
            const isStarterPlan = plan.family === 'free';
            const priceCaption = isStarterPlan
              ? plan.billingNote ?? t('1 месяц бесплатно')
              : price === null
                ? t('Свяжитесь с нами')
                : plan.billingNote ?? plan.durationLabel;
            const isCurrentPlan = subscription?.planId === selectedTier?.planId && subscription?.billingCycle === plan.subscriptionBillingMode;
            const isRecommendedPlan = recommendedPlanId === selectedTier?.planId;
            const isRecommendedFamily = recommendedPlan?.plan.family === plan.family;
            const ctaHref = `/business/register?plan=${selectedTier?.planId ?? FREE_PLAN_ID}&billing=${plan.subscriptionBillingMode}`;
            const priceNote = isStarterPlan
              ? t('После пробного месяца выберете платный тариф.')
              : selectedTier?.maxCalendars === null
                ? t('Цена для безлимитного тарифа обсуждается отдельно.')
                : t('Первый календарь включён в тариф. Каждый следующий: {value}.', {
                    value: formatSumPrice(getAdditionalCalendarPriceInSom(plan.family)),
                  });
            const priceNoteClassName = isStarterPlan
              ? 'text-foreground'
              : selectedTier?.maxCalendars === null
                ? 'text-muted-foreground'
                : 'text-primary';

            return (
              <article
                key={plan.family}
                className={cn(
                  'relative overflow-hidden rounded-[2.2rem] border p-7 shadow-[0_26px_72px_-48px_rgba(18,44,87,0.28)] lg:p-8',
                  plan.highlighted
                    ? 'border-primary/30 bg-[linear-gradient(155deg,rgba(242,247,255,0.98),rgba(226,236,251,0.94))] shadow-[0_34px_84px_-44px_hsl(var(--primary)/0.46)]'
                    : plan.family === 'pro'
                      ? 'border-border/70 bg-[linear-gradient(155deg,rgba(255,255,255,0.96),rgba(236,242,250,0.94))]'
                      : 'border-border/70 bg-[linear-gradient(155deg,rgba(255,255,255,0.98),rgba(242,247,252,0.95))]',
                  isRecommendedPlan || isRecommendedFamily ? 'ring-2 ring-primary/30' : '',
                )}
              >
                <div
                  className={cn(
                    'absolute inset-x-0 top-0 h-24',
                    plan.highlighted
                      ? 'bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.18),transparent_70%)]'
                      : 'bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.86),transparent_72%)]',
                  )}
                />

                <div className="relative flex h-full flex-col">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="rounded-full border border-border/70 bg-white/74 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                        {plan.family === 'free' ? t('Старт') : plan.highlighted ? t('Рост') : t('Масштаб')}
                      </span>
                      <h2 className="mt-5 text-3xl font-semibold text-foreground">{t(plan.name)}</h2>
                      <p className="mt-2 max-w-[16rem] text-sm leading-6 text-muted-foreground">{plan.tagline}</p>
                    </div>
                    {plan.badge ? (
                      <span className="rounded-full border border-primary/15 bg-white/90 px-3 py-1 text-xs font-semibold text-primary shadow-sm">
                        {plan.badge}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-6 rounded-[1.7rem] border border-border/70 bg-white/74 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
                    {plan.family !== 'free' ? (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{t('Календари')}</p>
                        <Select
                          value={selectedTier?.planId}
                          onValueChange={(value) => handlePlanSelection(plan.family as 'plus' | 'pro', value)}
                        >
                          <SelectTrigger className="h-11 w-full rounded-[1rem] border-border/60 bg-background/80">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {plan.tiers.map((tier) => (
                              <SelectItem key={tier.planId} value={tier.planId}>
                                {t(getCalendarOptionLabel(tier.maxCalendars))}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <div className="rounded-[1.1rem] border border-border/60 bg-background/82 px-4 py-3 text-sm font-medium text-foreground">
                        {t('Пробный доступ на 1 месяц')}
                      </div>
                    )}

                    <div className="mt-5 flex items-end gap-2">
                      <p className="text-5xl font-semibold tracking-tight text-foreground">
                        {formatPrice(price, {
                          freeLabel: t('Бесплатно'),
                          customLabel: t('Индивидуально'),
                        })}
                      </p>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{priceCaption}</p>
                    <p className={cn('mt-2 text-sm font-medium', priceNoteClassName)}>{priceNote}</p>
                    {isRecommendedPlan ? (
                      <p className="mt-2 text-xs font-medium text-primary">{t('Рекомендуемое улучшение под текущую нагрузку')}</p>
                    ) : isRecommendedFamily && recommendedPlan ? (
                      <p className="mt-2 text-xs font-medium text-primary">
                        {t('Рекомендуемый следующий уровень: {value}', {
                          value: t(getCalendarOptionLabel(recommendedPlan.tier.maxCalendars)),
                        })}
                      </p>
                    ) : null}
                  </div>

                <p className="mt-6 text-sm leading-7 text-muted-foreground">{plan.description}</p>

                <div className="mt-6 rounded-[1.7rem] border border-border/70 bg-background/78 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{t('Что входит')}</p>
                    <ul className="mt-4 space-y-3">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex gap-3 border-t border-border/50 pt-3 first:border-t-0 first:pt-0">
                          <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <Check className="h-3.5 w-3.5" />
                          </span>
                          <span className="text-sm leading-6 text-foreground/90">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {isOwner && selectedVenueId ? (
                    <Button
                      type="button"
                      className="mt-6 h-12 w-full rounded-full"
                      disabled={isCurrentPlan || changingPlanId === selectedTier?.planId || isSubscriptionLoading}
                      onClick={() => {
                        if (!selectedTier) return;
                        void handleChoosePlan(selectedTier.planId);
                      }}
                    >
                      {isCurrentPlan
                        ? t('Текущий тариф')
                        : changingPlanId === selectedTier?.planId
                          ? t('Обновляем…')
                          : plan.ctaLabel}
                    </Button>
                  ) : (
                    <Button asChild className="mt-6 h-12 w-full rounded-full">
                      <Link to={ctaHref}>{plan.ctaLabel}</Link>
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
          </div>
        </div>

        <div className="mt-14 overflow-hidden rounded-[2.5rem] border border-border/70 bg-[linear-gradient(160deg,rgba(255,255,255,0.97),rgba(234,241,249,0.94))] shadow-[0_28px_84px_-54px_rgba(18,44,87,0.34)]">
          <div className="relative border-b border-border/60 px-6 py-8 sm:px-8 lg:px-10">
            <div className="absolute inset-y-0 right-0 hidden w-1/3 bg-[radial-gradient(circle_at_center,hsl(var(--primary)/0.12),transparent_62%)] lg:block" />

            <div className="relative grid gap-8 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] xl:items-end">
              <div className="max-w-lg">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">{t('Планы и возможности')}</p>
                <h2 className="mt-4 text-3xl font-semibold text-foreground sm:text-4xl">
                  {t('Разница между тарифами читается с первого взгляда.')}
                </h2>
                <p className="mt-4 text-sm leading-7 text-muted-foreground sm:text-base">
                  {t(
                    'Сначала короткая сводка по каждому плану, ниже точная матрица по рабочим сценариям, ролям, площадкам и уведомлениям.',
                  )}
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {comparisonHeaderPlans.map((entry) => {
                  if (!entry.plan || !entry.tier) return null;
                  const price = getPriceForPlanTier(entry.tier);
                  const isStarterPlan = entry.plan.family === 'free';
                  const priceCaption = isStarterPlan
                    ? t(entry.plan.billingNote ?? '1 месяц бесплатно')
                    : t(entry.plan.billingNote ?? entry.plan.durationLabel);

                  return (
                    <div
                      key={entry.plan.family}
                      className={cn(
                        'rounded-[1.8rem] border p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]',
                        entry.plan.highlighted
                          ? 'border-primary/20 bg-primary/[0.06]'
                          : 'border-border/70 bg-white/74',
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xl font-semibold text-foreground">{t(entry.plan.name)}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{t(entry.plan.tagline)}</p>
                        </div>
                      </div>

                      <div className="mt-5 flex items-end gap-2">
                        <p className="text-4xl font-semibold tracking-tight text-foreground">
                          {formatPrice(price, {
                            freeLabel: t('Бесплатно'),
                            customLabel: t('Индивидуально'),
                          })}
                        </p>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{priceCaption}</p>
                      <p className="mt-4 text-sm font-medium text-foreground">
                        {entry.plan.family === 'free'
                          ? t('Пробный доступ на 1 месяц')
                          : t(getCalendarOptionLabel(entry.tier.maxCalendars))}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-separate border-spacing-0">
              <thead>
                <tr className="bg-background/66 align-middle">
                  <th className="w-[36%] px-6 py-5 text-left sm:px-8">
                    <span className="inline-flex rounded-full border border-border/70 bg-white/82 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      {t('Сравнение по сценариям')}
                    </span>
                  </th>
                  {comparisonHeaderPlans.map((entry) => {
                    if (!entry.plan || !entry.tier) return null;

                    return (
                      <th
                        key={entry.plan.family}
                        className={cn(
                          'px-4 py-5 text-left align-middle',
                          entry.plan.highlighted ? 'bg-primary/[0.04]' : '',
                        )}
                        >
                        <div className="rounded-[1.2rem] border border-border/60 bg-white/78 px-4 py-3">
                          <p className="text-base font-semibold text-foreground">{t(entry.plan.name)}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {entry.plan.family === 'free'
                              ? t('Пробный доступ на 1 месяц')
                              : t(getCalendarOptionLabel(entry.tier.maxCalendars))}
                          </p>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              {localizedComparisonSections.map((section) => (
                <tbody key={section.title}>
                  <tr>
                    <th colSpan={4} className="px-6 pb-3 pt-6 text-left sm:px-8">
                      <span className="inline-flex rounded-full border border-border/70 bg-white/86 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-foreground/80">
                        {section.title}
                      </span>
                    </th>
                  </tr>
                  {section.rows.map((row) => (
                    <tr key={row.label}>
                      <td className="px-6 py-4 align-top sm:px-8">
                        <div
                          className={cn(
                            'rounded-[1.35rem] border p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]',
                            row.highlighted ? 'border-border/60 bg-white/74' : 'border-border/60 bg-white/74',
                          )}
                        >
                          <p className="text-sm font-semibold text-foreground">{row.label}</p>
                          {row.description ? (
                            <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{row.description}</p>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center align-middle">
                        <div className="rounded-[1.35rem] border border-border/60 bg-white/68 p-3">
                          {renderComparisonValue(row.starter)}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center align-middle">
                        <div className="rounded-[1.35rem] border border-border/60 bg-white/68 p-3">
                          {renderComparisonValue(row.growth)}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center align-middle">
                        <div className="rounded-[1.35rem] border border-border/60 bg-white/68 p-3">
                          {renderComparisonValue(row.scale)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
        </div>
      </section>

      <MarketingFinalCta
        eyebrow="Первый месяц бесплатно"
        title="Зарегистрируйтесь и получите первый месяц бесплатно."
        description="Подключите площадку, настройте запись и посмотрите, как TezBron работает в реальном процессе без оплаты в первый месяц."
      />
    </MarketingShell>
  );
}
