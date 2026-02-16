import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n/useI18n';

interface RoomPhotoGalleryProps {
  photos: string[];
  roomName: string;
  className?: string;
  imageContainerClassName?: string;
  imageClassName?: string;
  showThumbnails?: boolean;
  showControls?: boolean;
}

export function RoomPhotoGallery({
  photos,
  roomName,
  className,
  imageContainerClassName,
  imageClassName,
  showThumbnails = false,
  showControls = true,
}: RoomPhotoGalleryProps) {
  const { t } = useI18n();
  const normalizedPhotos = useMemo(
    () => Array.from(new Set(photos.map((photo) => photo.trim()).filter((photo) => photo.length > 0))),
    [photos],
  );
  const [activeIndex, setActiveIndex] = useState(0);

  if (normalizedPhotos.length === 0) {
    return null;
  }

  const boundedActiveIndex = Math.min(activeIndex, normalizedPhotos.length - 1);
  const activePhoto = normalizedPhotos[boundedActiveIndex] ?? normalizedPhotos[0];
  const hasMultiplePhotos = normalizedPhotos.length > 1;
  const canUseControls = hasMultiplePhotos && showControls;

  const goPrev = () => {
    if (!canUseControls) return;
    setActiveIndex((prev) => (prev === 0 ? normalizedPhotos.length - 1 : prev - 1));
  };

  const goNext = () => {
    if (!canUseControls) return;
    setActiveIndex((prev) => (prev === normalizedPhotos.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className={cn('space-y-2', className)}>
      <div className={cn('relative overflow-hidden border border-border/40 bg-muted/20', imageContainerClassName)}>
        <img
          src={activePhoto}
          alt={t('Фото комнаты {roomName}', { roomName })}
          className={cn('w-full h-full object-cover', imageClassName)}
          loading="lazy"
        />

        {canUseControls ? (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/40 text-white hover:bg-black/55"
              onClick={goPrev}
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="sr-only">{t('Предыдущее фото')}</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/40 text-white hover:bg-black/55"
              onClick={goNext}
            >
              <ChevronRight className="h-4 w-4" />
              <span className="sr-only">{t('Следующее фото')}</span>
            </Button>
            <div className="absolute right-2 top-2 rounded-full bg-black/45 px-2 py-0.5 text-[11px] font-medium text-white">
              {boundedActiveIndex + 1}/{normalizedPhotos.length}
            </div>
            <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/35 px-2 py-1">
              {normalizedPhotos.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  aria-label={t('Показать фото {index}', { index: index + 1 })}
                  className={cn(
                    'h-1.5 w-1.5 rounded-full transition-all',
                    index === boundedActiveIndex ? 'bg-white w-3' : 'bg-white/55 hover:bg-white/75',
                  )}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>

      {showThumbnails && hasMultiplePhotos ? (
        <div className="grid grid-cols-5 gap-2">
          {normalizedPhotos.map((photo, index) => (
            <button
              key={`${photo}-${index}`}
              type="button"
              className={cn(
                'relative aspect-square overflow-hidden rounded-md border transition-all',
                index === boundedActiveIndex
                  ? 'border-primary ring-2 ring-primary/35'
                  : 'border-border/40 opacity-80 hover:opacity-100',
              )}
              onClick={() => setActiveIndex(index)}
              aria-label={t('Выбрать фото {index}', { index: index + 1 })}
            >
              <img
                src={photo}
                alt={t('Миниатюра {index}', { index: index + 1 })}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
