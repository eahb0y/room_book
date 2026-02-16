import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n/useI18n';
import type { AppLocale } from '@/store/localeStore';

interface LanguageSwitcherProps {
  className?: string;
}

const languageItems: Array<{ locale: AppLocale; label: string }> = [
  { locale: 'ru', label: 'RU' },
  { locale: 'uz', label: 'UZ' },
];

export default function LanguageSwitcher({ className }: LanguageSwitcherProps) {
  const { locale, setLocale, t } = useI18n();

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-lg border border-border/50 bg-background/30 p-1',
        className,
      )}
      role="group"
      aria-label={t('Язык интерфейса')}
    >
      {languageItems.map((item) => (
        <button
          key={item.locale}
          type="button"
          onClick={() => setLocale(item.locale)}
          className={cn(
            'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
            locale === item.locale
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
          aria-pressed={locale === item.locale}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
