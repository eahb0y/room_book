import {
  ArrowRight,
  BellRing,
  Building2,
  CalendarClock,
  Check,
  type LucideIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import MarketingFinalCta from '@/components/marketing/MarketingFinalCta';
import MarketingShell from '@/components/marketing/MarketingShell';
import { useI18n } from '@/i18n/useI18n';
import { Button } from '@/components/ui/button';

interface FeatureChapter {
  step: string;
  label?: string;
  title: string;
  description: string;
  bullets: string[];
  icon: LucideIcon;
}

const featureChapters: FeatureChapter[] = [
  {
    step: '01',
    title: 'Путь до бронирования читается с первого экрана.',
    description:
      'Свободные окна, услуги и правила записи собраны в одном понятном сценарии без ручной координации.',
    bullets: [
      'Свободные слоты публикуются без ручного ответа в чатах.',
      'Клиент проходит путь от выбора до подтверждения за несколько касаний.',
    ],
    icon: CalendarClock,
  },
  {
    step: '02',
    title: 'Локации, комнаты и загрузка собраны в одной системе.',
    description:
      'Менеджер сразу видит загрузку, пересечения и узкие места без ручной сводки между площадками.',
    bullets: [
      'Локации и ресурсы работают по общей структуре без ручной сводки.',
      'История изменений остаётся прозрачной для управляющей команды.',
    ],
    icon: Building2,
  },
  {
    step: '03',
    title: 'Роли и изменения остаются управляемыми при росте команды.',
    description:
      'Владелец, менеджер и сотрудник работают в одном процессе, а критичные события быстро доходят до команды.',
    bullets: [
      'Права доступа распределяются по ролям без конфликтов и лишних касаний.',
      'Ключевые изменения быстро доходят до команды через уведомления.',
    ],
    icon: BellRing,
  },
];

export default function B2BFeatures() {
  const { t } = useI18n();
  const localizedFeatureChapters = featureChapters.map((chapter) => ({
    ...chapter,
    label: chapter.label ? t(chapter.label) : undefined,
    title: t(chapter.title),
    description: t(chapter.description),
    bullets: chapter.bullets.map((bullet) => t(bullet)),
  }));

  return (
    <MarketingShell>
      <section className="mx-auto max-w-7xl px-4 pb-14 pt-0 sm:px-6 lg:px-8 lg:pb-16 lg:pt-0">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-5xl">
            <h1 className="text-4xl font-semibold leading-[0.95] text-foreground sm:text-5xl lg:text-7xl">
              {t('Не список возможностей, а рабочий ритм команды.')}
            </h1>
          </div>

          <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:gap-14">
            <div className="max-w-3xl">
              <p className="max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg">
                {t(
                  'TezBron показывает не набор разрозненных функций, а то, как запись приходит в систему, как команда держит под контролем расписание и как владелец видит весь день без ручной координации.',
                )}
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="h-12 rounded-full px-7">
                  <Link to="/business/register">
                    {t('Попробовать бесплатно')}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="h-12 rounded-full border-border/70 px-7">
                  <Link to="/pricing">{t('Посмотреть тарифы')}</Link>
                </Button>
              </div>
            </div>

            <div className="space-y-5 lg:pt-3">
              {[
                ['24/7 запись', 'Клиент видит свободные окна тогда, когда готов забронировать.'],
                ['Единый поток', 'Записи, статусы и напоминания остаются внутри системы, а не в разных каналах.'],
                ['Меньше ручной координации', 'Команда работает по актуальному расписанию без лишних сверок и уточнений.'],
              ].map(([title, description], index) => (
                <div
                  key={title}
                  className="flex gap-4 border-b border-border/60 pb-5 last:border-b-0 last:pb-0"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/70 text-xs font-semibold text-primary">
                    0{index + 1}
                  </span>
                  <div>
                    <p className="text-base font-semibold text-foreground">{t(title)}</p>
                    <p className="mt-1.5 text-sm leading-7 text-muted-foreground">{t(description)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </section>

      <section className="border-y border-border/60 bg-background/72">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="grid gap-8 lg:grid-cols-[minmax(320px,0.78fr)_minmax(0,1.22fr)] lg:gap-12">
            <div className="lg:sticky lg:top-28 lg:h-fit">
              <div className="marketing-panel rounded-[2.2rem] border border-primary/15 p-6 sm:p-7">
                <p className="text-sm font-medium text-muted-foreground">{t('Как это работает в реальном дне')}</p>
                <h2 className="mt-4 text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
                  {t('Один сценарий вместо набора разрозненных экранов.')}
                </h2>
                <p className="mt-4 text-base leading-8 text-muted-foreground">
                  {t(
                    'Страница собрана как последовательное движение: сначала запись, потом управление загрузкой, затем командная координация и сигналы по изменениям.',
                  )}
                </p>

                <div className="mt-8 space-y-3">
                  {localizedFeatureChapters.map((chapter) => (
                    <div
                      key={chapter.step}
                      className="flex items-start gap-4 rounded-[1.35rem] border border-border/60 bg-background/78 px-4 py-4"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                        {chapter.step}
                      </span>
                      <div>
                        {chapter.label ? <p className="text-sm font-medium text-foreground">{chapter.label}</p> : null}
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">{chapter.title}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-8 rounded-[1.5rem] border border-border/60 bg-background/78 p-5">
                  <p className="text-sm font-semibold text-foreground">{t('Что меняется для команды')}</p>
                  <div className="mt-4 space-y-3">
                    {[
                      ['Меньше ручной координации', 'Записи и статусы больше не живут в отдельных каналах.'],
                      ['Быстрее видно загрузку', 'Менеджер понимает картину дня без дополнительных сверок.'],
                      ['Проще масштабировать процесс', 'Новые роли, площадки и сотрудники встраиваются в общую систему.'],
                    ].map(([title, description]) => (
                      <div key={title} className="border-t border-border/60 pt-3 first:border-t-0 first:pt-0">
                        <p className="text-sm font-medium text-foreground">{t(title)}</p>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">{t(description)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-8">
              {localizedFeatureChapters.map((chapter, index) => {
                const Icon = chapter.icon;

                return (
                  <article key={chapter.step} className="relative pl-8 sm:pl-10">
                    {index < featureChapters.length - 1 ? (
                      <div className="absolute left-[11px] top-10 bottom-[-2.4rem] w-px bg-border/70 sm:left-[13px]" />
                    ) : null}
                    <div className="absolute left-0 top-7 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground shadow-[0_12px_28px_-18px_hsl(var(--primary)/0.8)] sm:left-0.5">
                      {chapter.step}
                    </div>

                    <div className="marketing-panel card-hover rounded-[1.9rem] border border-border/70 p-5 sm:p-6 lg:p-6">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex items-start gap-4">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.95rem] bg-primary/10 text-primary">
                            <Icon className="h-4.5 w-4.5" />
                          </div>
                          <div>
                            {chapter.label ? (
                              <p className="text-xs uppercase tracking-[0.22em] text-primary">{chapter.label}</p>
                            ) : null}
                            <h3
                              className={`max-w-3xl text-xl font-semibold leading-tight text-foreground sm:text-[1.7rem] ${
                                chapter.label ? 'mt-2' : ''
                              }`}
                            >
                              {chapter.title}
                            </h3>
                          </div>
                        </div>
                        <span className="self-start rounded-full border border-border/70 bg-background/74 px-3 py-1 text-xs font-medium text-muted-foreground">
                          {t('Шаг {value}', { value: chapter.step })}
                        </span>
                      </div>

                      <p className="mt-4 max-w-3xl text-sm leading-7 text-muted-foreground">{chapter.description}</p>

                      <ul className="mt-5 space-y-2">
                        {chapter.bullets.map((bullet) => (
                          <li key={bullet} className="flex gap-3 border-t border-border/60 pt-2.5 first:border-t-0 first:pt-0">
                            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                              <Check className="h-3.5 w-3.5" />
                            </span>
                            <span className="text-sm leading-6 text-foreground/90">{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <MarketingFinalCta
        eyebrow=""
        title="Запустите систему и посмотрите, как она ложится на ваш рабочий день."
        description="Подключите первую площадку, настройте команду и проверьте, как TezBron собирает запись, загрузку и уведомления в один понятный процесс."
      />
    </MarketingShell>
  );
}
