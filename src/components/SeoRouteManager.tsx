import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { applySeo, getSiteUrl } from '@/lib/seo';

const INDEX_ROBOTS = 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1';
const NO_INDEX_ROBOTS = 'noindex,nofollow,noarchive,nosnippet';

const createWebsiteSchema = (path: string, title: string, description: string) => {
  const siteUrl = getSiteUrl();
  const pageUrl = `${siteUrl}${path}`;

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
      inLanguage: 'ru',
      potentialAction: {
        '@type': 'SearchAction',
        target: `${siteUrl}/?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
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

const resolveSeoByPath = (pathname: string) => {
  if (pathname === '/') {
    const title = 'Бронирование пространств и переговорных | TezBron';
    const description =
      'TezBron — маркетплейс для бронирования переговорных, коворкингов, студий и других пространств по времени.';

    return {
      title,
      description,
      path: '/',
      robots: INDEX_ROBOTS,
      keywords:
        'бронирование переговорных, бронирование коворкинга, аренда пространства, каталог комнат, TezBron',
      structuredData: createWebsiteSchema('/', title, description),
    };
  }

  if (pathname === '/business/landing') {
    const title = 'Добавить бизнес на платформу бронирования | TezBron';
    const description =
      'Подключите бизнес к TezBron: создайте карточку, добавьте комнаты, управляйте слотами и бронированиями в одном кабинете.';

    return {
      title,
      description,
      path: '/business/landing',
      robots: INDEX_ROBOTS,
      keywords:
        'добавить бизнес, управление бронированиями, кабинет бизнеса, подключение площадки, TezBron',
      structuredData: createWebsiteSchema('/business/landing', title, description),
    };
  }

  if (
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/business/login' ||
    pathname === '/business/register' ||
    pathname.startsWith('/invite/')
  ) {
    return {
      title: 'Вход в TezBron',
      description: 'Авторизация и регистрация в TezBron.',
      path: pathname.startsWith('/invite/') ? '/invite' : pathname,
      robots: NO_INDEX_ROBOTS,
    };
  }

  return {
    title: 'TezBron',
    description: 'Платформа для бронирования пространств.',
    path: pathname,
    robots: NO_INDEX_ROBOTS,
  };
};

export default function SeoRouteManager() {
  const location = useLocation();

  useEffect(() => {
    const seo = resolveSeoByPath(location.pathname);
    applySeo(seo);
  }, [location.pathname]);

  return null;
}
