type TranslateFn = (value: string, params?: Record<string, string | number>) => string;

export const normalizeResidentPromoCode = (value: string) => value.trim().toLowerCase();

export const formatResidentPromoCode = (value: string) => normalizeResidentPromoCode(value).toUpperCase();

export const getResidentPromoTitle = (venueName: string | undefined, t: TranslateFn) =>
  venueName
    ? t('Промокод резидента в «{venue}»', { venue: venueName })
    : t('Промокод резидента');

export const getResidentPromoDescription = (t: TranslateFn) =>
  t('Открывает доступ к закрытым комнатам и слотам для резидентов этого бизнеса');
