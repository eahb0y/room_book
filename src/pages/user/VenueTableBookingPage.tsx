import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { TableSelection } from '@/components/floor-plans/TableSelection';

export default function VenueTableBookingPage() {
  const { venueId } = useParams<{ venueId: string }>();

  if (!venueId) {
    return (
      <Card className="border-border/40">
        <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
          <p className="text-base font-medium text-foreground">Заведение не найдено</p>
          <Button asChild variant="outline">
            <Link to="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Вернуться в каталог
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" className="w-fit">
        <Link to={`/venue/${venueId}`}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Назад к заведению
        </Link>
      </Button>
      <TableSelection venueId={venueId} />
    </div>
  );
}
