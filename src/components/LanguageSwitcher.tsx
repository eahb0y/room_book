import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n/useI18n';
import type { AppLocale } from '@/store/localeStore';

interface LanguageSwitcherProps {
  className?: string;
  variant?: 'default' | 'dark';
}

const languageItems: Array<{ locale: AppLocale; label: string }> = [
  { locale: 'ru', label: 'RU' },
  { locale: 'uz', label: 'UZ' },
];

export default function LanguageSwitcher({ className, variant = 'default' }: LanguageSwitcherProps) {
  const { locale, setLocale, t } = useI18n();
  const isDark = variant === 'dark';

  return (
    <div
      className={cn(
        isDark
          ? 'inline-flex items-center rounded-full border border-white/16 bg-black/18 p-1 backdrop-blur-xl'
          : 'inline-flex items-center rounded-lg border border-border/50 bg-background/30 p-1',
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
            isDark
              ? 'rounded-full px-3 py-1.5 text-xs font-semibold tracking-wide transition-colors'
              : 'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
            locale === item.locale
              ? isDark
                ? 'bg-white text-[#111827]'
                : 'bg-primary text-primary-foreground'
              : isDark
                ? 'text-white/78 hover:text-white'
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
