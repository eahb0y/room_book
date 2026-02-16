import { useCallback } from 'react';
import { getDateLocale, getIntlLocale, translate } from '@/i18n/messages';
import { useLocaleStore } from '@/store/localeStore';

type InterpolateParams = Record<string, string | number>;

export const useI18n = () => {
  const locale = useLocaleStore((state) => state.locale);
  const setLocale = useLocaleStore((state) => state.setLocale);

  const t = useCallback(
    (value: string, params?: InterpolateParams) => translate(value, locale, params),
    [locale],
  );

  return {
    locale,
    setLocale,
    t,
    dateLocale: getDateLocale(locale),
    intlLocale: getIntlLocale(locale),
  };
};
