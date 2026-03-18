import {
  ArrowRight,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  CalendarRange,
  Car,
  DoorOpen,
  GraduationCap,
  HeartPulse,
  MapPinned,
  NotebookPen,
  PawPrint,
  Scissors,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import MarketingShell from '@/components/marketing/MarketingShell';
import { useI18n } from '@/i18n/useI18n';
import {
  faqItems,
  heroStats,
  homeFeatureCards,
  pricingPlans,
} from '@/content/b2bMarketing';
import { formatSumPrice } from '@/lib/pricingCatalog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const featureIcons = [Sparkles, Building2, ShieldCheck] as const;

interface IndustryScenario {
  label: string;
  description: string;
  icon: LucideIcon;
}

interface IndustryShowcase {
  id: string;
  label: string;
  eyebrow: string;
  title: string;
  description: string[];
  ctaLabel: string;
  ctaHref: string;
  visualTitle: string;
  visualSubtitle: string;
  visualIcon: LucideIcon;
  visualCards: Array<{
    title: string;
    meta: string;
    status: string;
  }>;
  scenarios: IndustryScenario[];
}

const industryShowcases: IndustryShowcase[] = [
  {
    id: 'beauty',
    label: 'Салоны и студии',
    eyebrow: 'Красота и персональный уход',
    title: 'Салоны и студии',
    description: [
      'Когда записи живут в звонках, директе и мессенджерах, администратор тратит день не на загрузку бизнеса, а на ручную координацию.',
      'TezBron открывает клиентам понятную запись 24/7, автоматически напоминает о визите и помогает держать календарь мастеров в одном контуре.',
      'Владельцы и менеджеры видят смены, услуги и загрузку по специалистам без таблиц и бесконечных уточнений.',
    ],
    ctaLabel: 'Посмотреть сценарий для салонов и студий',
    ctaHref: '/features',
    visualTitle: 'Плотное расписание без ручных переписок',
    visualSubtitle: 'Самозапись, напоминания и единый календарь для администраторов и мастеров.',
    visualIcon: Scissors,
    visualCards: [
      {
        title: 'Стрижка + окрашивание',
        meta: 'Клиент выбирает услугу и свободное окно сам',
        status: '24/7',
      },
      {
        title: 'Напоминание за 24 часа и за 1 час',
        meta: 'Снижаем no-shows без ручных сообщений',
        status: 'Синхронно',
      },
      {
        title: 'Загрузка мастеров по сменам',
        meta: 'Администратор видит подтверждения и переносы в одном месте',
        status: 'Онлайн',
      },
    ],
    scenarios: [
      { label: 'Барбершопы', description: 'График мастеров и повторные визиты без хаоса.', icon: Scissors },
      { label: 'Hair-студии', description: 'Окна, длительность услуг и напоминания клиентам.', icon: Sparkles },
      { label: 'Бьюти-салоны', description: 'Командный календарь для администраторов и специалистов.', icon: Users },
      { label: 'Ногтевой сервис', description: 'Запись по мастерам, сменам и типам услуг.', icon: CalendarRange },
      { label: 'Ресницы и брови', description: 'Быстрое подтверждение и понятная загрузка дня.', icon: NotebookPen },
      { label: 'SPA и уход', description: 'Пакеты услуг, кабинеты и ресурсы в одном контуре.', icon: ShieldCheck },
    ],
  },
  {
    id: 'coworking',
    label: 'Коворкинги',
    eyebrow: 'Коворкинг и гибкие пространства',
    title: 'Коворкинги',
    description: [
      'Переговорные, рабочие места, дневные пропуска и команды быстро превращаются в хаос, если доступность ведётся вручную.',
      'TezBron собирает ресурсы, правила бронирования и тарифные сценарии в единую систему, чтобы гости сами находили свободный формат.',
      'Менеджеры контролируют занятость по площадкам, а руководитель видит общую загрузку без сверки между администраторами.',
    ],
    ctaLabel: 'Посмотреть сценарий для коворкингов',
    ctaHref: '/features',
    visualTitle: 'Ресурсы, переговорные и доступность в одной логике',
    visualSubtitle: 'Бронируйте места, комнаты и посещения без ручного распределения.',
    visualIcon: Building2,
    visualCards: [
      {
        title: 'Переговорная Room A',
        meta: 'Свободные слоты обновляются для команды и гостей сразу',
        status: 'Открыто',
      },
      {
        title: 'Дневной доступ и фикс-места',
        meta: 'Разные форматы бронирования без ручной путаницы',
        status: 'Поток',
      },
      {
        title: 'Загрузка по филиалам',
        meta: 'Управляющая команда видит занятость площадок в одном обзоре',
        status: 'Центр',
      },
    ],
    scenarios: [
      { label: 'Переговорные', description: 'Почасовые слоты и правила доступа без таблиц.', icon: DoorOpen },
      { label: 'Дневные пропуска', description: 'Самозапись на посещение и подтверждения клиентам.', icon: CalendarRange },
      { label: 'Фикс-места', description: 'Управление рабочими местами и загруженностью локации.', icon: BriefcaseBusiness },
      { label: 'Командные зоны', description: 'Общий календарь для менеджеров и операционной команды.', icon: Users },
      { label: 'Ивент-пространства', description: 'Отдельные сценарии для мероприятий и аренды залов.', icon: MapPinned },
      { label: 'Мульти-площадки', description: 'Единый стандарт записи для всей сети пространств.', icon: Building2 },
    ],
  },
  {
    id: 'wellness',
    label: 'Клиники и оздоровление',
    eyebrow: 'Здоровье и оздоровление',
    title: 'Клиники и оздоровление',
    description: [
      'Когда клиенту нужен специалист, он не хочет ждать ответа до утра или искать слот через несколько каналов.',
      'TezBron принимает записи 24/7, отправляет подтверждения и напоминания, а команде показывает актуальную загрузку по кабинетам и специалистам.',
      'Это снижает потери на пропущенных визитах и убирает лишнюю ручную координацию между администраторами и экспертами.',
    ],
    ctaLabel: 'Посмотреть сценарий для клиник и wellness',
    ctaHref: '/features',
    visualTitle: 'Доступная запись и меньше пропущенных визитов',
    visualSubtitle: 'Клиенты записываются сами, а команда держит под контролем кабинеты и специалистов.',
    visualIcon: HeartPulse,
    visualCards: [
      {
        title: 'Запись на консультацию и процедуры',
        meta: 'Свободные окна публикуются без ручного ответа в чатах',
        status: '24/7',
      },
      {
        title: 'Автоматические напоминания клиентам',
        meta: 'Меньше забытых визитов и переносов в последний момент',
        status: 'Забота',
      },
      {
        title: 'Кабинеты и специалисты в одном расписании',
        meta: 'Администратор видит пересечения до того, как они станут проблемой',
        status: 'Ясно',
      },
    ],
    scenarios: [
      { label: 'Массаж', description: 'Слоты, кабинеты и напоминания для плотной загрузки дня.', icon: Sparkles },
      { label: 'Физиотерапия', description: 'Специалисты и процедуры в одном календаре.', icon: Stethoscope },
      { label: 'Консультанты', description: 'Удобная запись для частных практик и команд.', icon: Users },
      { label: 'Диагностика', description: 'Управление временем, ресурсами и подтверждениями.', icon: CalendarClock },
      { label: 'Оздоровительные программы', description: 'Пакеты услуг и повторные визиты без ручной рутины.', icon: NotebookPen },
      { label: 'Клиники', description: 'Операционная прозрачность для администраторов и владельцев.', icon: ShieldCheck },
    ],
  },
  {
    id: 'education',
    label: 'Учебные центры',
    eyebrow: 'Классы и воркшопы',
    title: 'Учебные центры',
    description: [
      'Группы, преподаватели, аудитории и повторяющиеся занятия быстро ломают расписание, если процессы живут в чатах и таблицах.',
      'TezBron помогает собрать в одной системе курсы, слоты, ограничения по местам и календарь преподавателей.',
      'Менеджеры видят заполняемость, а ученики записываются по понятному сценарию без звонков и ручной переписки.',
    ],
    ctaLabel: 'Посмотреть сценарий для учебных центров',
    ctaHref: '/features',
    visualTitle: 'Курсы, группы и аудитории под контролем',
    visualSubtitle: 'Повторяющиеся занятия и запись на классы без перегрузки администраторов.',
    visualIcon: GraduationCap,
    visualCards: [
      {
        title: 'Еженедельные занятия и лимиты мест',
        meta: 'Расписание курсов публикуется сразу с правилами записи',
        status: 'Класс',
      },
      {
        title: 'Преподаватели и аудитории',
        meta: 'Ресурсы синхронизируются без двойных броней',
        status: 'План',
      },
      {
        title: 'Подтверждения и напоминания',
        meta: 'Ученики получают понятный путь до занятия',
        status: 'Готово',
      },
    ],
    scenarios: [
      { label: 'Языковые школы', description: 'Группы, преподаватели и уровни в одном процессе.', icon: BookOpen },
      { label: 'Интенсивы', description: 'Сложные интенсивы и потоки без ручной сводки.', icon: GraduationCap },
      { label: 'Воркшопы', description: 'Разовые события и лимиты мест по понятному сценарию.', icon: Sparkles },
      { label: 'Тьюторы', description: 'Личные занятия и гибкое расписание по слотам.', icon: Users },
      { label: 'Учебные аудитории', description: 'Контроль комнат и оборудования для каждой сессии.', icon: Building2 },
      { label: 'Групповые курсы', description: 'Заполняемость, подтверждения и история изменений.', icon: CalendarRange },
    ],
  },
  {
    id: 'service',
    label: 'Сервисные команды',
    eyebrow: 'Сервисные команды',
    title: 'Сервисные команды',
    description: [
      'Когда команда обслуживает клиентов по слотам, каждая переноска или пропущенное подтверждение сразу бьёт по загрузке дня.',
      'TezBron фиксирует окна, статусы, напоминания и историю изменений, чтобы менеджеры и исполнители видели один источник правды.',
      'Так проще планировать смены, перераспределять заявки и не терять выручку на хаосе в расписании.',
    ],
    ctaLabel: 'Посмотреть сценарий для сервисных команд',
    ctaHref: '/features',
    visualTitle: 'Окна выездов и смены без хаоса в коммуникации',
    visualSubtitle: 'Единый поток заявок и понятное распределение нагрузки между исполнителями.',
    visualIcon: BriefcaseBusiness,
    visualCards: [
      {
        title: 'Заявки и переносы в одном потоке',
        meta: 'Команда видит изменения без потерь между чатами',
        status: 'Операции',
      },
      {
        title: 'Напоминания клиентам и сотрудникам',
        meta: 'Снижаем пропущенные визиты и накладки по времени',
        status: 'Отправка',
      },
      {
        title: 'Планирование загрузки по сменам',
        meta: 'Менеджер распределяет день по актуальным слотам',
        status: 'Смена',
      },
    ],
    scenarios: [
      { label: 'Автодетейлинг', description: 'Слоты, длительность работ и загрузка боксов.', icon: Car },
      { label: 'Груминг животных', description: 'Запись по мастерам, услугам и времени визита.', icon: PawPrint },
      { label: 'Домашний сервис', description: 'Выездные заявки и подтверждения по времени.', icon: MapPinned },
      { label: 'Фото и продакшн', description: 'Команды, площадки и бронь под проектные слоты.', icon: BriefcaseBusiness },
      { label: 'Тату-студии', description: 'Длинные сессии, депозиты и напоминания клиентам.', icon: Sparkles },
      { label: 'Клининг', description: 'Смены, районы и контроль расписания в одной системе.', icon: ShieldCheck },
    ],
  },
  {
    id: 'multi-location',
    label: 'Мульти-локации',
    eyebrow: 'Сетевые операции',
    title: 'Мульти-локации',
    description: [
      'Если у бизнеса несколько филиалов, сложнее всего сохранить единый стандарт записи и прозрачную загрузку по всей сети.',
      'TezBron объединяет локации, комнаты, услуги и роли в одну систему без ручной сверки между администраторами.',
      'Руководитель получает общую картину по сети, а каждая команда работает в своём понятном операционном контуре.',
    ],
    ctaLabel: 'Посмотреть сценарий для сети и филиалов',
    ctaHref: '/features',
    visualTitle: 'Одна система для филиалов, комнат и команд',
    visualSubtitle: 'Сеть растет, а правила записи и контроля остаются едиными.',
    visualIcon: MapPinned,
    visualCards: [
      {
        title: 'Филиалы и локальные расписания',
        meta: 'Каждая площадка работает в своём контуре, но по общим правилам',
        status: 'Сеть',
      },
      {
        title: 'Роли, доступы и история действий',
        meta: 'Управляющая команда видит картину по сети без лишнего шума',
        status: 'Роли',
      },
      {
        title: 'Комнаты, услуги и загрузка по сети',
        meta: 'Планирование масштабируется без ручной координации',
        status: 'Масштаб',
      },
    ],
    scenarios: [
      { label: 'Сети студий', description: 'Единый стандарт записи и контроль загрузки по точкам.', icon: Building2 },
      { label: 'Франшизы', description: 'Прозрачные процессы и разделение ролей между командами.', icon: ShieldCheck },
      { label: 'Центральный офис', description: 'Общий обзор по филиалам и ключевым операционным метрикам.', icon: BriefcaseBusiness },
      { label: 'Комнаты и ресурсы', description: 'Понятное управление кабинетами, залами и сервисами.', icon: DoorOpen },
      { label: 'Общая команда', description: 'Права доступа и сценарии работы для разных ролей.', icon: Users },
      { label: 'Сетевой календарь', description: 'Слоты, статусы и история бронирований по всем локациям.', icon: CalendarRange },
    ],
  },
];

function IndustryVisual({ industry }: { industry: IndustryShowcase }) {
  const VisualIcon = industry.visualIcon;

  return (
    <div className="relative overflow-hidden rounded-[1.5rem] border border-border/60 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.22),transparent_34%),linear-gradient(145deg,rgba(255,255,255,0.97),rgba(238,244,252,0.96))] p-4 shadow-[0_22px_56px_-42px_hsl(var(--primary)/0.34)] sm:p-5">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border)/0.28)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.28)_1px,transparent_1px)] bg-[size:32px_32px] opacity-35" />
      <div className="absolute -left-10 bottom-0 h-24 w-24 rounded-full bg-sky-200/40 blur-3xl" />
      <div className="absolute -right-8 top-6 h-24 w-24 rounded-full bg-primary/15 blur-3xl" />

      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="max-w-sm">
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">{industry.eyebrow}</p>
          <h3 className="mt-2 text-lg font-semibold leading-tight text-foreground sm:text-[1.45rem]">{industry.visualTitle}</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{industry.visualSubtitle}</p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.95rem] bg-primary text-primary-foreground shadow-[0_18px_40px_-20px_hsl(var(--primary)/0.7)]">
          <VisualIcon className="h-4.5 w-4.5" />
        </div>
      </div>

      <div className="relative z-10 mt-4 grid gap-2.5">
        {industry.visualCards.slice(0, 2).map((card, index) => (
          <div
            key={card.title}
            className={`rounded-[1.25rem] border border-border/70 bg-background/88 px-4 py-3 shadow-sm backdrop-blur ${
              index === 1 ? 'ml-auto sm:max-w-[92%]' : ''
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">{card.title}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{card.meta}</p>
              </div>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">{card.status}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function B2BHome() {
  const { t } = useI18n();
  const localizedHeroStats = heroStats.map((item) => ({
    ...item,
    label: t(item.label),
    description: t(item.description),
  }));
  const localizedIndustryShowcases = industryShowcases.map((industry) => ({
    ...industry,
    label: t(industry.label),
    eyebrow: t(industry.eyebrow),
    title: t(industry.title),
    description: industry.description.map((item) => t(item)),
    ctaLabel: t(industry.ctaLabel),
    visualTitle: t(industry.visualTitle),
    visualSubtitle: t(industry.visualSubtitle),
    visualCards: industry.visualCards.map((card) => ({
      ...card,
      title: t(card.title),
      meta: t(card.meta),
      status: t(card.status),
    })),
    scenarios: industry.scenarios.map((scenario) => ({
      ...scenario,
      label: t(scenario.label),
      description: t(scenario.description),
    })),
  }));
  const localizedHomeFeatureCards = homeFeatureCards.map((card) => ({
    ...card,
    title: t(card.title),
    description: t(card.description),
    bullets: card.bullets.map((bullet) => t(bullet)),
  }));
  const localizedPricingPlans = pricingPlans.map((plan) => ({
    ...plan,
    name: t(plan.name),
    tagline: t(plan.tagline),
    description: t(plan.description),
    badge: plan.badge ? t(plan.badge) : undefined,
    ctaLabel: t(plan.ctaLabel),
    billingNote: plan.billingNote ? t(plan.billingNote) : undefined,
    features: plan.features.map((feature) => t(feature)),
  }));
  const localizedFaqItems = faqItems.map((item) => ({
    question: t(item.question),
    answer: t(item.answer),
  }));

  return (
    <MarketingShell>
      <section className="mx-auto max-w-7xl px-4 pb-16 pt-0 sm:px-6 lg:px-8 lg:pb-20 lg:pt-0">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-4xl font-semibold leading-[0.95] text-foreground sm:text-5xl lg:text-7xl">
            {t('Управляйте записями, загрузкой и командой в одной системе.')}
          </h1>
          <p className="mt-6 max-w-3xl text-base leading-8 text-muted-foreground sm:text-lg">
            {t(
              'TezBron помогает владельцам, менеджерам и командам выстроить понятный процесс записи, синхронизировать расписание и держать под контролем площадки, услуги и бронирования без ручной рутины.',
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

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {localizedHeroStats.map((item) => (
              <div key={item.label} className="marketing-panel rounded-[1.5rem] border border-border/70 p-5">
                <p className="text-3xl font-semibold text-foreground">{item.value}</p>
                <p className="mt-2 text-sm font-medium text-foreground">{item.label}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-border/60 bg-background/72">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <Tabs defaultValue={localizedIndustryShowcases[0].id} className="gap-6">
            <div className="rounded-[1.75rem] border border-border/70 bg-background/78 p-4 shadow-[0_18px_45px_-42px_hsl(var(--primary)/0.3)] sm:p-5">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                <div className="max-w-lg">
                  <h2 className="text-2xl font-semibold leading-tight text-foreground sm:text-[2rem]">
                    {t('Выберите сценарий, который ближе вашему бизнесу.')}
                  </h2>
                </div>

                <TabsList className="h-auto w-full flex-wrap justify-start gap-3 rounded-none bg-transparent p-0 xl:w-auto xl:justify-end">
                  {localizedIndustryShowcases.map((industry) => (
                    <TabsTrigger
                      key={industry.id}
                      value={industry.id}
                      className="h-auto rounded-full border border-border/70 bg-card/80 px-5 py-3 text-sm font-medium text-foreground shadow-none transition-all data-[state=active]:border-primary/20 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-[0_20px_42px_-28px_hsl(var(--primary)/0.72)]"
                    >
                      {industry.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
            </div>

            {localizedIndustryShowcases.map((industry) => (
              <TabsContent key={industry.id} value={industry.id} className="mt-0">
                <div className="marketing-panel rounded-[1.75rem] border border-border/70 p-4 sm:p-5">
                  <div className="grid gap-5 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] lg:items-start">
                    <IndustryVisual industry={industry} />

                    <div className="max-w-2xl">
                      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">{industry.eyebrow}</p>
                      <h3 className="mt-2 text-2xl font-semibold text-foreground sm:text-[2rem]">{industry.title}</h3>

                      <p className="mt-4 text-base leading-7 text-muted-foreground">{industry.description[0]}</p>

                      <Link
                        to={industry.ctaHref}
                        className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary transition-colors hover:text-primary/80"
                      >
                        {industry.ctaLabel}
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2.5">
                    {industry.scenarios.map((scenario) => {
                      const ScenarioIcon = scenario.icon;

                      return (
                        <article
                          key={scenario.label}
                          className="inline-flex items-center gap-2.5 rounded-full border border-border/70 bg-background/82 px-3.5 py-2 shadow-[0_18px_38px_-36px_hsl(var(--primary)/0.34)]"
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <ScenarioIcon className="h-4 w-4" />
                          </div>
                          <p className="text-sm font-medium text-foreground">{scenario.label}</p>
                        </article>
                      );
                    })}
                  </div>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)] xl:items-start">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold text-foreground sm:text-4xl">
              {t('Запуск TezBron выстроен как понятный сценарий: от первого касания до ежедневного управления.')}
            </h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              {t(
                'Бизнес получает единый цифровой контур, где запись клиентов, командная работа и операционный контроль собраны в одном понятном процессе.',
              )}
            </p>
          </div>

          <div className="marketing-panel overflow-hidden rounded-[2rem] border border-primary/15 p-6 sm:p-7">
            <div className="max-w-xl">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">{t('После запуска')}</p>
              <p className="mt-3 text-2xl font-semibold text-foreground sm:text-[2rem]">
                {t('Команда получает рабочий контур с первого дня.')}
              </p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {t('Здесь уже не про шаги настройки, а про то, что появляется у команды сразу после запуска.')}
              </p>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {[
                {
                  title: 'Собранная структура',
                  description: 'Площадки, комнаты и услуги лежат в одном понятном контуре.',
                },
                {
                  title: 'Распределённые роли',
                  description: 'Владелец, менеджер и сотрудники видят только свой слой работы.',
                },
                {
                  title: 'Открытая запись',
                  description: 'Клиент получает понятный путь до бронирования без ручного подтверждения.',
                },
                {
                  title: 'Живой операционный обзор',
                  description: 'Команда сразу видит загрузку, статусы и историю изменений.',
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-[1.5rem] border border-border/60 bg-background/82 p-4"
                >
                  <p className="text-sm font-semibold text-foreground">{t(item.title)}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{t(item.description)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

      </section>

      <section className="border-y border-border/60 bg-background/72">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <h2 className="text-3xl font-semibold text-foreground sm:text-4xl">
              {t('TezBron помогает владельцам, менеджерам и командам работать в одном процессе.')}
            </h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              {t(
                'Все ключевые возможности собраны так, чтобы запись клиентов, управление загрузкой и командная работа оставались понятными на каждом этапе.',
              )}
            </p>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {localizedHomeFeatureCards.map((card, index) => {
              const Icon = featureIcons[index];

              return (
                <article key={card.title} className="marketing-panel rounded-[1.75rem] border border-border/70 p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 text-xl font-semibold text-foreground">{card.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">{card.description}</p>
                  <ul className="mt-5 space-y-3">
                    {card.bullets.map((bullet) => (
                      <li key={bullet} className="rounded-2xl border border-border/60 bg-background/78 px-4 py-3 text-sm text-muted-foreground">
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-y border-border/60 bg-background/72">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <h2 className="text-3xl font-semibold text-foreground sm:text-4xl">
                {t('Выберите тариф, который подходит масштабу вашей команды и нагрузке бизнеса.')}
              </h2>
            </div>
            <Button asChild variant="outline" className="rounded-full px-6">
              <Link to="/pricing">{t('Открыть полные тарифы')}</Link>
            </Button>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {localizedPricingPlans.map((plan) => (
              <article
                key={plan.name}
                className={`rounded-[1.75rem] border p-6 ${
                  plan.highlighted
                    ? 'border-primary/30 bg-primary/[0.08] shadow-[0_26px_70px_-42px_hsl(var(--primary)/0.55)]'
                    : 'marketing-panel border-border/70'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-semibold text-foreground">{plan.name}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{plan.tagline}</p>
                  </div>
                  {plan.badge ? (
                    <span className="rounded-full bg-background/90 px-3 py-1 text-xs font-medium text-primary shadow-sm">
                      {plan.badge}
                    </span>
                  ) : null}
                </div>
                <p className="mt-6 text-4xl font-semibold text-foreground">
                  {plan.monthlyPrice === null
                    ? t('Индивидуально')
                    : plan.monthlyPrice === 0
                      ? t('Бесплатно')
                      : formatSumPrice(plan.monthlyPrice)}
                </p>
                {plan.billingNote ? (
                  <p className="mt-2 text-sm font-medium text-muted-foreground">{plan.billingNote}</p>
                ) : null}
                <p className="mt-3 text-sm leading-7 text-muted-foreground">{plan.description}</p>
                <ul className="mt-6 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="text-sm text-foreground">{feature}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-semibold text-foreground sm:text-4xl">
            {t('Ключевые вопросы о запуске TezBron и работе с бизнес-кабинетом.')}
          </h2>
        </div>

        <div className="marketing-panel mt-10 rounded-[2rem] border border-border/70 px-6 py-2 sm:px-8">
          <Accordion type="single" collapsible>
            {localizedFaqItems.slice(0, 4).map((item) => (
              <AccordionItem key={item.question} value={item.question} className="border-border/60">
                <AccordionTrigger className="py-5 text-base text-foreground hover:no-underline">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="pb-5 text-sm leading-7 text-muted-foreground">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

    </MarketingShell>
  );
}
