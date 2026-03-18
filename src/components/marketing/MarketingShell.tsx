import { ArrowRight, Menu } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import { marketingNavItems } from '@/content/b2bMarketing';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useI18n } from '@/i18n/useI18n';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

interface MarketingShellProps {
  children: React.ReactNode;
}

const mainNavLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'rounded-full px-4 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-primary/10 text-primary'
      : 'text-muted-foreground hover:bg-accent/70 hover:text-foreground',
  );

export default function MarketingShell({ children }: MarketingShellProps) {
  const { t } = useI18n();
  const localizedNavItems = marketingNavItems.map((item) => ({
    ...item,
    label: t(item.label),
  }));

  return (
    <div className="marketing-stage min-h-screen text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/82 backdrop-blur-2xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-white/85 shadow-[0_20px_40px_-26px_hsl(var(--primary)/0.5)] dark:bg-card/90">
              <img src="/favicon.svg" alt={t('Логотип TezBron')} className="h-7 w-7" />
            </span>
            <span className="brand-wordmark block truncate text-xl text-foreground">TezBron</span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {localizedNavItems.map((item) => (
              <NavLink key={item.to} to={item.to} className={mainNavLinkClass}>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            <LanguageSwitcher />
            <Button asChild variant="ghost" className="rounded-full px-5 text-sm">
              <Link to="/business/login">{t('Войти')}</Link>
            </Button>
            <Button asChild className="h-11 rounded-full px-6">
              <Link to="/business/register">
                {t('Попробовать бесплатно')}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="h-11 w-11 rounded-full lg:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">{t('Открыть навигацию')}</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[88vw] border-l border-border/70 bg-background/98 p-0 sm:max-w-sm">
              <SheetHeader className="border-b border-border/60 pb-5">
                <SheetTitle className="flex items-center gap-3 text-left">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-primary/20 bg-white/85 dark:bg-card/90">
                    <img src="/favicon.svg" alt={t('Логотип TezBron')} className="h-6 w-6" />
                  </span>
                  <span className="brand-wordmark block text-lg">TezBron</span>
                </SheetTitle>
                <SheetDescription>
                  {t('Публичная навигация B2B-сайта и быстрый вход в бизнес-кабинет.')}
                </SheetDescription>
              </SheetHeader>

              <div className="flex flex-1 flex-col px-4 py-6">
                <div className="mb-6">
                  <LanguageSwitcher className="w-fit" />
                </div>
                <nav className="space-y-2">
                  {localizedNavItems.map((item) => (
                    <SheetClose key={item.to} asChild>
                      <NavLink
                        to={item.to}
                        className={({ isActive }) =>
                          cn(
                            'flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-medium transition-colors',
                            isActive
                              ? 'bg-primary/10 text-primary'
                              : 'bg-card/50 text-foreground hover:bg-accent/70',
                          )
                        }
                      >
                        <span>{item.label}</span>
                        <ArrowRight className="h-4 w-4" />
                      </NavLink>
                    </SheetClose>
                  ))}
                </nav>

                <div className="mt-8 space-y-3">
                  <SheetClose asChild>
                    <Button asChild variant="outline" className="h-11 w-full rounded-full">
                      <Link to="/business/login">{t('Войти')}</Link>
                    </Button>
                  </SheetClose>
                  <SheetClose asChild>
                    <Button asChild className="h-11 w-full rounded-full">
                      <Link to="/business/register">
                        {t('Попробовать бесплатно')}
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </SheetClose>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <main>{children}</main>
    </div>
  );
}
