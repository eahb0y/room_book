export interface SeoOptions {
  title: string;
  description: string;
  path?: string;
  type?: 'website' | 'article';
  image?: string;
  robots?: string;
  keywords?: string;
  locale?: string;
  structuredData?: Record<string, unknown> | Array<Record<string, unknown>>;
}

const DEFAULT_ROBOTS = 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1';

const normalizeUrl = (value: string): string => value.replace(/\/+$/, '');

export const getSiteUrl = (): string => {
  const configuredUrl = import.meta.env.VITE_SITE_URL;
  if (typeof configuredUrl === 'string' && configuredUrl.trim().length > 0) {
    return normalizeUrl(configuredUrl.trim());
  }

  if (typeof window !== 'undefined' && window.location.origin) {
    return normalizeUrl(window.location.origin);
  }

  return '';
};

export const toAbsoluteUrl = (value: string): string => {
  if (/^https?:\/\//i.test(value)) return value;
  const siteUrl = getSiteUrl();
  if (!siteUrl) return value;
  return `${siteUrl}${value.startsWith('/') ? value : `/${value}`}`;
};

const upsertMeta = (
  selectorValue: string,
  content: string,
  attribute: 'name' | 'property' = 'name',
): void => {
  let element = document.head.querySelector(`meta[${attribute}="${selectorValue}"]`) as HTMLMetaElement | null;
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, selectorValue);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
};

const upsertCanonical = (href: string): void => {
  let element = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', 'canonical');
    document.head.appendChild(element);
  }
  element.setAttribute('href', href);
};

const upsertJsonLd = (structuredData: SeoOptions['structuredData']): void => {
  const scriptId = 'seo-structured-data';
  const existing = document.getElementById(scriptId);

  if (!structuredData) {
    existing?.remove();
    return;
  }

  const payload = Array.isArray(structuredData) ? structuredData : [structuredData];
  const json = payload.length === 1 ? payload[0] : payload;

  const script = existing ?? document.createElement('script');
  script.id = scriptId;
  script.setAttribute('type', 'application/ld+json');
  script.textContent = JSON.stringify(json);

  if (!existing) {
    document.head.appendChild(script);
  }
};

const normalizePath = (value: string): string => {
  if (!value) return '/';
  return value.startsWith('/') ? value : `/${value}`;
};

export const applySeo = (options: SeoOptions): void => {
  if (typeof document === 'undefined') return;

  const siteUrl = getSiteUrl();
  const canonicalPath = normalizePath(options.path ?? window.location.pathname);
  const canonicalUrl = siteUrl ? `${siteUrl}${canonicalPath}` : canonicalPath;
  const socialImage = toAbsoluteUrl(options.image ?? '/favicon.svg');

  document.title = options.title;

  const htmlLang = options.locale?.split('_')[0] ?? 'ru';
  document.documentElement.setAttribute('lang', htmlLang);

  upsertMeta('description', options.description);
  upsertMeta('robots', options.robots ?? DEFAULT_ROBOTS);
  if (options.keywords) {
    upsertMeta('keywords', options.keywords);
  }

  upsertCanonical(canonicalUrl);

  upsertMeta('og:type', options.type ?? 'website', 'property');
  upsertMeta('og:title', options.title, 'property');
  upsertMeta('og:description', options.description, 'property');
  upsertMeta('og:url', canonicalUrl, 'property');
  upsertMeta('og:image', socialImage, 'property');
  upsertMeta('og:site_name', 'TezBron', 'property');
  upsertMeta('og:locale', options.locale ?? 'ru_RU', 'property');

  upsertMeta('twitter:card', 'summary_large_image');
  upsertMeta('twitter:title', options.title);
  upsertMeta('twitter:description', options.description);
  upsertMeta('twitter:image', socialImage);

  upsertJsonLd(options.structuredData);
};
