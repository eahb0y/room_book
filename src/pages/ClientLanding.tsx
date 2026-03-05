import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Layers3,
  MapPinned,
  Search,
  ShieldCheck,
} from 'lucide-react';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useAuthStore } from '@/store/authStore';
import { useI18n } from '@/i18n/useI18n';
import { isBusinessPortalActive } from '@/lib/businessAccess';

gsap.registerPlugin(ScrollTrigger);

const categories = [
  {
    title: 'Переговорные и кабинеты',
    description: 'Для встреч, созвонов, интервью и небольших команд.',
  },
  {
    title: 'Коворкинги',
    description: 'Рабочие места и гибкие офисы на нужное время.',
  },
  {
    title: 'Бьюти и сервисы',
    description: 'Кресла, кабинеты и сервисные пространства по записи.',
  },
  {
    title: 'Студии и креатив',
    description: 'Фото, видео, подкасты и музыкальные сессии.',
  },
  {
    title: 'Обучение',
    description: 'Классы, аудитории и залы для групповых занятий.',
  },
  {
    title: 'Ивенты',
    description: 'Площадки для встреч, лекций и камерных событий.',
  },
];

const clientBenefits = [
  'Все предложения собраны в одном месте: от переговорных и коворкингов до студий, кабинетов и событийных площадок.',
  'В карточке сразу видно фото, адрес, вместимость, формат доступа и то, что предоставляет комната.',
  'Вы выбираете день, видите свободное время и подтверждаете бронь без ручных согласований.',
];

const searchFlow = [
  'Откройте каталог и выберите подходящее заведение',
  'Сравните комнаты по фото, вместимости, локации и наполнению',
  'Перейдите в карточку комнаты и проверьте правила доступа',
];

const bookingFlow = [
  'Выберите день и свободный слот в расписании',
  'Укажите начало и окончание брони в доступном диапазоне',
  'Получите подтверждение и управляйте своими бронями из аккаунта',
];

export default function ClientLanding() {
  const { t } = useI18n();
  const { isAuthenticated, portal, user } = useAuthStore();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const navRef = useRef<HTMLElement | null>(null);
  const isBusinessPortal = isBusinessPortalActive(user, portal);

  const secondaryCtaLink = !isAuthenticated ? '/register' : isBusinessPortal ? '/my-venue' : '/my-bookings';
  const secondaryCtaLabel = !isAuthenticated
    ? t('Создать аккаунт')
    : isBusinessPortal
      ? t('Перейти к управлению бизнесом')
      : t('Открыть мои бронирования');

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
          src="https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=2200&q=80"
          alt={t('Фон клиентского лендинга')}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(46,64,54,0.84)_8%,rgba(26,26,26,0.88)_56%,rgba(26,26,26,0.96)_100%)]" />

        <div className="relative z-10 max-w-4xl text-[#F2F0E9]">
          <h1
            data-hero-reveal
            className="text-4xl font-extrabold leading-[0.95] tracking-[-0.03em] sm:text-6xl lg:text-7xl"
            style={{ fontFamily: '"Outfit", "Plus Jakarta Sans", sans-serif' }}
          >
            {t('Бронируйте пространства без звонков и долгих переписок.')} {' '}
            <span style={{ fontFamily: '"Cormorant Garamond", serif', fontStyle: 'italic', fontWeight: 600 }}>
              {t('Понимайте формат, условия и свободные слоты с первого экрана.')}
            </span>
          </h1>
          <p data-hero-reveal className="mt-6 max-w-2xl text-base text-[#F2F0E9]/84 sm:text-lg">
            {t('TezBron собирает переговорные, студии, кабинеты и другие пространства в одном каталоге, чтобы вы могли быстро сравнить варианты и выбрать подходящий слот.')}
          </p>
          <div data-hero-reveal className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/"
              className="group rounded-full bg-[#CC5833] px-6 py-3 text-sm font-semibold text-[#F2F0E9] transition hover:bg-[#b64a2a]"
            >
              <span className="inline-flex items-center gap-2">
                {t('Перейти в каталог')} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </span>
            </Link>
            <Link
              to={secondaryCtaLink}
              className="rounded-full border border-[#F2F0E9]/28 px-6 py-3 text-sm font-semibold text-[#F2F0E9] transition hover:bg-[#F2F0E9]/12"
            >
              {secondaryCtaLabel}
            </Link>
          </div>
        </div>
      </section>

      <section data-nav-theme="light" className="mx-auto max-w-6xl px-6 py-16 sm:px-10 lg:px-16">
        <div data-reveal className="mb-8 max-w-3xl">
          <h2
            className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl"
            style={{ fontFamily: '"Outfit", "Plus Jakarta Sans", sans-serif' }}
          >
            {t('Кто мы и зачем нужен TezBron')}
          </h2>
          <p className="mt-4 text-sm leading-7 text-[#1A1A1A]/72 sm:text-base">
            {t('Мы сделали сервис для людей, которым нужно быстро понять, что доступно, сколько это вмещает и как забронировать без лишней координации.')}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <article data-reveal className="rounded-[2rem] border border-[#2E4036]/12 bg-white/70 p-6 shadow-[0_12px_40px_rgba(26,26,26,0.06)]">
            <Search className="h-5 w-5 text-[#CC5833]" />
            <h3 className="mt-3 text-lg font-semibold">{t('Один каталог')}</h3>
            <p className="mt-2 text-sm leading-6 text-[#1A1A1A]/74">{t(clientBenefits[0])}</p>
          </article>
          <article data-reveal className="rounded-[2rem] border border-[#2E4036]/12 bg-white/70 p-6 shadow-[0_12px_40px_rgba(26,26,26,0.06)]">
            <MapPinned className="h-5 w-5 text-[#CC5833]" />
            <h3 className="mt-3 text-lg font-semibold">{t('Понятные карточки')}</h3>
            <p className="mt-2 text-sm leading-6 text-[#1A1A1A]/74">{t(clientBenefits[1])}</p>
          </article>
          <article data-reveal className="rounded-[2rem] border border-[#2E4036]/12 bg-white/70 p-6 shadow-[0_12px_40px_rgba(26,26,26,0.06)]">
            <CalendarClock className="h-5 w-5 text-[#CC5833]" />
            <h3 className="mt-3 text-lg font-semibold">{t('Бронирование по слотам')}</h3>
            <p className="mt-2 text-sm leading-6 text-[#1A1A1A]/74">{t(clientBenefits[2])}</p>
          </article>
        </div>
      </section>

      <section data-nav-theme="light" className="mx-auto max-w-6xl px-6 py-16 sm:px-10 lg:px-16">
        <div data-reveal className="mb-8 flex items-end justify-between gap-6">
          <div>
            <h2
              className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl"
              style={{ fontFamily: '"Outfit", "Plus Jakarta Sans", sans-serif' }}
            >
              {t('Какие пространства можно бронировать')}
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
              <p
                className="text-lg font-semibold tracking-tight"
                style={{ fontFamily: '"Outfit", "Plus Jakarta Sans", sans-serif' }}
              >
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
            <h2
              className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl"
              style={{ fontFamily: '"Outfit", "Plus Jakarta Sans", sans-serif' }}
            >
              {t('Как это работает для клиента')}
            </h2>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <article data-reveal className="rounded-[2rem] border border-[#F2F0E9]/14 bg-[#222222] p-7">
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[#2E4036]/40">
                <Search className="h-5 w-5" />
              </div>
              <h3 className="text-2xl font-semibold tracking-tight">{t('Поиск и сравнение')}</h3>
              <ul className="mt-4 space-y-3 text-sm text-[#F2F0E9]/80">
                {searchFlow.map((item) => (
                  <li key={item} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#CC5833]" />
                    <span>{t(item)}</span>
                  </li>
                ))}
              </ul>
              <Link to="/" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#CC5833]">
                {t('Открыть каталог')} <ArrowRight className="h-4 w-4" />
              </Link>
            </article>

            <article data-reveal className="rounded-[2rem] border border-[#F2F0E9]/14 bg-[#222222] p-7">
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[#2E4036]/40">
                <Layers3 className="h-5 w-5" />
              </div>
              <h3 className="text-2xl font-semibold tracking-tight">{t('Как выглядит бронирование')}</h3>
              <ul className="mt-4 space-y-3 text-sm text-[#F2F0E9]/80">
                {bookingFlow.map((item) => (
                  <li key={item} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#CC5833]" />
                    <span>{t(item)}</span>
                  </li>
                ))}
              </ul>
              <Link to={secondaryCtaLink} className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#CC5833]">
                {secondaryCtaLabel} <ArrowRight className="h-4 w-4" />
              </Link>
            </article>
          </div>
        </div>
      </section>

      <section data-nav-theme="light" className="mx-auto max-w-6xl px-6 py-16 sm:px-10 lg:px-16">
        <div data-reveal className="mb-8 max-w-3xl">
          <h2
            className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl"
            style={{ fontFamily: '"Outfit", "Plus Jakarta Sans", sans-serif' }}
          >
            {t('Что вы увидите внутри платформы')}
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <article data-reveal className="rounded-[2rem] border border-[#2E4036]/12 bg-white/70 p-6">
            <Search className="h-5 w-5 text-[#CC5833]" />
            <h3 className="mt-3 text-lg font-semibold">{t('До выбора')}</h3>
            <p className="mt-2 text-sm text-[#1A1A1A]/72">
              {t('Категории, поиск, адреса и короткие описания помогают быстро отсечь неподходящие варианты.')}
            </p>
          </article>
          <article data-reveal className="rounded-[2rem] border border-[#2E4036]/12 bg-white/70 p-6">
            <CalendarClock className="h-5 w-5 text-[#CC5833]" />
            <h3 className="mt-3 text-lg font-semibold">{t('В момент бронирования')}</h3>
            <p className="mt-2 text-sm text-[#1A1A1A]/72">
              {t('Календарь показывает только доступные интервалы, а ограничения комнаты видны до подтверждения.')}
            </p>
          </article>
          <article data-reveal className="rounded-[2rem] border border-[#2E4036]/12 bg-white/70 p-6">
            <ShieldCheck className="h-5 w-5 text-[#CC5833]" />
            <h3 className="mt-3 text-lg font-semibold">{t('После подтверждения')}</h3>
            <p className="mt-2 text-sm text-[#1A1A1A]/72">
              {t('Активные и завершённые брони сохраняются в одном месте, чтобы вы могли легко вернуться к ним позже.')}
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
          <h2
            className="text-3xl font-bold tracking-tight sm:text-4xl"
            style={{ fontFamily: '"Outfit", "Plus Jakarta Sans", sans-serif' }}
          >
            {t('Готовы посмотреть, что доступно прямо сейчас?')}
          </h2>
          <p className="mt-3 max-w-2xl text-sm text-[#F2F0E9]/84 sm:text-base">
            {t('Откройте каталог, выберите пространство и пройдите путь от поиска до подтверждения за несколько минут.')}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/" className="rounded-full bg-[#CC5833] px-5 py-2.5 text-sm font-semibold text-[#F2F0E9] transition hover:bg-[#b64a2a]">
              {t('Открыть каталог')}
            </Link>
            <Link to={secondaryCtaLink} className="rounded-full border border-[#F2F0E9]/24 px-5 py-2.5 text-sm font-semibold text-[#F2F0E9] transition hover:bg-[#F2F0E9]/10">
              {secondaryCtaLabel}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
