import type { VenueFloorPlan, VenueTable, VenueTableShape } from '@/types';

type LayoutTableLike = Pick<VenueTable, 'id' | 'xPosition' | 'yPosition' | 'width' | 'height' | 'isActive'>;

export const DEFAULT_TABLE_SIZE_BY_SHAPE: Record<VenueTableShape, { width: number; height: number }> = {
  rectangle: { width: 14, height: 10 },
  circle: { width: 11, height: 11 },
  square: { width: 10, height: 10 },
};

export const clampFloorPlanValue = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const clampTableToFloorPlan = <T extends Pick<VenueTable, 'xPosition' | 'yPosition' | 'width' | 'height'>>(table: T) => ({
  ...table,
  xPosition: clampFloorPlanValue(table.xPosition, 0, 100 - table.width),
  yPosition: clampFloorPlanValue(table.yPosition, 0, 100 - table.height),
});

export const tablesOverlap = (left: LayoutTableLike, right: LayoutTableLike) => (
  left.xPosition < right.xPosition + right.width
  && left.xPosition + left.width > right.xPosition
  && left.yPosition < right.yPosition + right.height
  && left.yPosition + left.height > right.yPosition
);

export const getTableLayoutError = (
  table: Pick<VenueTable, 'id' | 'tableNumber' | 'xPosition' | 'yPosition' | 'width' | 'height' | 'isActive'>,
  tables: VenueTable[],
  ignoreId?: string,
) => {
  if (table.width <= 0 || table.height <= 0) {
    return 'Размер стола должен быть больше нуля';
  }

  if (table.xPosition < 0 || table.yPosition < 0 || table.xPosition + table.width > 100 || table.yPosition + table.height > 100) {
    return 'Стол не должен выходить за границы плана';
  }

  if (!table.isActive) {
    return null;
  }

  const overlappingTable = tables.find((candidate) =>
    candidate.isActive
    && candidate.id !== ignoreId
    && candidate.id !== table.id
    && tablesOverlap(table, candidate),
  );

  if (overlappingTable) {
    return `Стол ${table.tableNumber} пересекается со столом ${overlappingTable.tableNumber}`;
  }

  return null;
};

export const getFloorPlanStats = (floorPlan: VenueFloorPlan) => ({
  tablesCount: floorPlan.tables.length,
  capacity: floorPlan.tables.reduce((sum, table) => sum + table.capacity, 0),
});

export const addMinutesToTime = (value: string, minutesToAdd: number) => {
  const [hoursPart, minutesPart] = value.split(':').map((part) => Number.parseInt(part, 10));
  const totalMinutes = ((Number.isFinite(hoursPart) ? hoursPart : 0) * 60) + (Number.isFinite(minutesPart) ? minutesPart : 0) + minutesToAdd;
  const normalizedMinutes = Math.max(totalMinutes, 0);
  const hours = Math.floor(normalizedMinutes / 60).toString().padStart(2, '0');
  const minutes = (normalizedMinutes % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};
