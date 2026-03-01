const CYRILLIC_TO_LATIN_MAP: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
  қ: 'q',
  ғ: 'g',
  ҳ: 'h',
  ў: 'u',
};

const transliterate = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .split('')
    .map((char) => CYRILLIC_TO_LATIN_MAP[char] ?? char)
    .join('');

const slugify = (value: string) =>
  transliterate(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

export const buildBusinessStaffLoginEmail = (params: {
  firstName: string;
  lastName: string;
  venueId: string;
  venueName: string;
  existingEmails?: string[];
}) => {
  const firstNameSlug = slugify(params.firstName);
  const lastNameSlug = slugify(params.lastName);
  const localBase = [firstNameSlug, lastNameSlug].filter(Boolean).join('.') || 'employee';
  const venueBase = slugify(params.venueName) || `venue-${params.venueId.slice(0, 6)}`;
  const domain = `${venueBase}.business.local`;
  const usedEmails = new Set((params.existingEmails ?? []).map((email) => email.trim().toLowerCase()));

  let suffix = 0;
  while (true) {
    const candidateLocal = suffix === 0 ? localBase : `${localBase}.${suffix + 1}`;
    const candidate = `${candidateLocal}@${domain}`.toLowerCase();
    if (!usedEmails.has(candidate)) {
      return candidate;
    }
    suffix += 1;
  }
};
