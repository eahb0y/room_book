import { Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useI18n } from '@/i18n/useI18n';
import { cn } from '@/lib/utils';

interface RoomAmenitiesProps {
  roomId: string;
  services: string[];
  maxVisible?: number;
  className?: string;
  titleClassName?: string;
  badgeClassName?: string;
  overflowBadgeClassName?: string;
}

export function RoomAmenities({
  roomId,
  services,
  maxVisible = 4,
  className,
  titleClassName,
  badgeClassName,
  overflowBadgeClassName,
}: RoomAmenitiesProps) {
  const { t } = useI18n();

  const normalizedServices = Array.from(
    new Set(
      services
        .map((service) => service.trim())
        .filter((service) => service.length > 0),
    ),
  );

  if (normalizedServices.length === 0) return null;

  const visibleServices = normalizedServices.slice(0, maxVisible);
  const hiddenCount = Math.max(0, normalizedServices.length - visibleServices.length);

  return (
    <div className={cn('space-y-2', className)}>
      <p
        className={cn(
          'flex items-center gap-1.5 text-[11px] uppercase tracking-[0.12em] text-muted-foreground',
          titleClassName,
        )}
      >
        <Sparkles className="h-3.5 w-3.5" />
        <span>{t('Что предоставляется с комнатой')}</span>
      </p>
      <div className="flex flex-wrap gap-1.5">
        {visibleServices.map((service) => (
          <Badge
            key={`${roomId}-${service}`}
            variant="outline"
            className={cn('border-border/60 bg-background/45 text-[11px] text-foreground/85', badgeClassName)}
          >
            {service}
          </Badge>
        ))}
        {hiddenCount > 0 ? (
          <Badge
            variant="outline"
            className={cn(
              'border-border/60 bg-background/30 text-[11px] text-muted-foreground',
              overflowBadgeClassName,
            )}
          >
            +{hiddenCount}
          </Badge>
        ) : null}
      </div>
    </div>
  );
}
