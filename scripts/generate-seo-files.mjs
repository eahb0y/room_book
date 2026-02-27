import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const normalizeUrl = (value) => value.replace(/\/+$/, '');

const rawSiteUrl =
  process.env.VITE_SITE_URL ||
  process.env.URL ||
  process.env.DEPLOY_PRIME_URL ||
  'https://example.com';

const siteUrl = normalizeUrl(rawSiteUrl);
const generatedAt = new Date().toISOString().slice(0, 10);
const publicDir = resolve(process.cwd(), 'public');

const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${siteUrl}/</loc>
    <lastmod>${generatedAt}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${siteUrl}/business/landing</loc>
    <lastmod>${generatedAt}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>
`;

const robotsTxt = `User-agent: *
Allow: /
Disallow: /my-venue
Disallow: /people
Disallow: /rooms
Disallow: /bookings
Disallow: /venue/
Disallow: /room/
Disallow: /my-bookings
Disallow: /profile
Disallow: /invite/

Sitemap: ${siteUrl}/sitemap.xml
`;

mkdirSync(publicDir, { recursive: true });
writeFileSync(resolve(publicDir, 'sitemap.xml'), sitemapXml, 'utf8');
writeFileSync(resolve(publicDir, 'robots.txt'), robotsTxt, 'utf8');

if (!process.env.VITE_SITE_URL && !process.env.URL && !process.env.DEPLOY_PRIME_URL) {
  console.warn(
    '[seo] Site URL env is missing. Generated sitemap/robots with https://example.com. ' +
      'Set VITE_SITE_URL in production build for correct canonical host.',
  );
}
