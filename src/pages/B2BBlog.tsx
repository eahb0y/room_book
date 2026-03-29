import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import MarketingFinalCta from '@/components/marketing/MarketingFinalCta';
import MarketingShell from '@/components/marketing/MarketingShell';
import { blogPosts } from '@/content/b2bMarketing';
import { useI18n } from '@/i18n/useI18n';
import { Button } from '@/components/ui/button';

export default function B2BBlog() {
  const { t } = useI18n();
  const localizedPosts = blogPosts.map((post) => ({
    ...post,
    category: t(post.category),
    title: t(post.title),
    excerpt: t(post.excerpt),
    readTime: t(post.readTime),
  }));
  const featuredPost = localizedPosts[0];
  const restPosts = localizedPosts.slice(1);

  return (
    <MarketingShell>
      <section className="mx-auto max-w-7xl px-4 pb-14 pt-14 sm:px-6 lg:px-8 lg:pb-18 lg:pt-20">
        <div className="max-w-4xl">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">{t('Блог')}</p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight text-foreground sm:text-5xl lg:text-6xl">
            {t('Контент теперь поддерживает B2B-историю: процессы, команды, рост и операционная дисциплина.')}
          </h1>
          <p className="mt-6 max-w-3xl text-base leading-8 text-muted-foreground sm:text-lg">
            {t('Вместо consumer-тем блог усиливает позиционирование продукта для владельцев, менеджеров и сервисных команд.')}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <article className="marketing-panel overflow-hidden rounded-[2rem] border border-primary/15 p-7 lg:p-10">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">{featuredPost.category}</p>
              <h2 className="mt-4 text-3xl font-semibold text-foreground sm:text-4xl">{featuredPost.title}</h2>
              <p className="mt-4 max-w-2xl text-base leading-8 text-muted-foreground">{featuredPost.excerpt}</p>
              <div className="mt-8 flex items-center gap-4">
                <Button asChild size="lg" className="h-12 rounded-full px-7">
                  <Link to="/business/register">
                    {t('Попробовать бесплатно')}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <span className="text-sm text-muted-foreground">{featuredPost.readTime}</span>
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-border/70 bg-background/82 p-6">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t('Редакционный фокус')}</p>
              <p className="mt-4 text-lg leading-8 text-foreground">
                {t(
                  'Контентный слой нужен не для трафика ради трафика, а чтобы подготовить B2B-аудиторию к демо, сравнению тарифов и запуску.',
                )}
              </p>
            </div>
          </div>
        </article>

        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {restPosts.map((post) => (
            <article key={post.title} className="marketing-panel rounded-[1.75rem] border border-border/70 p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">{post.category}</p>
              <h2 className="mt-4 text-xl font-semibold text-foreground">{post.title}</h2>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">{post.excerpt}</p>
              <div className="mt-6 flex items-center justify-between text-sm text-muted-foreground">
                <span>{post.readTime}</span>
                <Link to="/business/register" className="font-medium text-primary transition-colors hover:text-primary/80">
                  {t('Открыть через демо-сценарий')}
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <MarketingFinalCta
        eyebrow="CTA блога"
        title="Нужен B2B-контур, а не просто контент?"
        description="Публичный слой уже перестроен: блог усиливает продажу, а не отвлекает от запуска продукта и бизнес-кабинета."
      />
    </MarketingShell>
  );
}
