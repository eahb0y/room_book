const PERSONAL_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.uk',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'aol.com',
  'icloud.com',
  'me.com',
  'mail.com',
  'gmx.com',
  'yandex.ru',
  'yandex.com',
  'mail.ru',
  'bk.ru',
  'inbox.ru',
  'list.ru',
  'rambler.ru',
  'proton.me',
  'protonmail.com',
  'zoho.com',
]);

const EXPLICITLY_BLOCKED_BUSINESS_EMAILS = new Set([
  'iskandarmister323@gmail.com',
]);

const parseEmailDomain = (email: string) => {
  const normalized = email.trim().toLowerCase();
  const parts = normalized.split('@');
  if (parts.length !== 2) return '';
  return parts[1]?.trim() ?? '';
};

export const isBusinessEmail = (email: string) => {
  const normalized = email.trim().toLowerCase();
  if (EXPLICITLY_BLOCKED_BUSINESS_EMAILS.has(normalized)) return false;

  const domain = parseEmailDomain(email);
  if (!domain || !domain.includes('.')) return false;
  return !PERSONAL_EMAIL_DOMAINS.has(domain);
};
