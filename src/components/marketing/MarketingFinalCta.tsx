import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useI18n } from '@/i18n/useI18n';
import { Button } from '@/components/ui/button';

interface MarketingFinalCtaProps {
  eyebrow: string;
  title: string;
  description: string;
}

export default function MarketingFinalCta({
  eyebrow,
  title,
  description,
}: MarketingFinalCtaProps) {
  const { t } = useI18n();

  return (
    <section className="mx-auto max-w-7xl px-4 pb-20 pt-6 sm:px-6 lg:px-8">
      <div className="marketing-panel relative overflow-hidden rounded-[2rem] border border-primary/15 px-6 py-10 sm:px-10 lg:px-14 lg:py-14">
      <div className="absolute inset-y-0 right-0 hidden w-1/2 bg-[radial-gradient(circle_at_center,hsl(var(--primary)/0.14),transparent_58%)] lg:block" />
      <div className="relative z-10 max-w-3xl">
          {eyebrow ? <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">{t(eyebrow)}</p> : null}
          <h2 className={`${eyebrow ? 'mt-4' : ''} text-3xl font-semibold text-foreground sm:text-4xl`}>{t(title)}</h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">{t(description)}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-12 rounded-full px-7">
              <Link to="/business/register">
                {t('Попробовать бесплатно')}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-12 rounded-full border-border/70 px-7">
              <Link to="/business/login">{t('Войти')}</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
