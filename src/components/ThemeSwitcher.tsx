import { MoonStar, SunMedium } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n/useI18n';

interface ThemeSwitcherProps {
  className?: string;
}

const themeItems = [
  { value: 'light' as const, label: 'Светлая тема', icon: SunMedium },
  { value: 'dark' as const, label: 'Тёмная тема', icon: MoonStar },
];

export default function ThemeSwitcher({ className }: ThemeSwitcherProps) {
  const { t } = useI18n();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const activeTheme = theme === 'system' ? resolvedTheme ?? 'light' : theme ?? 'light';

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-lg border border-border/50 bg-background/30 p-1 backdrop-blur',
        className,
      )}
      role="group"
      aria-label={t('Тема интерфейса')}
    >
      {themeItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTheme === item.value;

        return (
          <button
            key={item.value}
            type="button"
            onClick={() => setTheme(item.value)}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-md transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
            aria-pressed={isActive}
            title={t(item.label)}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}
