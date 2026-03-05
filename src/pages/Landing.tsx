import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowRight, Building2, CalendarClock, CheckCircle2, Layers3, Search, ShieldCheck } from 'lucide-react';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useAuthStore } from '@/store/authStore';
import { useI18n } from '@/i18n/useI18n';
import { isBusinessPortalActive } from '@/lib/businessAccess';

gsap.registerPlugin(ScrollTrigger);

const categories = [
  {
    title: 'Коворкинги',
    description: 'Рабочие места, переговорные и гибкие офисы по слотам.',
  },
  {
    title: 'Бьюти и сервисы',
    description: 'Кабинеты, кресла и рабочие места по времени.',
  },
  {
    title: 'Студии и креатив',
    description: 'Фото, видео, подкаст и музыкальные комнаты.',
  },
  {
    title: 'Обучение',
    description: 'Классы, аудитории, залы для мастер-классов.',
  },
  {
    title: 'Здоровье и wellbeing',
    description: 'Кабинеты специалистов и оздоровительные сервисы.',
  },
  {
    title: 'Ивенты',
    description: 'Площадки и мини-залы для событий и встреч.',
  },
];

const businessBenefits = [
  'Профиль бизнеса с понятной карточкой',
  'Управление комнатами и доступными слотами',
  'Приглашения для команды и статусы доступа',
  'Прозрачная история бронирований и отмен',
];

const onboardingSteps = [
  'Определите формат бизнеса и какие слоты будете продавать',
  'Подготовьте карточку: название, адрес, описание и правила брони',
  'Назначьте роли в команде и включите управление доступом',
  'Проверьте категории и откройте бизнес для бронирования в каталоге',
];

export default function Landing() {
  const { t } = useI18n();
  const { isAuthenticated, portal, user } = useAuthStore();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const navRef = useRef<HTMLElement | null>(null);
  const isOwnerPortal = isBusinessPortalActive(user, portal);
  const businessCtaLink = isAuthenticated ? (isOwnerPortal ? '/my-venue' : '/business/register') : '/business/register';
  const businessCtaLabel = isOwnerPortal ? t('Перейти к управлению бизнесом') : t('Перейти к добавлению бизнеса');

  useEffect(() => {
    if (!rootRef.current) return;

    const applyNavTheme = (isDark: boolean) => {
      if (!navRef.current) return;
      navRef.current.classList.toggle('bg-[#F2F0E9]/88', !isDark);
      navRef.current.classList.toggle('text-black', !isDark);
      navRef.current.classList.toggle('border-[#2E4036]/15', !isDark);
      navRef.current.classList.toggle('backdrop-blur-xl', !isDark);
      navRef.current.classList.toggle('shadow-[0_10px_40px_rgba(26,26,26,0.12)]', !isDark);
      navRef.current.classList.toggle('bg-transparent', isDark);
      navRef.current.classList.toggle('text-white', isDark);
      navRef.current.classList.toggle('border-transparent', isDark);
    };

    const updateNavTheme = () => {
      if (!navRef.current) return;
      const navRect = navRef.current.getBoundingClientRect();
      const probeX = Math.min(window.innerWidth - 1, Math.max(0, navRect.left + navRect.width / 2));
      const probeY = Math.min(window.innerHeight - 1, Math.max(0, navRect.bottom + 8));
      const target = document.elementFromPoint(probeX, probeY) as HTMLElement | null;
      const themedParent = target?.closest('[data-nav-theme]') as HTMLElement | null;
      const theme = themedParent?.dataset.navTheme ?? 'dark';
      applyNavTheme(theme !== 'light');
    };

    const ctx = gsap.context(() => {
      gsap.from('[data-hero-reveal]', {
        y: 36,
        opacity: 0,
        duration: 0.8,
        ease: 'power3.out',
        stagger: 0.12,
      });

      gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((node) => {
        gsap.from(node, {
          y: 24,
          opacity: 0,
          duration: 0.7,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: node,
            start: 'top 82%',
            once: true,
          },
        });
      });

      ScrollTrigger.create({
        trigger: rootRef.current,
        start: 'top top',
        end: 'bottom top',
        onUpdate: updateNavTheme,
        onRefresh: updateNavTheme,
      });
    }, rootRef);

    updateNavTheme();
    window.addEventListener('resize', updateNavTheme);

    return () => {
      window.removeEventListener('resize', updateNavTheme);
      ctx.revert();
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className="relative overflow-x-hidden bg-[#F2F0E9] text-[#1A1A1A]"
      style={{
        fontFamily: '"Plus Jakarta Sans", "Inter", "Golos Text", system-ui, sans-serif',
      }}
    >
      <div
        className="pointer-events-none fixed inset-0 z-50 opacity-[0.05] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 240 240' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      <header className="fixed left-1/2 top-4 z-40 w-[calc(100%-2rem)] max-w-6xl -translate-x-1/2">
        <nav
          ref={navRef}
          className="flex items-center justify-between rounded-[2.2rem] border border-transparent bg-transparent px-5 py-3 text-sm text-white transition-all duration-500 sm:px-7"
        >
          <Link
            to="/"
            className="brand-wordmark text-xl transition-colors duration-500 sm:text-2xl"
          >
            TezBron
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <LanguageSwitcher variant="dark" className="hidden sm:flex" />
          </div>
        </nav>
      </header>

      <section data-nav-theme="dark" className="relative flex min-h-[100dvh] items-end overflow-hidden px-6 pb-16 pt-28 sm:px-10 lg:px-16">
        <img
          src="https://images.unsplash.com/photo-1470115636492-6d2b56f9146d?auto=format&fit=crop&w=2200&q=80"
          alt={t('Лесной фон')}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(46,64,54,0.86)_10%,rgba(26,26,26,0.9)_58%,rgba(26,26,26,0.96)_100%)]" />

        <div className="relative z-10 max-w-4xl text-[#F2F0E9]">
          <h1 data-hero-reveal className="text-4xl font-extrabold leading-[0.95] tracking-[-0.03em] sm:text-6xl lg:text-7xl" style={{ fontFamily: '"Outfit", "Plus Jakarta Sans", sans-serif' }}>
            {t('Откройте свой бизнес на платформе')} <span style={{ fontFamily: '"Cormorant Garamond", serif', fontStyle: 'italic', fontWeight: 600 }}>{t('и управляйте бронированием из одного кабинета.')}</span>
          </h1>
          <p data-hero-reveal className="mt-6 max-w-2xl text-base text-[#F2F0E9]/84 sm:text-lg">
            {t('Здесь собраны правила, сценарий запуска и шаги подключения бизнеса. Этот экран открывается из профиля по кнопке «Добавить бизнес».')}
          </p>
          <div data-hero-reveal className="mt-8 flex flex-wrap gap-3">
            <Link
              to={businessCtaLink}
              className="group rounded-full bg-[#CC5833] px-6 py-3 text-sm font-semibold text-[#F2F0E9] transition hover:bg-[#b64a2a]"
            >
              <span className="inline-flex items-center gap-2">
                {businessCtaLabel} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </span>
            </Link>
            <Link
              to="/"
              className="rounded-full border border-[#F2F0E9]/28 px-6 py-3 text-sm font-semibold text-[#F2F0E9] transition hover:bg-[#F2F0E9]/12"
            >
              {t('Вернуться в каталог')}
            </Link>
          </div>
        </div>
      </section>

      <section data-nav-theme="light" className="mx-auto max-w-6xl px-6 py-16 sm:px-10 lg:px-16">
        <div data-reveal className="mb-8 flex items-end justify-between gap-6">
          <div>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl" style={{ fontFamily: '"Outfit", "Plus Jakarta Sans", sans-serif' }}>
              {t('Какие бизнесы можно подключить')}
            </h2>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <article
              key={category.title}
              data-reveal
              className="rounded-[2rem] border border-[#2E4036]/12 bg-white/70 p-6 shadow-[0_12px_40px_rgba(26,26,26,0.06)]"
            >
              <p className="text-lg font-semibold tracking-tight" style={{ fontFamily: '"Outfit", "Plus Jakarta Sans", sans-serif' }}>
                {t(category.title)}
              </p>
              <p className="mt-2 text-sm leading-6 text-[#1A1A1A]/74">{t(category.description)}</p>
            </article>
          ))}
        </div>
      </section>

      <section data-nav-theme="dark" className="bg-[#1A1A1A] px-6 py-16 text-[#F2F0E9] sm:px-10 lg:px-16">
        <div className="mx-auto max-w-6xl">
          <div data-reveal className="mb-10 max-w-2xl">
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl" style={{ fontFamily: '"Outfit", "Plus Jakarta Sans", sans-serif' }}>
              {t('Что происходит после нажатия «Добавить бизнес»')}
            </h2>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <article data-reveal className="rounded-[2rem] border border-[#F2F0E9]/14 bg-[#222222] p-7">
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[#2E4036]/40">
                <Search className="h-5 w-5" />
              </div>
              <h3 className="text-2xl font-semibold tracking-tight">{t('Подготовка карточки')}</h3>
              <ul className="mt-4 space-y-3 text-sm text-[#F2F0E9]/80">
                {onboardingSteps.map((item) => (
                  <li key={item} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#CC5833]" />
                    <span>{t(item)}</span>
                  </li>
                ))}
              </ul>
              <Link to="/" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#CC5833]">
                {t('Посмотреть публичный каталог')} <ArrowRight className="h-4 w-4" />
              </Link>
            </article>

            <article data-reveal className="rounded-[2rem] border border-[#F2F0E9]/14 bg-[#222222] p-7">
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[#2E4036]/40">
                <Building2 className="h-5 w-5" />
              </div>
              <h3 className="text-2xl font-semibold tracking-tight">{t('Работа в кабинете')}</h3>
              <ul className="mt-4 space-y-3 text-sm text-[#F2F0E9]/80">
                {businessBenefits.map((item) => (
                  <li key={item} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#CC5833]" />
                    <span>{t(item)}</span>
                  </li>
                ))}
              </ul>
              <Link to={businessCtaLink} className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#CC5833]">
                {businessCtaLabel} <ArrowRight className="h-4 w-4" />
              </Link>
            </article>
          </div>
        </div>
      </section>

      <section data-nav-theme="light" className="mx-auto max-w-6xl px-6 py-16 sm:px-10 lg:px-16">
        <div className="grid gap-6 md:grid-cols-3">
          <article data-reveal className="rounded-[2rem] border border-[#2E4036]/12 bg-white/70 p-6">
            <CalendarClock className="h-5 w-5 text-[#CC5833]" />
            <h3 className="mt-3 text-lg font-semibold">{t('Прозрачные слоты')}</h3>
            <p className="mt-2 text-sm text-[#1A1A1A]/72">
              {t('Пользователь видит только свободное время и быстро подтверждает бронирование.')}
            </p>
          </article>
          <article data-reveal className="rounded-[2rem] border border-[#2E4036]/12 bg-white/70 p-6">
            <Layers3 className="h-5 w-5 text-[#CC5833]" />
            <h3 className="mt-3 text-lg font-semibold">{t('Управление без перегруза')}</h3>
            <p className="mt-2 text-sm text-[#1A1A1A]/72">
              {t('Бизнес управляет карточкой и настройками из профиля, а не с главной страницы.')}
            </p>
          </article>
          <article data-reveal className="rounded-[2rem] border border-[#2E4036]/12 bg-white/70 p-6">
            <ShieldCheck className="h-5 w-5 text-[#CC5833]" />
            <h3 className="mt-3 text-lg font-semibold">{t('Разделение ролей')}</h3>
            <p className="mt-2 text-sm text-[#1A1A1A]/72">
              {t('Пользовательский вход и бизнес-вход разделены, чтобы роли не смешивались.')}
            </p>
          </article>
        </div>
      </section>

      <section data-nav-theme="light" className="mx-auto max-w-6xl px-6 pb-20 sm:px-10 lg:px-16">
        <div
          data-nav-theme="dark"
          data-reveal
          className="rounded-[2.2rem] bg-[linear-gradient(120deg,#2E4036_0%,#1f2a24_65%,#1A1A1A_100%)] px-7 py-10 text-[#F2F0E9] sm:px-10 sm:py-12"
        >
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl" style={{ fontFamily: '"Outfit", "Plus Jakarta Sans", sans-serif' }}>
            {t('Готовы добавить бизнес в систему?')}
          </h2>
          <p className="mt-3 max-w-2xl text-sm text-[#F2F0E9]/84 sm:text-base">
            {t('Откройте бизнес-кабинет, заполните карточку и начните принимать бронирования.')}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to={businessCtaLink} className="rounded-full bg-[#CC5833] px-5 py-2.5 text-sm font-semibold text-[#F2F0E9] transition hover:bg-[#b64a2a]">
              {businessCtaLabel}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
