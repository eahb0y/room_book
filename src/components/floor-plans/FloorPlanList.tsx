import { ImagePlus, Layers3, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { getFloorPlanStats } from '@/lib/floorPlanLayout';
import type { VenueFloorPlan } from '@/types';

export function FloorPlanList({
  floorPlans,
  selectedFloorPlanId,
  onSelect,
  onCreate,
  showAddButton = true,
  isBusy = false,
}: {
  floorPlans: VenueFloorPlan[];
  selectedFloorPlanId: string;
  onSelect: (floorPlanId: string) => void;
  onCreate?: () => void;
  showAddButton?: boolean;
  isBusy?: boolean;
}) {
  return (
    <Card className="border-border/40">
      <CardHeader className="space-y-4">
        <div className="space-y-1">
          <CardTitle>Планы заведения</CardTitle>
          <CardDescription>Переключайтесь между залами и смотрите вместимость по каждому плану.</CardDescription>
        </div>
        {showAddButton && onCreate ? (
          <div>
            <Button onClick={onCreate} disabled={isBusy} className="shrink-0">
              <ImagePlus className="mr-2 h-4 w-4" />
              Добавить план
            </Button>
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3">
        {floorPlans.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 bg-muted/10 px-4 py-10 text-center">
            <Layers3 className="mx-auto h-8 w-8 text-muted-foreground/45" />
            <p className="mt-3 text-sm font-medium text-foreground">Пока нет ни одного плана</p>
            <p className="mt-1 text-sm text-muted-foreground">Загрузите схему зала и начните расставлять столы.</p>
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            {floorPlans.map((floorPlan) => {
            const stats = getFloorPlanStats(floorPlan);

            return (
              <button
                key={floorPlan.id}
                type="button"
                onClick={() => onSelect(floorPlan.id)}
                className={cn(
                  'w-full rounded-2xl border px-4 py-4 text-left transition-all duration-300',
                  floorPlan.id === selectedFloorPlanId
                    ? 'border-primary/50 bg-primary/[0.08] shadow-[0_18px_44px_-30px_hsl(var(--primary)/0.45)]'
                    : 'border-border/50 bg-card/55 hover:border-border/80 hover:bg-card/80',
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-foreground">{floorPlan.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {floorPlan.width} x {floorPlan.height} px
                    </p>
                  </div>
                  <div className="rounded-full border border-border/50 px-2.5 py-1 text-xs text-muted-foreground">
                    {stats.tablesCount} столов
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Layers3 className="h-3.5 w-3.5" />
                    {stats.tablesCount} точек
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    Вместимость {stats.capacity}
                  </span>
                </div>
              </button>
            );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
