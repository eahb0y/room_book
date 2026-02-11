import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  ArrowUpRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  DoorOpen,
  LayoutGrid,
  ShieldCheck,
  Sparkles,
  Ticket,
  Users,
} from 'lucide-react';

const highlights = [
  {
    title: 'Роли без путаницы',
    description: 'Администратор управляет площадкой, участники бронируют только доступные комнаты.',
    icon: Users,
  },
  {
    title: 'Приглашения с правилами',
    description: 'Токены с лимитом использований и сроком действия — доступ только по приглашению.',
    icon: Ticket,
  },
  {
    title: 'Контроль конфликтов',
    description: 'Проверка пересечений не позволяет наложить брони в один слот.',
    icon: ShieldCheck,
  },
];

const features = [
  {
    title: 'Заведение как витрина',
    description: 'Название, адрес, описание — единый профиль пространства для команды и гостей.',
    icon: Building2,
  },
  {
    title: 'Комнаты и вместимость',
    description: 'Добавляйте комнаты, фиксируйте вместимость, структурируйте объекты по типам.',
    icon: DoorOpen,
  },
  {
    title: 'Бронирования по слотам',
    description: 'Дата, время начала и окончания — только валидные интервалы.',
    icon: CalendarDays,
  },
  {
    title: 'Списки и статусы',
    description: 'У каждого участника — своя история, у админа — сводка по заведению.',
    icon: LayoutGrid,
  },
  {
    title: 'Отмена без хаоса',
    description: 'Отмена фиксируется статусом и сразу отражается в расписании.',
    icon: Clock,
  },
  {
    title: 'Тонкая настройка доступа',
    description: 'Приглашения, лимиты, сроки — вы сами задаёте правила входа.',
    icon: Sparkles,
  },
];

const steps = [
  {
    label: 'Шаг 01',
    title: 'Создайте заведение',
    description: 'Опишите пространство, добавьте адрес и общие детали.',
  },
  {
    label: 'Шаг 02',
    title: 'Добавьте комнаты',
    description: 'Сформируйте список комнат и отметьте вместимость.',
  },
  {
    label: 'Шаг 03',
    title: 'Разошлите приглашения',
    description: 'Пользователи попадают внутрь только по токену.',
  },
  {
    label: 'Шаг 04',
    title: 'Управляйте бронированиями',
    description: 'Слоты, статусы, история — всё в одном месте.',
  },
];

const useCases = [
  'Коворкинги и гибкие офисы',
  'Переговорные комнаты',
  'Студии записи и подкаст-румы',
  'Учебные классы и лектории',
  'Пространства для ивентов',
];

const faqs = [
  {
    question: 'Кому подходит платформа?',
    answer:
      'Администраторам пространств, которым нужно управлять комнатами и слотами, и командам, которым важна прозрачная система бронирований.',
  },
  {
    question: 'Как ограничивается доступ?',
    answer:
      'Доступ выдаётся через приглашения. Для каждого токена можно задать срок действия и лимит использований.',
  },
  {
    question: 'Что происходит при отмене брони?',
    answer:
      'Бронирование переводится в статус отменённого и сразу исчезает из активного расписания комнаты.',
  },
  {
    question: 'Как избежать пересечений?',
    answer:
      'Система проверяет конфликтные интервалы и не даст создать пересекающиеся слоты.',
  },
];

export default function Landing() {
  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-hidden">
      {/* Background layers */}
      <div className="absolute inset-0">
        <div className="absolute -top-48 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_top,rgba(215,141,62,0.22),rgba(6,7,12,0))] blur-[120px]" />
        <div className="absolute bottom-[-220px] right-[-120px] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(215,141,62,0.18),rgba(6,7,12,0))] blur-[120px]" />
        <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:72px_72px]" />
      </div>

      {/* Header */}
      <header className="relative z-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 pt-8">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/90 flex items-center justify-center shadow-glow">
                <CalendarDays className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="font-display text-xl tracking-tight">Пространство</div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Booking System</div>
              </div>
            </Link>
            <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
              <a href="#features" className="hover:text-foreground transition-colors">Преимущества</a>
              <a href="#process" className="hover:text-foreground transition-colors">Как работает</a>
              <a href="#faq" className="hover:text-foreground transition-colors">FAQ</a>
            </nav>
            <div className="flex items-center gap-2">
              <Button variant="ghost" asChild className="hidden sm:inline-flex">
                <Link to="/login">Войти</Link>
              </Button>
              <Button asChild className="gap-2">
                <Link to="/register">Создать аккаунт</Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="relative z-10">
        <section className="max-w-7xl mx-auto px-6 lg:px-8 pt-16 pb-20">
          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-16 items-center">
            <div className="space-y-8 animate-fade-up">
              <Badge variant="outline" className="border-primary/40 text-primary/90 bg-primary/10">
                Платформа управления бронированиями
              </Badge>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl leading-[1.05] font-semibold">
                Пространства, которые бронируют без хаоса и ручной координации.
              </h1>
              <p className="text-lg text-muted-foreground max-w-xl">
                Создавайте заведения, добавляйте комнаты и давайте доступ по приглашениям.
                Система сама отсечёт пересечения и покажет актуальную загрузку.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button size="lg" asChild className="gap-2">
                  <Link to="/register">
                    Запустить пространство
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button variant="outline" size="lg" asChild className="border-border/60">
                  <a href="#features">Посмотреть преимущества</a>
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  Гибкие приглашения и роли
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-amber-400" />
                  Контроль конфликтов слотов
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full border border-primary/30 bg-primary/10 blur-sm" />
              <div className="rounded-3xl border border-border/50 bg-card/70 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur">
                <div className="flex items-center justify-between border-b border-border/40 px-6 py-4">
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-[0.3em]">Сегодня</div>
                    <div className="text-lg font-medium">Панель бронирований</div>
                  </div>
                  <Badge className="bg-emerald-500/10 text-emerald-300 border-emerald-500/40">Live</Badge>
                </div>
                <div className="px-6 py-5 space-y-4">
                  {[
                    { time: '09:00 — 10:30', name: 'Переговорная А', status: 'Активно' },
                    { time: '11:00 — 12:00', name: 'Подкаст-рум', status: 'Ожидает' },
                    { time: '14:00 — 15:00', name: 'Студия С', status: 'Активно' },
                  ].map((item) => (
                    <div
                      key={item.time}
                      className="flex items-center justify-between rounded-2xl border border-border/40 bg-background/60 px-4 py-3"
                    >
                      <div>
                        <div className="text-sm text-muted-foreground">{item.time}</div>
                        <div className="font-medium">{item.name}</div>
                      </div>
                      <span className="text-xs uppercase tracking-[0.25em] text-primary">
                        {item.status}
                      </span>
                    </div>
                  ))}
                  <div className="rounded-2xl border border-dashed border-primary/40 bg-primary/5 px-4 py-4">
                    <div className="text-sm text-primary">Свободные слоты отображаются автоматически</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Пересечения блокируются ещё до подтверждения.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Highlights */}
        <section className="max-w-7xl mx-auto px-6 lg:px-8 pb-16">
          <div className="grid gap-6 lg:grid-cols-3">
            {highlights.map((item, index) => {
              const Icon = item.icon;
              return (
                <Card key={item.title} className={`card-hover border-border/50 bg-card/60 ${index < 3 ? `stagger-${index + 1}` : ''} animate-fade-up`}>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="text-lg font-semibold">{item.title}</div>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Features */}
        <section id="features" className="max-w-7xl mx-auto px-6 lg:px-8 py-20">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8 mb-12">
            <div className="max-w-2xl">
              <div className="text-xs uppercase tracking-[0.4em] text-muted-foreground">Преимущества</div>
              <h2 className="text-3xl sm:text-4xl font-semibold mt-3">
                Всё, что нужно для бронирований, собрано в одном интерфейсе.
              </h2>
            </div>
            <div className="text-sm text-muted-foreground max-w-md">
              Управляйте заведениями, комнатами и доступом в едином потоке — без таблиц и ручных подтверждений.
            </div>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className={`rounded-2xl border border-border/50 bg-card/50 p-6 card-hover animate-fade-up ${index < 6 ? `stagger-${(index % 6) + 1}` : ''}`}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="text-lg font-semibold">{feature.title}</div>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Process */}
        <section id="process" className="max-w-7xl mx-auto px-6 lg:px-8 py-20">
          <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-12 items-start">
            <div className="space-y-6">
              <div className="text-xs uppercase tracking-[0.4em] text-muted-foreground">Процесс</div>
              <h2 className="text-3xl sm:text-4xl font-semibold">
                Чёткий сценарий: от заведения до забронированного слота.
              </h2>
              <p className="text-muted-foreground">
                Всё продумано для админов и пользователей: нет хаоса, только прозрачный путь.
              </p>
              <div className="space-y-3">
                {[
                  'Единая панель админа',
                  'Доступ только по приглашениям',
                  'Чёткая история бронирований',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid gap-4">
              {steps.map((step, index) => (
                <div
                  key={step.label}
                  className={`rounded-2xl border border-border/50 bg-card/60 p-6 card-hover animate-fade-up ${index < 6 ? `stagger-${index + 1}` : ''}`}
                >
                  <div className="text-xs uppercase tracking-[0.4em] text-primary">{step.label}</div>
                  <div className="text-lg font-semibold mt-3">{step.title}</div>
                  <p className="text-sm text-muted-foreground mt-2">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Use cases */}
        <section className="max-w-7xl mx-auto px-6 lg:px-8 pb-20">
          <div className="rounded-3xl border border-border/50 bg-card/60 p-8 lg:p-12">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-10">
              <div className="max-w-lg">
                <div className="text-xs uppercase tracking-[0.4em] text-muted-foreground">Сценарии</div>
                <h3 className="text-2xl sm:text-3xl font-semibold mt-3">
                  Работает для любого пространства, где важны слоты и доступ.
                </h3>
                <p className="text-sm text-muted-foreground mt-4">
                  От переговорных до студий — единый подход к доступу, расписанию и контролю загрузки.
                </p>
              </div>
              <div className="grid gap-3 text-sm text-muted-foreground">
                {useCases.map((caseItem) => (
                  <div key={caseItem} className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-primary" />
                    <span>{caseItem}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="max-w-5xl mx-auto px-6 lg:px-8 py-20">
          <div className="text-center mb-10">
            <div className="text-xs uppercase tracking-[0.4em] text-muted-foreground">FAQ</div>
            <h2 className="text-3xl sm:text-4xl font-semibold mt-3">
              Ответы на ключевые вопросы
            </h2>
          </div>
          <Card className="border-border/50 bg-card/60">
            <CardContent className="pt-6">
              <Accordion type="single" collapsible className="divide-y divide-border/40">
                {faqs.map((faq) => (
                  <AccordionItem key={faq.question} value={faq.question} className="border-none">
                    <AccordionTrigger className="text-left text-base">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </section>

        {/* CTA */}
        <section className="max-w-6xl mx-auto px-6 lg:px-8 pb-24">
          <div className="rounded-3xl border border-primary/30 bg-[linear-gradient(130deg,rgba(215,141,62,0.18),rgba(6,7,12,0.75))] p-10 lg:p-14 shadow-[0_30px_80px_rgba(0,0,0,0.55)]">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
              <div className="max-w-xl">
                <div className="text-xs uppercase tracking-[0.4em] text-primary">Запуск</div>
                <h3 className="text-3xl sm:text-4xl font-semibold mt-3">
                  Готовы показать вашим командам идеальный календарь бронирований?
                </h3>
                <p className="text-sm text-muted-foreground mt-4">
                  Начните с регистрации, создайте своё заведение и отправьте первое приглашение.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button size="lg" asChild className="gap-2">
                  <Link to="/register">
                    Создать пространство
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild className="border-border/60">
                  <Link to="/login">Войти</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-border/40">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-10 text-sm text-muted-foreground flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <span>© Пространство, {new Date().getFullYear()}</span>
          <span>Платформа бронирования комнат и пространств</span>
        </div>
      </footer>
    </div>
  );
}
