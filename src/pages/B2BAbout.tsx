import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import {
  ArrowRight,
  BellRing,
  Building2,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  MessageSquareMore,
  RefreshCw,
  Sparkles,
  UsersRound,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import MarketingShell from '@/components/marketing/MarketingShell';
import { useI18n } from '@/i18n/useI18n';
import { Button } from '@/components/ui/button';

gsap.registerPlugin(ScrollTrigger);

const chapterPreview = [
  { time: '00:00', label: 'Ручная запись съедает внимание' },
  { time: '00:20', label: 'TezBron переводит хаос в систему' },
  { time: '00:45', label: 'Клиент записывается сам' },
  { time: '01:00', label: 'Напоминания уменьшают no-shows' },
  { time: '01:15', label: 'Команда и комнаты в одном окне' },
  { time: '01:30', label: 'Работать можно спокойнее и точнее' },
];

const floatingMessages = [
  'Есть окно на завтра?',
  'Сколько стоит услуга?',
  'Можно перенести на 18:30?',
  'Подтвердите запись, пожалуйста',
];

const setupSteps = [
  { title: 'Добавьте услуги', description: 'Названия, длительность и правила записи.' },
  { title: 'Настройте график', description: 'Рабочие часы, окна и доступность команды.' },
  { title: 'Синхронизируйте календарь', description: 'Чтобы свободные слоты были всегда актуальными.' },
];

const slots = ['09:30', '10:00', '11:30', '13:00', '15:30', '17:00'];

const calendars = [
  {
    title: 'Alex',
    meta: 'Студия A',
    slots: ['09:00', '11:30', '15:00'],
  },
  {
    title: 'Nargiza',
    meta: 'Комната 2',
    slots: ['10:00', '13:30', '18:00'],
  },
  {
    title: 'Murad',
    meta: 'Студия B',
    slots: ['09:45', '12:00', '16:30'],
  },
  {
    title: 'Команда',
    meta: 'Обзор',
    slots: ['8 слотов', '0 конфликтов', '3 напоминания'],
  },
];

const visualFrameClass =
  'about-cinematic-frame relative overflow-hidden rounded-[2rem] border border-primary/15 bg-white/92 p-4 shadow-[0_40px_120px_-64px_rgba(30,41,59,0.34)] backdrop-blur-xl sm:p-5 lg:p-6 dark:border-primary/20 dark:bg-slate-950/82';

const miniCardClass =
  'min-w-0 rounded-[1.4rem] border border-slate-200/80 bg-white/94 p-4 shadow-[0_20px_60px_-40px_rgba(59,130,246,0.28)] sm:p-5 dark:border-slate-800/80 dark:bg-slate-900/92';

const aboutSansStyle = { fontFamily: '"Inter", "Golos Text", system-ui, sans-serif' } as const;
const monoStyle = { fontFamily: '"JetBrains Mono", monospace' } as const;

const heroTitleClass =
  'mt-5 max-w-4xl text-[2.55rem] font-semibold leading-[0.92] text-slate-900 sm:text-[3rem] md:text-[3.35rem] lg:text-[5.1rem] dark:text-white';

const sceneTitleClass =
  'mt-4 max-w-xl text-[1.95rem] font-semibold leading-[0.96] text-slate-900 sm:text-[2.2rem] md:text-[2.5rem] lg:text-6xl dark:text-white';

const sceneBodyClass =
  'mt-6 max-w-xl text-[15px] leading-7 text-slate-600 sm:text-base sm:leading-8 md:text-[17px] dark:text-slate-300';

interface StorySceneProps {
  time: string;
  eyebrow: string;
  title: string;
  description: string;
  note: string;
  visual: ReactNode;
  reverse?: boolean;
}

function StoryScene({ time, eyebrow, title, description, note, visual, reverse = false }: StorySceneProps) {
  const { t } = useI18n();

  return (
    <section data-scene className="relative border-t border-border/60 lg:min-h-[120vh]">
      <div className="flex lg:sticky lg:top-20 lg:min-h-[calc(100vh-5rem)] lg:items-center">
        <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 md:py-16 lg:px-8 lg:py-14">
          <div className="grid gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
            <div className={reverse ? 'lg:order-2' : ''}>
              <div
                data-scene-copy
                className="inline-flex items-center gap-3 rounded-full border border-primary/20 bg-white/85 px-4 py-2 text-sm text-slate-600 shadow-[0_12px_30px_-20px_rgba(59,130,246,0.35)] dark:bg-slate-950/75 dark:text-slate-300"
                style={monoStyle}
              >
                <span className="font-semibold text-primary">{time}</span>
                <span>{eyebrow}</span>
              </div>
              <p
                data-scene-copy
                className="mt-6 text-sm font-semibold uppercase tracking-[0.26em] text-primary"
                style={aboutSansStyle}
              >
                {t('История по скроллу')}
              </p>
              <h2
                data-scene-copy
                className={sceneTitleClass}
                style={aboutSansStyle}
              >
                {title}
              </h2>
              <p
                data-scene-copy
                className={sceneBodyClass}
                style={aboutSansStyle}
              >
                {description}
              </p>
              <div
                data-scene-copy
                className="mt-8 max-w-lg rounded-[1.6rem] border border-slate-200/80 bg-white/90 p-5 shadow-[0_24px_60px_-44px_rgba(30,41,59,0.32)] sm:p-6 dark:border-slate-800/80 dark:bg-slate-950/82"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-primary about-signal-pulse" />
                  <p
                    className="text-sm leading-7 text-slate-600 dark:text-slate-300"
                    style={aboutSansStyle}
                  >
                    {note}
                  </p>
                </div>
              </div>
            </div>

            <div
              data-scene-visual
              className={`min-w-0 ${reverse ? 'lg:order-1' : ''}`}
            >
              {visual}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function StressVisual() {
  const { t } = useI18n();

  return (
    <div className={visualFrameClass}>
      <div className="absolute inset-x-0 top-0 h-36 bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.18),transparent_65%)]" />
      <div className="absolute -left-10 top-16 h-36 w-36 rounded-full bg-primary/10 blur-3xl" data-scrub-depth />
      <div className="absolute -right-8 bottom-10 h-28 w-28 rounded-full bg-sky-300/20 blur-3xl" data-scrub-depth />

      <div className="relative z-10">
        <div className="mb-4 grid gap-2 sm:grid-cols-2 xl:hidden">
          {floatingMessages.map((message) => (
            <div
              key={message}
              data-scene-item
              className="rounded-2xl border border-white/80 bg-white/90 px-3 py-2 text-xs leading-5 text-slate-600 shadow-[0_18px_46px_-34px_rgba(30,41,59,0.25)] dark:border-slate-700/80 dark:bg-slate-900/88 dark:text-slate-300"
            >
              {t(message)}
            </div>
          ))}
        </div>

        <div className="grid gap-6 md:grid-cols-[0.88fr_1.12fr] md:items-center">
          <div className="relative mx-auto w-full max-w-[16.5rem] sm:max-w-[18rem]" data-scene-item data-scrub-rotate>
            <div className="about-phone-shell rounded-[2.7rem] border border-slate-900 bg-slate-950 p-3 shadow-[0_34px_90px_-46px_rgba(15,23,42,0.65)]">
              <div className="rounded-[2.15rem] bg-white p-4 dark:bg-slate-900">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Alex</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{t('Владелец студии')}</p>
                  </div>
                  <div className="h-2.5 w-2.5 rounded-full bg-rose-500 about-signal-pulse" />
                </div>
                <div className="mt-5 rounded-[1.6rem] bg-slate-50 p-4 dark:bg-slate-800/70">
                  <p
                    className="text-3xl font-semibold text-slate-900 sm:text-4xl dark:text-white"
                    style={monoStyle}
                  >
                    23
                  </p>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">{t('непрочитанных запросов после смены')}</p>
                </div>
                <div className="mt-4 grid gap-3">
                  {[
                    ['WhatsApp', '9 сообщений'],
                    ['Telegram', '6 переносов'],
                    ['Звонки', '4 пропущенных'],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between rounded-2xl border border-slate-200/80 px-3 py-2 text-sm dark:border-slate-700/80">
                      <span className="text-slate-500 dark:text-slate-300">{t(label)}</span>
                      <span className="font-semibold text-slate-900 dark:text-white">{t(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {floatingMessages.map((message, index) => (
              <div
                key={message}
                data-scene-item
                data-scrub-depth
                className={`about-floating-note absolute hidden max-w-[10rem] rounded-2xl border border-white/80 bg-white/92 px-3 py-2 text-xs leading-5 text-slate-600 shadow-[0_20px_50px_-32px_rgba(30,41,59,0.28)] xl:block dark:border-slate-700/80 dark:bg-slate-900/88 dark:text-slate-300 ${
                  index === 0 ? '-left-10 top-8' : index === 1 ? 'right-[-1.25rem] top-16' : index === 2 ? '-left-8 bottom-14' : 'right-[-1.5rem] bottom-10'
                }`}
                style={{ animationDelay: `${index * 1.1}s` }}
              >
                {t(message)}
              </div>
            ))}
          </div>

          <div className="space-y-4">
            {[
              { time: '19:42', title: 'Перенос на завтра', body: 'Клиент просит изменить слот в последний момент.' },
              { time: '19:57', title: 'Уточнение по цене', body: 'Нужно ответить, подтвердить и не потерять контекст.' },
              { time: '20:13', title: 'Отмена и новый запрос', body: 'Пока один слот освобождается, другой уже просят занять.' },
            ].map((item) => (
              <article key={item.time} data-scene-item className={miniCardClass}>
                <div className="flex items-center justify-between gap-3">
                  <p
                    className="text-xs font-semibold uppercase tracking-[0.22em] text-primary"
                    style={monoStyle}
                  >
                    {item.time}
                  </p>
                  <BellRing className="h-4 w-4 text-slate-400" />
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">{t(item.title)}</p>
                <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-300">{t(item.body)}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SolutionVisual() {
  const { t } = useI18n();

  return (
    <div className={visualFrameClass}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,hsl(var(--primary)/0.16),transparent_48%)]" />
      <div className="relative z-10">
        <div className="flex flex-wrap items-center gap-4">
          <div data-scene-item className="rounded-full border border-rose-200/80 bg-rose-50/90 px-4 py-2 text-sm text-rose-600 dark:border-rose-900/70 dark:bg-rose-950/25 dark:text-rose-300">
            {t('Переносы')}
          </div>
          <div data-scene-item className="rounded-full border border-amber-200/80 bg-amber-50/90 px-4 py-2 text-sm text-amber-600 dark:border-amber-900/70 dark:bg-amber-950/25 dark:text-amber-300">
            {t('Отмены')}
          </div>
          <div data-progress-line className="h-px flex-1 rounded-full bg-gradient-to-r from-primary/20 via-primary to-primary/20" />
          <div data-scene-item className="rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
            {t('Единый поток')}
          </div>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-[0.86fr_1.14fr] md:items-center">
          <div data-scene-item className="space-y-4">
            <div className={`${miniCardClass} about-scan-line`}>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{t('До')}</p>
              <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-300">
                {t('Сообщения живут в разных каналах, статусы расходятся, а команда принимает решения вслепую.')}
              </p>
            </div>
            <div className={`${miniCardClass} about-scan-line`}>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{t('Переход')}</p>
              <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-300">
                {t('Один экран собирает услуги, график, доступные слоты и действия команды.')}
              </p>
            </div>
          </div>

          <div data-scene-item className="rounded-[1.8rem] border border-slate-200/80 bg-white/96 p-5 shadow-[0_30px_90px_-56px_rgba(59,130,246,0.42)] sm:p-6 dark:border-slate-800/80 dark:bg-slate-950/92">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-white shadow-[0_18px_42px_-24px_rgba(59,130,246,0.75)]">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-lg font-semibold text-slate-900 dark:text-white">TezBron</p>
                  <p className="text-sm text-slate-500 dark:text-slate-300">{t('Система бронирования для современных команд')}</p>
                </div>
              </div>
              <MessageSquareMore className="h-5 w-5 shrink-0 text-primary" />
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {[
                ['Услуги', '4 активных'],
                ['Календарь', 'Синхронизирован'],
                ['Клиенты', 'Запись 24/7'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-slate-200/80 bg-slate-50/90 p-4 dark:border-slate-800/80 dark:bg-slate-900/80">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{t(label)}</p>
                  <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">{t(value)}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-[1.5rem] border border-primary/15 bg-primary/[0.06] p-4">
              <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
                {t('Вместо бесконечной ручной координации у бизнеса появляется чистый и управляемый поток записи.')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SetupVisual() {
  const { t } = useI18n();

  return (
    <div className={visualFrameClass}>
      <div className="absolute right-0 top-0 h-36 w-36 rounded-full bg-primary/10 blur-3xl" data-scrub-depth />
      <div className="relative z-10 grid gap-5 md:grid-cols-[1fr_0.9fr]">
        <div className="space-y-4">
          {setupSteps.map((step, index) => (
            <article key={step.title} data-scene-item className={miniCardClass}>
              <div className="flex items-start gap-4">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-sm font-semibold text-primary"
                  style={monoStyle}
                >
                  0{index + 1}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{t(step.title)}</p>
                    <ChevronRight className="h-4 w-4 text-slate-300" />
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-300">{t(step.description)}</p>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="space-y-4">
          <div data-scene-item className={`${miniCardClass} about-scan-line`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{t('Синхронизация календаря')}</p>
                <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{t('Google Calendar')}</p>
              </div>
              <RefreshCw className="h-5 w-5 text-primary" />
            </div>
            <div className="mt-5 flex items-center gap-3">
              <div className="h-2 flex-1 rounded-full bg-slate-100 dark:bg-slate-800">
                <div className="h-full w-[78%] rounded-full bg-primary" data-progress-line />
              </div>
              <span
                className="text-xs font-semibold uppercase tracking-[0.18em] text-primary"
                style={monoStyle}
              >
                {t('синхронизировано')}
              </span>
            </div>
          </div>

          <div data-scene-item className="rounded-[1.7rem] border border-slate-200/80 bg-white/96 p-5 shadow-[0_24px_80px_-52px_rgba(30,41,59,0.26)] dark:border-slate-800/80 dark:bg-slate-950/90">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{t('Рабочее пространство')}</p>
                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{t('Настройка TezBron')}</p>
              </div>
              <CalendarClock className="h-5 w-5 text-primary" />
            </div>
            <div className="mt-5 grid gap-3">
              {[
                'Beauty Session • 60 мин',
                'Пн-Пт • 09:00 - 20:00',
                'Слоты опубликованы • Онлайн',
              ].map((item) => (
                <div key={item} className="rounded-2xl border border-slate-200/80 px-3 py-2 text-sm text-slate-600 dark:border-slate-800/80 dark:text-slate-300">
                  {t(item)}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BookingVisual() {
  const { t } = useI18n();

  return (
    <div className={visualFrameClass}>
      <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(59,130,246,0.09),transparent_44%)]" />
      <div className="relative z-10 rounded-[1.8rem] border border-slate-200/80 bg-white/96 p-5 shadow-[0_26px_90px_-58px_rgba(59,130,246,0.4)] dark:border-slate-800/80 dark:bg-slate-950/92">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{t('Брендированная страница бронирования')}</p>
            <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">tezbron.com / booking</p>
          </div>
          <div className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            {t('Самозапись 24/7')}
          </div>
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-[0.92fr_1.08fr]">
          <div data-scene-item className={`${miniCardClass} h-full`}>
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{t('Услуга')}</p>
            <h3 className="mt-3 text-xl font-semibold text-slate-900 dark:text-white">{t('Signature Session')}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-300">
              {t('Брендированная страница показывает услугу, длительность, формат и доступные окна без каталога и лишних шагов.')}
            </p>
            <div className="mt-5 space-y-2">
              {['60 мин', 'Без регистрации', 'Подтверждение за секунды'].map((item) => (
                <div key={item} className="rounded-2xl border border-slate-200/80 px-3 py-2 text-sm text-slate-600 dark:border-slate-800/80 dark:text-slate-300">
                  {t(item)}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div data-scene-item className={`${miniCardClass}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{t('Доступные слоты')}</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{t('Четверг, 14 марта')}</p>
                </div>
                <CalendarDays className="h-5 w-5 text-primary" />
              </div>
              <div className="mt-5 grid grid-cols-3 gap-3">
                {slots.map((slot, index) => (
                  <button
                    key={slot}
                    type="button"
                    className={`rounded-2xl border px-3 py-3 text-sm transition-transform ${
                      index === 4
                        ? 'border-primary bg-primary text-white shadow-[0_20px_42px_-28px_rgba(59,130,246,0.75)]'
                        : 'border-slate-200/80 bg-white text-slate-600 hover:-translate-y-0.5 dark:border-slate-800/80 dark:bg-slate-900 dark:text-slate-300'
                    }`}
                    style={monoStyle}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            </div>

            <div data-scene-item className="flex flex-col gap-4 rounded-[1.5rem] border border-slate-200/80 bg-slate-50/90 px-4 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800/80 dark:bg-slate-900/78">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{t('Signature Session • 15:30')}</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">{t('Клиент выбирает слот сам и сразу подтверждает запись.')}</p>
              </div>
              <Button className="h-11 w-full rounded-full px-5 sm:w-auto">{t('Забронировать')}</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReminderVisual() {
  const { t } = useI18n();

  return (
    <div className={visualFrameClass}>
      <div className="relative z-10 grid gap-6 md:grid-cols-[0.8fr_1.2fr] md:items-center">
        <div className="relative mx-auto w-full max-w-[16rem] sm:max-w-[17rem]" data-scene-item data-scrub-rotate>
          <div
            data-scene-item
            className="mb-4 rounded-2xl border border-primary/20 bg-white/94 px-4 py-3 text-sm text-slate-600 shadow-[0_22px_52px_-36px_rgba(59,130,246,0.35)] xl:hidden dark:bg-slate-900/90 dark:text-slate-300"
          >
            {t('Напоминание: до визита остался 1 час.')}
          </div>

          <div className="about-phone-shell rounded-[2.7rem] border border-slate-900 bg-slate-950 p-3 shadow-[0_34px_90px_-46px_rgba(15,23,42,0.65)]">
            <div className="rounded-[2.15rem] bg-white p-4 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">{t('Напоминание')}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{t('Визит через 1 час')}</p>
                </div>
                <BellRing className="h-5 w-5 text-primary" />
              </div>
              <div className="mt-6 rounded-[1.6rem] border border-primary/20 bg-primary/[0.08] p-4">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{t('Alex Studio')}</p>
                <p
                  className="mt-2 text-3xl font-semibold text-primary"
                  style={monoStyle}
                >
                  17:00
                </p>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">{t('Подтвердите визит одним касанием.')}</p>
              </div>
            </div>
          </div>

          <div
            data-scene-item
            data-scrub-depth
            className="about-floating-note absolute -right-10 top-10 hidden max-w-[12rem] rounded-2xl border border-primary/20 bg-white/94 px-4 py-3 text-sm text-slate-600 shadow-[0_22px_52px_-36px_rgba(59,130,246,0.35)] xl:block dark:bg-slate-900/90 dark:text-slate-300"
          >
            {t('Напоминание: до визита остался 1 час.')}
          </div>
        </div>

        <div className="space-y-4">
          <article data-scene-item className={miniCardClass}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{t('Контроль неявок')}</p>
                <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{t('Автоматический follow-up')}</p>
              </div>
              <Clock3 className="h-5 w-5 text-primary" />
            </div>
            <p className="mt-4 text-sm leading-7 text-slate-500 dark:text-slate-300">
              {t('Напоминания отправляются без участия администратора. Команда не тратит вечер на ручные подтверждения.')}
            </p>
          </article>

          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ['-32%', 'потенциальных no-shows'],
              ['1 tap', 'для подтверждения визита'],
            ].map(([value, label]) => (
              <div key={label} data-scene-item className={miniCardClass}>
                <p
                  className="text-3xl font-semibold text-slate-900 dark:text-white"
                  style={monoStyle}
                >
                  {value}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-300">{t(label)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TeamVisual() {
  const { t } = useI18n();

  return (
    <div className={visualFrameClass}>
      <div className="absolute -right-10 top-10 h-36 w-36 rounded-full bg-primary/10 blur-3xl" data-scrub-depth />
      <div className="relative z-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{t('Обзор команды')}</p>
            <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{t('Календари, комнаты и люди')}</p>
          </div>
          <div className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            {t('Живой статус команды')}
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-[1.18fr_0.82fr]">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {calendars.map((calendar, index) => (
              <article key={calendar.title} data-scene-item className={`${miniCardClass} ${index === 3 ? 'bg-primary/[0.06] dark:bg-primary/[0.12]' : ''}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{calendar.title}</p>
                    <p className="mt-1 text-xs text-slate-400">{t(calendar.meta)}</p>
                  </div>
                  <UsersRound className={`h-4 w-4 ${index === 3 ? 'text-primary' : 'text-slate-400'}`} />
                </div>
                <div className="mt-4 grid gap-2">
                  {calendar.slots.map((slot, slotIndex) => (
                    <div
                      key={slot}
                      className={`rounded-xl px-3 py-2 text-sm ${
                        index === 3 || slotIndex === 1
                          ? 'bg-primary text-white'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                      style={monoStyle}
                    >
                      {t(slot)}
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>

          <div className="space-y-4">
            <article data-scene-item className={miniCardClass}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{t('Командный центр')}</p>
                  <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{t('Видимость всей загрузки')}</p>
                </div>
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <p className="mt-4 text-sm leading-7 text-slate-500 dark:text-slate-300">
                {t('Руководитель видит специалистов, комнаты и загрузку в одном окне, а не собирает картину вручную.')}
              </p>
            </article>

            <article data-scene-item className={`${miniCardClass} border-primary/20 bg-primary/[0.05] dark:bg-primary/[0.1]`}>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{t('0 конфликтов слотов')}</p>
              <p className="mt-2 text-sm leading-7 text-slate-500 dark:text-slate-300">
                {t('Система помогает контролировать наложения ещё до того, как они становятся проблемой для команды.')}
              </p>
            </article>
          </div>
        </div>
      </div>
    </div>
  );
}

function FinaleVisual() {
  const { t } = useI18n();

  return (
    <div className={visualFrameClass}>
      <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.18),transparent_66%)]" />
      <div className="relative z-10 grid gap-5 md:grid-cols-[1fr_0.92fr]">
        <div className="space-y-4">
          {[
            ['Автоматическое бронирование', '24/7 клиенты видят актуальные окна'],
            ['Уведомления под контролем', 'Команда не живёт в мессенджерах'],
            ['Команда синхронизирована', 'Площадки и специалисты работают в едином контуре'],
          ].map(([title, description]) => (
            <article key={title} data-scene-item className={miniCardClass}>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{t(title)}</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">{t(description)}</p>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div data-scene-item className="rounded-[1.85rem] border border-slate-200/80 bg-white/96 p-6 shadow-[0_28px_90px_-54px_rgba(30,41,59,0.28)] dark:border-slate-800/80 dark:bg-slate-950/92">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{t('Спокойный режим')}</p>
              <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{t('Теперь день выглядит иначе')}</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-amber-200 via-amber-100 to-white shadow-[0_16px_40px_-24px_rgba(217,119,6,0.55)]">
              <span className="text-lg">☕</span>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {[
              ['08:55', 'График подтверждён'],
              ['11:20', 'Новый слот забронирован'],
              ['14:00', 'Напоминания отправлены'],
              ['18:30', 'Команда без ручной рутины'],
            ].map(([time, text]) => (
              <div key={time} className="rounded-2xl border border-slate-200/80 bg-slate-50/90 p-4 dark:border-slate-800/80 dark:bg-slate-900/80">
                <p
                  className="text-sm font-semibold text-primary"
                  style={monoStyle}
                >
                  {time}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{t(text)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function B2BAbout() {
  const { t } = useI18n();
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!rootRef.current) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const isDesktop = window.matchMedia('(min-width: 1024px)').matches;

    const ctx = gsap.context(() => {
      gsap.from('[data-about-hero]', {
        y: isDesktop ? 36 : 24,
        opacity: 0,
        duration: isDesktop ? 0.9 : 0.75,
        ease: 'power3.out',
        stagger: 0.12,
      });

      gsap.utils.toArray<HTMLElement>('[data-scene]').forEach((scene) => {
        const copyNodes = scene.querySelectorAll<HTMLElement>('[data-scene-copy]');
        const visualNodes = scene.querySelectorAll<HTMLElement>('[data-scene-item]');
        const depthNodes = scene.querySelectorAll<HTMLElement>('[data-scrub-depth]');
        const progressLines = scene.querySelectorAll<HTMLElement>('[data-progress-line]');
        const rotateNode = scene.querySelector<HTMLElement>('[data-scrub-rotate]');
        const visualPanel = scene.querySelector<HTMLElement>('[data-scene-visual]');

        gsap.from(copyNodes, {
          y: isDesktop ? 42 : 22,
          opacity: 0,
          duration: isDesktop ? 0.9 : 0.72,
          ease: 'power3.out',
          stagger: 0.12,
          scrollTrigger: {
            trigger: scene,
            start: isDesktop ? 'top 72%' : 'top 82%',
            once: true,
          },
        });

        gsap.from(visualNodes, {
          y: isDesktop ? 34 : 20,
          opacity: 0,
          scale: isDesktop ? 0.96 : 0.985,
          duration: isDesktop ? 0.85 : 0.72,
          ease: 'power2.out',
          stagger: 0.08,
          scrollTrigger: {
            trigger: scene,
            start: isDesktop ? 'top 74%' : 'top 84%',
            once: true,
          },
        });

        if (isDesktop) {
          depthNodes.forEach((node, index) => {
            gsap.fromTo(
              node,
              { yPercent: -4 - index * 1.5 },
              {
                yPercent: 5 + index * 1.5,
                ease: 'none',
                scrollTrigger: {
                  trigger: scene,
                  start: 'top bottom',
                  end: 'bottom top',
                  scrub: true,
                },
              },
            );
          });

          if (visualPanel) {
            gsap.fromTo(
              visualPanel,
              { yPercent: 4 },
              {
                yPercent: -2,
                ease: 'none',
                scrollTrigger: {
                  trigger: scene,
                  start: 'top bottom',
                  end: 'bottom top',
                  scrub: true,
                },
              },
            );
          }
        }

        progressLines.forEach((line) => {
          gsap.fromTo(
            line,
            { scaleX: 0.18, opacity: 0.45, transformOrigin: 'left center' },
            {
              scaleX: 1,
              opacity: 1,
              duration: isDesktop ? 1 : 0.72,
              ease: 'power2.out',
              scrollTrigger: {
                trigger: scene,
                start: isDesktop ? 'top 72%' : 'top 82%',
                once: true,
              },
            },
          );
        });

        if (isDesktop && rotateNode) {
          gsap.fromTo(
            rotateNode,
            { rotate: -4 },
            {
              rotate: 4,
              ease: 'none',
              scrollTrigger: {
                trigger: scene,
                start: 'top bottom',
                end: 'bottom top',
                scrub: true,
              },
            },
          );
        }
      });
    }, rootRef);

    return () => {
      ctx.revert();
    };
  }, []);

  return (
    <MarketingShell>
      <div
        ref={rootRef}
        className="about-cinematic-root"
        style={aboutSansStyle}
      >
        <section className="relative overflow-hidden border-b border-border/60">
          <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-7xl gap-12 px-4 py-16 sm:px-6 md:grid-cols-[0.92fr_1.08fr] md:items-center lg:px-8 lg:py-20">
            <div className="max-w-3xl">
              <p data-about-hero className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">
                {t('Промо-история на скролле')}
              </p>
              <h1
                data-about-hero
                className={heroTitleClass}
                style={aboutSansStyle}
              >
                {t('На этом экране проблема раскрывается не словами, а движением по скроллу.')}
              </h1>
              <p
                data-about-hero
                className="mt-6 max-w-2xl text-[15px] leading-7 text-slate-600 sm:text-base sm:leading-8 md:max-w-xl dark:text-slate-300"
              >
                {t(
                  'Мы адаптировали видео-сюжет под сайт: вместо ролика страница сама рассказывает историю. От перегруза ручной записью до спокойного рабочего дня, в котором TezBron берёт рутину на себя.',
                )}
              </p>

              <div data-about-hero className="mt-8 flex flex-col gap-3 sm:flex-row md:max-w-sm md:flex-col xl:max-w-none xl:flex-row">
                <Button asChild size="lg" className="h-12 rounded-full px-7">
                  <Link to="/business/register">
                    {t('Попробовать бесплатно')}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>

            <div data-about-hero className={`${visualFrameClass} overflow-hidden`}>
              <div className="relative z-10">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{t('Промо-путь TezBron')}</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{t('От хаоса к ясности')}</p>
                  </div>
                  <div
                    className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                    style={monoStyle}
                  >
                    {t('01:54 сториборд')}
                  </div>
                </div>

                <div className="mt-6 grid gap-3">
                  {chapterPreview.map((chapter, index) => (
                    <div
                      key={chapter.time}
                      className="grid grid-cols-[auto_1fr] items-center gap-4 rounded-[1.4rem] border border-slate-200/80 bg-white/92 px-4 py-3 shadow-[0_18px_46px_-34px_rgba(30,41,59,0.22)] dark:border-slate-800/80 dark:bg-slate-900/88"
                      data-scene-item
                      style={{ animationDelay: `${index * 120}ms` }}
                    >
                      <span
                        className="text-sm font-semibold text-primary"
                        style={monoStyle}
                      >
                        {chapter.time}
                      </span>
                      <span className="text-sm text-slate-600 dark:text-slate-300">{t(chapter.label)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <StoryScene
          time="00:00 → 00:20"
          eyebrow={t('Проблема')}
          title={t('Знакомьтесь, это Алекс. Он хорош в своём деле, но ручная запись выжигает внимание.')}
          description={t('Рабочий день формально закончен, но телефон не замолкает. Вопросы про цену, свободные окна, переносы и отмены продолжают сыпаться в WhatsApp и Telegram.')}
          note={t('Эта сцена заменяет видео-эпизод про выгорание: пользователь видит хаос буквально в интерфейсе, а не только читает о нём.')}
          visual={<StressVisual />}
        />

        <StoryScene
          time="00:20 → 00:30"
          eyebrow={t('Сдвиг')}
          title={t('TezBron появляется как чистый переход: из перегруза в управляемую систему.')}
          description={t('Мы не вставляем отдельный ролик. Вместо этого скролл сам создаёт эффект белого экрана, на котором бренд собирает разрозненные действия в единый продуктовый поток.')}
          note={t('По ощущению это работает как Apple-style reveal: минималистично, спокойно и с акцентом на структурный сдвиг.')}
          visual={<SolutionVisual />}
          reverse
        />

        <StoryScene
          time="00:30 → 00:45"
          eyebrow={t('Настройка')}
          title={t('Дальше страница показывает, что запуск не выглядит как тяжёлое внедрение.')}
          description={t('Бизнесу нужно быстро увидеть главную мысль: услуги, график и синхронизация календаря настраиваются за считанные минуты и сразу становятся рабочим контуром.')}
          note={t('Вместо сухого списка фич экран визуализирует настройку как короткую последовательность из трёх чистых шагов.')}
          visual={<SetupVisual />}
        />

        <StoryScene
          time="00:45 → 01:00"
          eyebrow={t('Самозапись')}
          title={t('Клиент больше не ждёт ответа в чате. Он выбирает слот сам, прямо на брендированной странице бронирования.')}
          description={t('Мы адаптировали сцену из видео под новый сайт: это уже не маркетплейс и не каталог, а собственная страница записи TezBron, где понятны услуга, окно и следующий шаг.')}
          note={t('Ключевая мысль здесь не в интерфейсе как таковом, а в смене модели: с ручной координации на самостоятельную запись 24/7.')}
          visual={<BookingVisual />}
          reverse
        />

        <StoryScene
          time="01:00 → 01:15"
          eyebrow={t('Напоминания')}
          title={t('После записи система продолжает работать: напоминания сокращают no-shows без ручного follow-up.')}
          description={t('Визуально это раскрывается как push-сцена на телефоне клиента. Бизнес сразу понимает, что часть хаоса уходит не только на входе, но и после бронирования.')}
          note={t('Смысл сцены: TezBron не просто принимает запись, а поддерживает её до самого визита.')}
          visual={<ReminderVisual />}
        />

        <StoryScene
          time="01:15 → 01:30"
          eyebrow={t('Команда')}
          title={t('Когда специалистов, комнат и площадок больше одной, нужен один экран на всю команду.')}
          description={t('Секция раскрывает мульти-календарный обзор: разные люди, разные ресурсы, одна система и одна понятная картина загрузки без ручного сведения.')}
          note={t('Это уже не история одного мастера. Это момент, где сайт доказывает, что продукт выдерживает реальную операционную сложность.')}
          visual={<TeamVisual />}
          reverse
        />

        <section data-scene className="relative border-t border-border/60 lg:min-h-[130vh]">
          <div className="flex lg:sticky lg:top-20 lg:min-h-[calc(100vh-5rem)] lg:items-center">
            <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 md:py-16 lg:px-8 lg:py-14">
              <div className="grid gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
                <div>
                  <div
                    data-scene-copy
                    className="inline-flex items-center gap-3 rounded-full border border-primary/20 bg-white/85 px-4 py-2 text-sm text-slate-600 shadow-[0_12px_30px_-20px_rgba(59,130,246,0.35)] dark:bg-slate-950/75 dark:text-slate-300"
                    style={monoStyle}
                  >
                    <span className="font-semibold text-primary">01:30 → 01:54</span>
                    <span>{t('Финал')}</span>
                  </div>
                  <h2
                    data-scene-copy
                    className="mt-6 max-w-xl text-[2rem] font-semibold leading-[0.96] text-slate-900 sm:text-[2.25rem] md:text-[2.6rem] lg:text-6xl dark:text-white"
                    style={aboutSansStyle}
                  >
                    {t('Теперь Алекс работает умнее, а не усерднее. Сайт заканчивается тем же состоянием, к которому ведёт продукт.')}
                  </h2>
                  <p
                    data-scene-copy
                    className="mt-6 max-w-xl text-[15px] leading-7 text-slate-600 sm:text-base sm:leading-8 md:text-[17px] dark:text-slate-300"
                  >
                    {t(
                      'Вместо перегруза появляется чистый, спокойный контур: самозапись, напоминания, командная видимость и понятный запуск продукта через один синий CTA.',
                    )}
                  </p>

                  <div data-scene-copy className="mt-8 flex flex-col gap-3 sm:flex-row">
                    <Button asChild size="lg" className="h-12 rounded-full px-7">
                      <Link to="/business/register">
                        {t('Попробовать бесплатно')}
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button asChild variant="outline" size="lg" className="h-12 rounded-full border-border/70 px-7">
                      <Link to="/">{t('Посмотреть платформу')}</Link>
                    </Button>
                  </div>

                  <div data-scene-copy className="mt-8 rounded-[1.6rem] border border-primary/15 bg-primary/[0.06] p-5">
                    <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
                      {t('Будь как Алекс: переведи хаос ручной записи в понятный бизнес-процесс уже сегодня.')}
                    </p>
                  </div>
                </div>

                <div data-scene-visual>
                  <FinaleVisual />
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </MarketingShell>
  );
}
