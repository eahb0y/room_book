import { useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useVenueStore } from '@/store/venueStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, MapPin, ArrowRight, DoorOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n/useI18n';

export default function VenueList() {
  const { t } = useI18n();
  const { user, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const memberships = useVenueStore((state) => state.memberships);
  const allVenues = useVenueStore((state) => state.venues);
  const venues = useMemo(() => {
    if (!user) return [];
    const venueIds = memberships
      .filter((m) => m.userId === user.id)
      .map((m) => m.venueId);
    return allVenues.filter((v) => venueIds.includes(v.id));
  }, [user, memberships, allVenues]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (user?.role === 'admin') {
      navigate('/app');
    }
  }, [user, isAuthenticated, navigate]);

  if (user?.role === 'admin') {
    return null;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-semibold text-foreground tracking-tight">
          {t('Доступные заведения')}
        </h1>
        <p className="text-muted-foreground mt-2">
          {t('Выберите заведение для просмотра доступных комнат')}
        </p>
      </div>

      {venues.length === 0 ? (
        <Card className="border-border/40 animate-fade-up">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-secondary/50 flex items-center justify-center mb-5">
              <Building2 className="h-7 w-7 text-muted-foreground/40" />
            </div>
            <p className="text-muted-foreground mb-1">{t('Пока нет доступных заведений')}</p>
            <p className="text-sm text-muted-foreground/70">
              {t('Загляните позже или обратитесь к администратору')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {venues.map((venue, i) => (
            <VenueCard key={venue.id} venue={venue} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function VenueCard({ venue, index }: {
  venue: { id: string; name: string; description: string; address: string; adminId: string; createdAt: string };
  index: number;
}) {
  const { t } = useI18n();
  const allRooms = useVenueStore((state) => state.rooms);
  const rooms = useMemo(() => allRooms.filter((r) => r.venueId === venue.id), [allRooms, venue.id]);

  return (
    <Card className={`card-hover stagger-${Math.min(index + 1, 6)} animate-fade-up`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2.5 text-base">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Building2 className="h-4 w-4 text-primary" />
          </div>
          <span className="font-body font-semibold truncate">{venue.name}</span>
        </CardTitle>
        <CardDescription className="flex items-start gap-2 pl-[42px]">
          <MapPin className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
          <span>{venue.address}</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        {venue.description && (
          <p className="text-sm text-muted-foreground mb-4 line-clamp-2 pl-[42px]">
            {venue.description}
          </p>
        )}
        <div className="flex items-center justify-between pl-[42px]">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <DoorOpen className="h-3.5 w-3.5" />
            <span>{t('{count} комнат', { count: rooms.length })}</span>
          </div>
          <Button asChild size="sm" className="group/btn h-9">
            <Link to={`/venue/${venue.id}`} className="flex items-center gap-1.5">
              <span>{t('Просмотреть')}</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover/btn:translate-x-0.5" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
