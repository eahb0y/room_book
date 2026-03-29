import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useI18n } from '@/i18n/useI18n';
import { applySeo, getSiteUrl } from '@/lib/seo';
import type { AppLocale } from '@/store/localeStore';

const INDEX_ROBOTS = 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1';
const NO_INDEX_ROBOTS = 'noindex,nofollow,noarchive,nosnippet';

const createMarketingSchema = (path: string, title: string, description: string, locale: AppLocale) => {
  const siteUrl = getSiteUrl();
  const pageUrl = `${siteUrl}${path}`;
  const language = locale === 'uz' ? 'uz' : 'ru';

  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'TezBron',
      url: siteUrl,
      logo: `${siteUrl}/favicon.svg`,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'TezBron',
      url: siteUrl,
      inLanguage: language,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'TezBron',
      url: pageUrl,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      description,
      brand: {
        '@type': 'Brand',
        name: 'TezBron',
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: title,
      description,
      url: pageUrl,
      isPartOf: {
        '@type': 'WebSite',
        name: 'TezBron',
        url: siteUrl,
      },
    },
  ];
};

const resolveSeoByPath = (
  pathname: string,
  t: (value: string) => string,
  locale: AppLocale,
) => {
  const localeCode = locale === 'uz' ? 'uz_UZ' : 'ru_RU';

  if (pathname === '/') {
    const title = t('Платформа онлайн-бронирования для бизнеса | TezBron');
    const description = t(
      'TezBron — B2B-платформа онлайн-бронирования для владельцев, менеджеров и команд: без маркетплейса, с акцентом на управление и рост.',
    );

    return {
      title,
      description,
      path: '/',
      robots: INDEX_ROBOTS,
      keywords: t(
        'B2B онлайн-бронирование, booking software для бизнеса, управление бронированиями, SaaS для сервисного бизнеса, TezBron',
      ),
      locale: localeCode,
      structuredData: createMarketingSchema('/', title, description, locale),
    };
  }

  if (pathname === '/features') {
    const title = t('Функции платформы онлайн-бронирования | TezBron');
    const description = t(
      'Изучите B2B-функции TezBron: запись, роли, площадки, история бронирований, уведомления и единый операционный контур.',
    );

    return {
      title,
      description,
      path: '/features',
      robots: NO_INDEX_ROBOTS,
      keywords: t('функции TezBron, booking software features, B2B SaaS, управление записью, роли команды, TezBron'),
      locale: localeCode,
      structuredData: createMarketingSchema('/features', title, description, locale),
    };
  }

  if (pathname === '/pricing') {
    const title = t('Тарифы для бизнеса | TezBron');
    const description = t(
      'Сравните тарифы TezBron для B2B-команд: запуск, рост, мульти-локации, роли, уведомления и поддержка внедрения.',
    );

    return {
      title,
      description,
      path: '/pricing',
      robots: NO_INDEX_ROBOTS,
      keywords: t('pricing TezBron, тарифы booking software, цена платформы бронирования, B2B SaaS pricing, TezBron'),
      locale: localeCode,
      structuredData: createMarketingSchema('/pricing', title, description, locale),
    };
  }

  if (pathname === '/about') {
    const title = t('О платформе TezBron | TezBron');
    const description = t(
      'Узнайте, как TezBron помогает бизнесу заменить маркетплейс собственным B2B-сайтом и единым контуром управления бронированиями.',
    );

    return {
      title,
      description,
      path: '/about',
      robots: INDEX_ROBOTS,
      keywords: t('о TezBron, B2B платформа записи, SaaS для сервисного бизнеса, управление локациями, TezBron'),
      locale: localeCode,
      structuredData: createMarketingSchema('/about', title, description, locale),
    };
  }

  if (pathname === '/blog') {
    const title = t('B2B блог о записи и операциях | TezBron');
    const description = t(
      'Материалы TezBron о записи, управлении командами, ролях, росте сервисного бизнеса и переходе от маркетплейса к собственному B2B-сайту.',
    );

    return {
      title,
      description,
      path: '/blog',
      robots: INDEX_ROBOTS,
      keywords: t('B2B blog booking software, блог о записях, growth для сервисного бизнеса, operations blog, TezBron'),
      locale: localeCode,
      structuredData: createMarketingSchema('/blog', title, description, locale),
    };
  }

  if (
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/business/login' ||
    pathname === '/business/register' ||
    pathname === '/business/landing' ||
    pathname.startsWith('/invite/')
  ) {
    return {
      title: t('Вход в TezBron'),
      description: t('Авторизация и регистрация в TezBron.'),
      path: pathname.startsWith('/invite/') ? '/invite' : pathname,
      robots: NO_INDEX_ROBOTS,
      locale: localeCode,
    };
  }

  return {
    title: 'TezBron',
    description: t('Платформа для бронирования пространств.'),
    path: pathname,
    robots: NO_INDEX_ROBOTS,
    locale: localeCode,
  };
};

export default function SeoRouteManager() {
  const location = useLocation();
  const { locale, t } = useI18n();

  useEffect(() => {
    const seo = resolveSeoByPath(location.pathname, t, locale);
    applySeo(seo);
  }, [location.pathname, locale, t]);

  return null;
}
