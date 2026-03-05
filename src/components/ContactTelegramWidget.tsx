import { MessageCircle, Phone } from 'lucide-react';
import { useI18n } from '@/i18n/useI18n';

const TELEGRAM_USERNAME = 'ad_swim';
const TELEGRAM_BASE_URL = `https://t.me/${TELEGRAM_USERNAME}`;
const PHONE_NUMBER = '+998996099069';
const TELEGRAM_LINK = TELEGRAM_BASE_URL;
const phoneHref = `tel:${PHONE_NUMBER.replace(/\s+/g, '')}`;

export default function ContactTelegramWidget() {
  const { t } = useI18n();

  return (
    <footer className="border-t border-border/50 bg-background/70 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 text-xs sm:px-6 lg:px-8">
        <span className="font-medium text-foreground">{t('Связаться с нами')}:</span>

        <a
          href={TELEGRAM_LINK}
          className="inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
          aria-label={`Telegram @${TELEGRAM_USERNAME}`}
        >
          <MessageCircle className="h-3.5 w-3.5" />
          <span>Telegram: @{TELEGRAM_USERNAME}</span>
        </a>

        <span className="text-border/80" aria-hidden="true">|</span>
        <a
          className="inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
          href={phoneHref}
        >
          <Phone className="h-3.5 w-3.5" />
          <span>{PHONE_NUMBER}</span>
        </a>
      </div>
    </footer>
  );
}
