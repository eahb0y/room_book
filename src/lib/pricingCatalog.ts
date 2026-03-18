export type BillingMode = 'monthly' | 'annual';
export type PricingPlanFamily = 'free' | 'plus' | 'pro';

export interface PricingPlanTier {
  planId: string;
  maxCalendars: number | null;
  price: number | null;
}

export interface PricingPlanDefinition {
  family: PricingPlanFamily;
  name: string;
  tagline: string;
  description: string;
  badge?: string;
  highlighted?: boolean;
  ctaLabel: string;
  billingNote?: string;
  durationLabel: string;
  subscriptionBillingMode: BillingMode;
  tiers: PricingPlanTier[];
  features: string[];
}

export const FREE_PLAN_ID = 'free_unlimited';
export const MONTHLY_ADDITIONAL_CALENDAR_PRICE_IN_SOM = 49_000;
export const ANNUAL_ADDITIONAL_CALENDAR_PRICE_IN_SOM = 490_000;

const PLUS_BASE_PRICE_IN_SOM = 99_000;
const PRO_BASE_PRICE_IN_SOM = 990_000;

const buildTier = (
  planId: string,
  maxCalendars: number | null,
  basePriceInSom: number,
  additionalCalendarPriceInSom: number,
): PricingPlanTier => ({
  planId,
  maxCalendars,
  price: maxCalendars === null
    ? null
    : basePriceInSom + Math.max(0, maxCalendars - 1) * additionalCalendarPriceInSom,
});

export const pricingPlanCatalog: PricingPlanDefinition[] = [
  {
    family: 'free',
    name: 'Starter',
    tagline: 'Первый месяц бесплатно',
    description: 'Подключите первую площадку, запустите запись и проверьте сервис в работе без оплаты в первый месяц.',
    badge: '1 месяц бесплатно',
    ctaLabel: 'Попробовать бесплатно',
    billingNote: '1 месяц бесплатно',
    durationLabel: '1 месяц',
    subscriptionBillingMode: 'monthly',
    tiers: [
      {
        planId: FREE_PLAN_ID,
        maxCalendars: null,
        price: 0,
      },
    ],
    features: [
      'Первый месяц без оплаты',
      'Страница онлайн-записи',
      'Запись без обязательной регистрации',
      'Базовые подтверждения и история бронирований',
      'Первый запуск без дополнительных настроек',
    ],
  },
  {
    family: 'plus',
    name: 'Месячный',
    tagline: 'Для растущих команд',
    description: 'Подходит, когда нужно больше календарей, напоминания клиентам и прозрачная работа команды.',
    badge: 'Самый популярный',
    highlighted: true,
    ctaLabel: 'Попробовать бесплатно',
    billingNote: 'за 1 месяц',
    durationLabel: '1 месяц',
    subscriptionBillingMode: 'monthly',
    tiers: [
      buildTier('plus_1cal', 1, PLUS_BASE_PRICE_IN_SOM, MONTHLY_ADDITIONAL_CALENDAR_PRICE_IN_SOM),
      buildTier('plus_2cal', 2, PLUS_BASE_PRICE_IN_SOM, MONTHLY_ADDITIONAL_CALENDAR_PRICE_IN_SOM),
      buildTier('plus_3cal', 3, PLUS_BASE_PRICE_IN_SOM, MONTHLY_ADDITIONAL_CALENDAR_PRICE_IN_SOM),
      buildTier('plus_4cal', 4, PLUS_BASE_PRICE_IN_SOM, MONTHLY_ADDITIONAL_CALENDAR_PRICE_IN_SOM),
      buildTier('plus_5cal', 5, PLUS_BASE_PRICE_IN_SOM, MONTHLY_ADDITIONAL_CALENDAR_PRICE_IN_SOM),
      buildTier('plus_10cal', 10, PLUS_BASE_PRICE_IN_SOM, MONTHLY_ADDITIONAL_CALENDAR_PRICE_IN_SOM),
      buildTier('plus_20cal', 20, PLUS_BASE_PRICE_IN_SOM, MONTHLY_ADDITIONAL_CALENDAR_PRICE_IN_SOM),
      buildTier('plus_unlimited', null, PLUS_BASE_PRICE_IN_SOM, MONTHLY_ADDITIONAL_CALENDAR_PRICE_IN_SOM),
    ],
    features: [
      'Календари для команды и ресурсов',
      'Автоматические напоминания клиентам',
      'Синхронизация календаря',
      'Telegram-уведомления о бронированиях',
    ],
  },
  {
    family: 'pro',
    name: 'Годовой',
    tagline: 'Фиксируйте цену на год',
    description: 'Годовой тариф для команд, которым важно закрепить стоимость и работать без ежемесячного продления.',
    ctaLabel: 'Выбрать годовой',
    billingNote: 'за 1 год',
    durationLabel: '1 год',
    subscriptionBillingMode: 'annual',
    tiers: [
      buildTier('pro_1cal', 1, PRO_BASE_PRICE_IN_SOM, ANNUAL_ADDITIONAL_CALENDAR_PRICE_IN_SOM),
      buildTier('pro_2cal', 2, PRO_BASE_PRICE_IN_SOM, ANNUAL_ADDITIONAL_CALENDAR_PRICE_IN_SOM),
      buildTier('pro_3cal', 3, PRO_BASE_PRICE_IN_SOM, ANNUAL_ADDITIONAL_CALENDAR_PRICE_IN_SOM),
      buildTier('pro_4cal', 4, PRO_BASE_PRICE_IN_SOM, ANNUAL_ADDITIONAL_CALENDAR_PRICE_IN_SOM),
      buildTier('pro_5cal', 5, PRO_BASE_PRICE_IN_SOM, ANNUAL_ADDITIONAL_CALENDAR_PRICE_IN_SOM),
      buildTier('pro_10cal', 10, PRO_BASE_PRICE_IN_SOM, ANNUAL_ADDITIONAL_CALENDAR_PRICE_IN_SOM),
      buildTier('pro_20cal', 20, PRO_BASE_PRICE_IN_SOM, ANNUAL_ADDITIONAL_CALENDAR_PRICE_IN_SOM),
      buildTier('pro_unlimited', null, PRO_BASE_PRICE_IN_SOM, ANNUAL_ADDITIONAL_CALENDAR_PRICE_IN_SOM),
    ],
    features: [
      'Все возможности месячного тарифа',
      'Расширенные роли и доступы',
      'Управление сетью площадок',
      'Журнал действий и контроль изменений',
    ],
  },
];

const planFamilyById = new Map(
  pricingPlanCatalog.flatMap((plan) => plan.tiers.map((tier) => [tier.planId, plan.family] as const)),
);

export const calendarSelectionOptions = pricingPlanCatalog
  .find((plan) => plan.family === 'plus')
  ?.tiers.map((tier) => tier.maxCalendars) ?? [1, 2, 3, 4, 5, 10, 20, null];

const getCalendarWord = (value: number) => {
  const remainder10 = value % 10;
  const remainder100 = value % 100;

  if (remainder10 === 1 && remainder100 !== 11) return 'календарь';
  if (remainder10 >= 2 && remainder10 <= 4 && (remainder100 < 12 || remainder100 > 14)) {
    return 'календаря';
  }

  return 'календарей';
};

export const getCalendarOptionLabel = (value: number | null) => {
  if (value === null) return 'Безлимитно';
  return `${value} ${getCalendarWord(value)}`;
};

export const getPricingPlanByFamily = (family: PricingPlanFamily) =>
  pricingPlanCatalog.find((plan) => plan.family === family) ?? null;

export const getAdditionalCalendarPriceInSom = (family: PricingPlanFamily) => {
  if (family === 'pro') return ANNUAL_ADDITIONAL_CALENDAR_PRICE_IN_SOM;
  return MONTHLY_ADDITIONAL_CALENDAR_PRICE_IN_SOM;
};

export const getPricingPlanTierById = (planId: string) => {
  for (const plan of pricingPlanCatalog) {
    const tier = plan.tiers.find((item) => item.planId === planId);
    if (tier) {
      return { plan, tier };
    }
  }

  return null;
};

export const getPricingPlanTierByCalendars = (family: PricingPlanFamily, maxCalendars: number | null) => {
  const plan = getPricingPlanByFamily(family);
  if (!plan) return null;
  return plan.tiers.find((tier) => tier.maxCalendars === maxCalendars) ?? null;
};

export const getDefaultTierForFamily = (family: PricingPlanFamily) => {
  const plan = getPricingPlanByFamily(family);
  if (!plan) return null;
  return family === 'free' ? plan.tiers[0] ?? null : plan.tiers.find((tier) => tier.maxCalendars === 1) ?? plan.tiers[0] ?? null;
};

export const getSubscriptionBillingModeForPlanId = (planId: string): BillingMode =>
  getPricingPlanTierById(planId)?.plan.subscriptionBillingMode ?? 'monthly';

export const getPriceForPlanTier = (tier: PricingPlanTier) => tier.price;

export const formatSumPrice = (value: number | null) => {
  if (value === null) return 'Индивидуально';
  return `${value.toLocaleString('ru-RU').replace(/\s/g, '.')} sum`;
};

export const getPlanFamilyById = (planId: string): PricingPlanFamily | null =>
  planFamilyById.get(planId) ?? null;

export const getRecommendedUpgradePlanId = (planId: string) => {
  const current = getPricingPlanTierById(planId);
  if (!current) return 'plus_1cal';

  if (current.plan.family === 'free') {
    return 'plus_1cal';
  }

  const currentIndex = current.plan.tiers.findIndex((tier) => tier.planId === current.tier.planId);
  const nextTier = current.plan.tiers[currentIndex + 1];
  if (nextTier) return nextTier.planId;

  if (current.plan.family === 'plus') {
    return 'pro_1cal';
  }

  return current.tier.planId;
};

export const isKnownPlanId = (planId: string | null | undefined): planId is string =>
  Boolean(planId && getPricingPlanTierById(planId));
