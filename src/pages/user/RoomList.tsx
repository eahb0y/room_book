import { useEffect, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useVenueStore } from '@/store/venueStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DoorOpen, Users, ArrowLeft, ArrowRight, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function RoomList() {
  const { venueId } = useParams<{ venueId: string }>();
  const { user, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  const venue = useVenueStore((state) =>
    state.venues.find((v) => v.id === venueId)
  );
  const membership = useVenueStore((state) =>
    venueId && user ? state.getMembership(venueId, user.id) : undefined
  );
  const allRooms = useVenueStore((state) => state.rooms);
  const rooms = useMemo(() => allRooms.filter((r) => r.venueId === venueId), [allRooms, venueId]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (user?.role === 'admin') navigate('/app');
    if (!venue) navigate('/app');
    if (user && !membership) navigate('/app');
  }, [user, isAuthenticated, venue, membership, navigate]);

  if (!venue) return null;

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link to="/app" className="text-muted-foreground hover:text-primary transition-colors">Заведения</Link>
        <span className="text-muted-foreground/40">/</span>
        <span className="text-foreground/80">{venue.name}</span>
      </div>

      {/* Venue info */}
      <div>
        <h1 className="text-4xl font-semibold text-foreground tracking-tight">
          {venue.name}
        </h1>
        <p className="text-muted-foreground mt-2 flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          <span>{venue.address}</span>
        </p>
        {venue.description && (
          <p className="text-muted-foreground/80 mt-2 max-w-2xl">{venue.description}</p>
        )}
      </div>

      {/* Section header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center">
            <DoorOpen className="h-4 w-4 text-primary" />
          </div>
          <span className="font-body">Доступные комнаты</span>
        </h2>
        <Button variant="outline" onClick={() => navigate('/app')} className="border-border/50 hover:border-primary/30">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Назад
        </Button>
      </div>

      {/* Room grid */}
      {rooms.length === 0 ? (
        <Card className="border-border/40 animate-fade-up">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <DoorOpen className="h-10 w-10 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground text-sm">В этом заведении пока нет комнат</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {rooms.map((room, i) => (
            <Card key={room.id} className={`card-hover stagger-${Math.min(i + 1, 6)} animate-fade-up`}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2.5 text-base">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <DoorOpen className="h-4 w-4 text-primary" />
                  </div>
                  <span className="font-body font-semibold">{room.name}</span>
                </CardTitle>
                <CardDescription className="pl-[42px]">
                  <Badge variant="secondary" className="flex items-center gap-1.5 w-fit text-xs">
                    <Users className="h-3 w-3" />
                    <span>до {room.capacity} человек</span>
                  </Badge>
                </CardDescription>
              </CardHeader>
              <CardContent className="pl-[42px]">
                <Button asChild className="w-full group/btn h-10">
                  <Link to={`/room/${room.id}`} className="flex items-center justify-center gap-2">
                    <span>Забронировать</span>
                    <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-0.5" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
