import { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Move, Pencil, Plus, Printer, RotateCcw, Save, Trash2, X, ZoomIn, ZoomOut } from 'lucide-react';
import './floor-plan.css';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DEFAULT_TABLE_SIZE_BY_SHAPE, clampTableToFloorPlan, getFloorPlanStats, getTableLayoutError } from '@/lib/floorPlanLayout';
import { cn } from '@/lib/utils';
import type { VenueFloorPlan, VenueTable, VenueTableShape } from '@/types';

type TableDraft = {
  tableNumber: string;
  capacity: string;
  shape: VenueTableShape;
  notes: string;
  width: string;
  height: string;
  xPosition: number;
  yPosition: number;
  isActive: boolean;
};

type UndoAction =
  | { type: 'create'; table: VenueTable }
  | { type: 'update'; before: VenueTable }
  | { type: 'delete'; table: VenueTable };

const buildDraftFromTable = (table?: VenueTable, position?: { xPosition: number; yPosition: number }): TableDraft => {
  if (table) {
    return {
      tableNumber: table.tableNumber,
      capacity: table.capacity.toString(),
      shape: table.shape,
      notes: table.notes,
      width: table.width.toString(),
      height: table.height.toString(),
      xPosition: table.xPosition,
      yPosition: table.yPosition,
      isActive: table.isActive,
    };
  }

  return {
    tableNumber: '',
    capacity: '4',
    shape: 'rectangle',
    notes: '',
    width: DEFAULT_TABLE_SIZE_BY_SHAPE.rectangle.width.toString(),
    height: DEFAULT_TABLE_SIZE_BY_SHAPE.rectangle.height.toString(),
    xPosition: position?.xPosition ?? 10,
    yPosition: position?.yPosition ?? 10,
    isActive: true,
  };
};

function TableFormPanel({
  mode,
  initialDraft,
  tables,
  editingTableId,
  onSubmit,
  onCancel,
}: {
  mode: 'create' | 'edit';
  initialDraft: TableDraft;
  tables: VenueTable[];
  editingTableId?: string;
  onSubmit: (payload: {
    tableNumber: string;
    capacity: number;
    shape: VenueTableShape;
    notes: string;
    width: number;
    height: number;
    xPosition: number;
    yPosition: number;
    isActive: boolean;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<TableDraft>(initialDraft);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setDraft(initialDraft);
    setError('');
    setIsSaving(false);
  }, [initialDraft]);

  const handleShapeChange = (shape: VenueTableShape) => {
    const defaults = DEFAULT_TABLE_SIZE_BY_SHAPE[shape];
    setDraft((current) => ({
      ...current,
      shape,
      width: defaults.width.toString(),
      height: defaults.height.toString(),
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    const capacity = Number.parseInt(draft.capacity, 10);
    const width = Number.parseFloat(draft.width);
    const height = Number.parseFloat(draft.height);
    const normalized = clampTableToFloorPlan({
      xPosition: draft.xPosition,
      yPosition: draft.yPosition,
      width: Number.isFinite(width) ? width : 0,
      height: Number.isFinite(height) ? height : 0,
    });

    const nextTable: VenueTable = {
      id: editingTableId ?? 'draft',
      floorPlanId: '',
      tableNumber: draft.tableNumber.trim(),
      capacity,
      xPosition: normalized.xPosition,
      yPosition: normalized.yPosition,
      width: normalized.width,
      height: normalized.height,
      shape: draft.shape,
      notes: draft.notes.trim(),
      isActive: draft.isActive,
      createdAt: '',
      updatedAt: '',
    };

    if (!nextTable.tableNumber) {
      setError('Укажите номер стола');
      return;
    }

    if (!Number.isFinite(capacity) || capacity < 1) {
      setError('Вместимость должна быть больше нуля');
      return;
    }

    const duplicate = tables.find((table) =>
      table.id !== editingTableId
      && table.tableNumber.trim().toLowerCase() === nextTable.tableNumber.trim().toLowerCase(),
    );

    if (duplicate) {
      setError(`Номер стола ${nextTable.tableNumber} уже используется`);
      return;
    }

    const layoutError = getTableLayoutError(nextTable, tables, editingTableId);
    if (layoutError) {
      setError(layoutError);
      return;
    }

    try {
      setIsSaving(true);
      await onSubmit({
        tableNumber: nextTable.tableNumber,
        capacity: nextTable.capacity,
        shape: nextTable.shape,
        notes: nextTable.notes,
        width: nextTable.width,
        height: nextTable.height,
        xPosition: nextTable.xPosition,
        yPosition: nextTable.yPosition,
        isActive: nextTable.isActive,
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Не удалось сохранить стол');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-base font-semibold text-foreground">
            {mode === 'create' ? 'Новый стол' : 'Редактирование стола'}
          </p>
          <p className="text-sm text-muted-foreground">
            Заполните параметры справа и сохраните без всплывающего окна.
          </p>
        </div>
        <Button type="button" variant="ghost" size="icon" className="rounded-xl" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error ? (
          <Alert variant="destructive" className="rounded-2xl border-destructive/25 bg-destructive/[0.04]">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="table-number">Номер стола</Label>
            <Input
              id="table-number"
              value={draft.tableNumber}
              onChange={(event) => setDraft((current) => ({ ...current, tableNumber: event.target.value }))}
              placeholder="Например, A1"
              className="rounded-2xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="table-capacity">Вместимость</Label>
            <Input
              id="table-capacity"
              type="number"
              min={1}
              value={draft.capacity}
              onChange={(event) => setDraft((current) => ({ ...current, capacity: event.target.value }))}
              className="rounded-2xl"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Форма</Label>
            <Select value={draft.shape} onValueChange={(value) => handleShapeChange(value as VenueTableShape)}>
              <SelectTrigger className="rounded-2xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rectangle">Прямоугольный</SelectItem>
                <SelectItem value="circle">Круглый</SelectItem>
                <SelectItem value="square">Квадратный</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Статус</Label>
            <Select
              value={draft.isActive ? 'active' : 'inactive'}
              onValueChange={(value) => setDraft((current) => ({ ...current, isActive: value === 'active' }))}
            >
              <SelectTrigger className="rounded-2xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Активный</SelectItem>
                <SelectItem value="inactive">Скрыт для клиентов</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="table-width">Ширина, %</Label>
            <Input
              id="table-width"
              type="number"
              min={4}
              max={100}
              step="0.5"
              value={draft.width}
              onChange={(event) => setDraft((current) => ({ ...current, width: event.target.value }))}
              className="rounded-2xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="table-height">Высота, %</Label>
            <Input
              id="table-height"
              type="number"
              min={4}
              max={100}
              step="0.5"
              value={draft.height}
              onChange={(event) => setDraft((current) => ({ ...current, height: event.target.value }))}
              className="rounded-2xl"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="table-notes">Заметки</Label>
          <Textarea
            id="table-notes"
            value={draft.notes}
            onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
            placeholder="У окна, VIP, рядом с баром"
            rows={3}
            className="rounded-2xl"
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button type="submit" disabled={isSaving} className="h-11 rounded-2xl px-5 sm:min-w-[210px]">
            {isSaving ? 'Сохраняю...' : mode === 'create' ? 'Добавить стол' : 'Сохранить стол'}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel} className="h-11 rounded-2xl px-5">
            Отмена
          </Button>
        </div>
      </form>
    </div>
  );
}

export function FloorPlanEditor({
  floorPlan,
  onSavePlanName,
  onCreateTable,
  onUpdateTable,
  onDeleteTable,
}: {
  floorPlan: VenueFloorPlan | null;
  onSavePlanName: (floorPlanId: string, name: string) => Promise<void>;
  onCreateTable: (payload: {
    floorPlanId: string;
    tableNumber: string;
    capacity: number;
    xPosition: number;
    yPosition: number;
    width: number;
    height: number;
    shape: VenueTableShape;
    notes: string;
    isActive: boolean;
    id?: string;
  }) => Promise<VenueTable>;
  onUpdateTable: (
    tableId: string,
    payload: Partial<Pick<VenueTable, 'tableNumber' | 'capacity' | 'xPosition' | 'yPosition' | 'width' | 'height' | 'shape' | 'notes' | 'isActive'>>,
  ) => Promise<VenueTable>;
  onDeleteTable: (tableId: string) => Promise<void>;
}) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    tableId: string;
    originX: number;
    originY: number;
    pointerId: number;
  } | null>(null);

  const [planName, setPlanName] = useState('');
  const [localTables, setLocalTables] = useState<VenueTable[]>([]);
  const [selectedTableId, setSelectedTableId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSavingPlanName, setIsSavingPlanName] = useState(false);
  const [isTableEditorOpen, setIsTableEditorOpen] = useState(false);
  const [tableDialogMode, setTableDialogMode] = useState<'create' | 'edit'>('create');
  const [tableDialogDraft, setTableDialogDraft] = useState<TableDraft>(buildDraftFromTable());
  const [tableEditorTableId, setTableEditorTableId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [isAddTableMode, setIsAddTableMode] = useState(false);
  const [history, setHistory] = useState<UndoAction[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<VenueTable | null>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    setPlanName(floorPlan?.name ?? '');
    setLocalTables(floorPlan?.tables ?? []);
    setSelectedTableId((current) => {
      if (!floorPlan) return '';
      return current && floorPlan.tables.some((table) => table.id === current) ? current : floorPlan.tables[0]?.id ?? '';
    });
    setError('');
    setSuccess('');
    setIsAddTableMode(false);
    setIsTableEditorOpen(false);
    setTableEditorTableId(null);
    setDeleteTarget(null);
  }, [floorPlan]);

  const selectedTable = useMemo(
    () => localTables.find((table) => table.id === selectedTableId) ?? null,
    [localTables, selectedTableId],
  );

  const stats = useMemo(() => (floorPlan ? getFloorPlanStats({ ...floorPlan, tables: localTables }) : null), [floorPlan, localTables]);
  const hasUnsavedPlanName = floorPlan ? planName.trim() !== floorPlan.name.trim() : false;
  const toolbarButtonClassName = 'h-11 w-full justify-start rounded-2xl border-border/55 bg-background/80 px-4 text-sm font-medium shadow-none hover:bg-accent/70';
  const primaryToolbarButtonClassName = 'h-11 w-full justify-start rounded-2xl px-4 text-sm font-medium shadow-[0_18px_34px_-26px_hsl(var(--primary)/0.7)]';

  const updateLocalTable = (tableId: string, updater: (table: VenueTable) => VenueTable) => {
    setLocalTables((current) => current.map((table) => (table.id === tableId ? updater(table) : table)));
  };

  const openCreateDialog = (position: { xPosition: number; yPosition: number }) => {
    setTableDialogMode('create');
    setTableDialogDraft(buildDraftFromTable(undefined, position));
    setTableEditorTableId(null);
    setDeleteTarget(null);
    setIsTableEditorOpen(true);
  };

  const openEditDialog = (table: VenueTable) => {
    setTableDialogMode('edit');
    setTableDialogDraft(buildDraftFromTable(table));
    setSelectedTableId(table.id);
    setTableEditorTableId(table.id);
    setDeleteTarget(null);
    setIsTableEditorOpen(true);
  };

  const resetMessages = () => {
    setError('');
    setSuccess('');
  };

  const closeTableEditor = () => {
    setIsTableEditorOpen(false);
    setTableEditorTableId(null);
  };

  const handleStageClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!floorPlan || !isAddTableMode || previewMode) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const defaults = DEFAULT_TABLE_SIZE_BY_SHAPE.rectangle;
    const xPosition = ((event.clientX - rect.left) / rect.width) * 100 - defaults.width / 2;
    const yPosition = ((event.clientY - rect.top) / rect.height) * 100 - defaults.height / 2;

    openCreateDialog(clampTableToFloorPlan({
      xPosition,
      yPosition,
      width: defaults.width,
      height: defaults.height,
    }));
  };

  const persistDraggedTable = async (tableId: string, nextX: number, nextY: number) => {
    const before = floorPlan?.tables.find((table) => table.id === tableId) ?? localTables.find((table) => table.id === tableId);
    const current = localTables.find((table) => table.id === tableId);
    if (!before || !current) return;

    const candidate = { ...current, xPosition: nextX, yPosition: nextY };
    const layoutError = getTableLayoutError(candidate, localTables, tableId);
    if (layoutError) {
      setError(layoutError);
      setLocalTables(floorPlan?.tables ?? []);
      return;
    }

    try {
      const saved = await onUpdateTable(tableId, {
        xPosition: candidate.xPosition,
        yPosition: candidate.yPosition,
      });
      setHistory((currentHistory) => [...currentHistory, { type: 'update', before }]);
      setSuccess(`Позиция стола ${saved.tableNumber} сохранена`);
      setError('');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Не удалось сохранить позицию стола');
      setLocalTables(floorPlan?.tables ?? []);
    }
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>, table: VenueTable) => {
    const activeDrag = dragRef.current;
    if (!activeDrag || activeDrag.tableId !== table.id || !viewportRef.current) return;

    const rect = viewportRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const xPosition = ((event.clientX - rect.left) / rect.width) * 100 - table.width / 2;
    const yPosition = ((event.clientY - rect.top) / rect.height) * 100 - table.height / 2;
    const normalized = clampTableToFloorPlan({
      xPosition,
      yPosition,
      width: table.width,
      height: table.height,
    });

    startTransition(() => {
      updateLocalTable(table.id, (current) => ({
        ...current,
        xPosition: normalized.xPosition,
        yPosition: normalized.yPosition,
      }));
    });
  };

  const handlePointerUp = async (table: VenueTable, event?: React.PointerEvent<HTMLButtonElement>) => {
    if (event && dragRef.current?.pointerId === event.pointerId) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const activeDrag = dragRef.current;
    if (!activeDrag || activeDrag.tableId !== table.id) return;
    dragRef.current = null;

    const updatedTable = localTables.find((item) => item.id === table.id);
    if (!updatedTable) return;

    const hasMoved = updatedTable.xPosition !== activeDrag.originX || updatedTable.yPosition !== activeDrag.originY;
    if (!hasMoved) return;

    await persistDraggedTable(table.id, updatedTable.xPosition, updatedTable.yPosition);
  };

  const handleUndo = async () => {
    const lastAction = history[history.length - 1];
    if (!lastAction || !floorPlan) return;

    setHistory((current) => current.slice(0, -1));
    resetMessages();

    try {
      if (lastAction.type === 'create') {
        await onDeleteTable(lastAction.table.id);
        setSelectedTableId((current) => (current === lastAction.table.id ? '' : current));
        setSuccess(`Стол ${lastAction.table.tableNumber} удалён`);
        return;
      }

      if (lastAction.type === 'update') {
        await onUpdateTable(lastAction.before.id, {
          tableNumber: lastAction.before.tableNumber,
          capacity: lastAction.before.capacity,
          xPosition: lastAction.before.xPosition,
          yPosition: lastAction.before.yPosition,
          width: lastAction.before.width,
          height: lastAction.before.height,
          shape: lastAction.before.shape,
          notes: lastAction.before.notes,
          isActive: lastAction.before.isActive,
        });
        setSuccess(`Стол ${lastAction.before.tableNumber} возвращён к предыдущему состоянию`);
        return;
      }

      await onCreateTable({
        id: lastAction.table.id,
        floorPlanId: lastAction.table.floorPlanId,
        tableNumber: lastAction.table.tableNumber,
        capacity: lastAction.table.capacity,
        xPosition: lastAction.table.xPosition,
        yPosition: lastAction.table.yPosition,
        width: lastAction.table.width,
        height: lastAction.table.height,
        shape: lastAction.table.shape,
        notes: lastAction.table.notes,
        isActive: lastAction.table.isActive,
      });
      setSelectedTableId(lastAction.table.id);
      setSuccess(`Стол ${lastAction.table.tableNumber} восстановлен`);
    } catch (undoError) {
      setError(undoError instanceof Error ? undoError.message : 'Не удалось отменить последнее действие');
    }
  };

  const handleSubmitTableDialog = async (payload: {
    tableNumber: string;
    capacity: number;
    shape: VenueTableShape;
    notes: string;
    width: number;
    height: number;
    xPosition: number;
    yPosition: number;
    isActive: boolean;
  }) => {
    if (!floorPlan) return;

    resetMessages();

    if (tableDialogMode === 'create') {
      const created = await onCreateTable({
        floorPlanId: floorPlan.id,
        tableNumber: payload.tableNumber,
        capacity: payload.capacity,
        xPosition: payload.xPosition,
        yPosition: payload.yPosition,
        width: payload.width,
        height: payload.height,
        shape: payload.shape,
        notes: payload.notes,
        isActive: payload.isActive,
      });
      setHistory((current) => [...current, { type: 'create', table: created }]);
      setSelectedTableId(created.id);
      setIsAddTableMode(false);
      closeTableEditor();
      setSuccess(`Стол ${created.tableNumber} добавлен на план`);
      return;
    }

    const tableToEdit = localTables.find((table) => table.id === tableEditorTableId) ?? null;
    if (!tableToEdit) {
      throw new Error('Выберите стол для редактирования');
    }

    const updated = await onUpdateTable(tableToEdit.id, payload);
    setHistory((current) => [...current, { type: 'update', before: tableToEdit }]);
    setSelectedTableId(updated.id);
    closeTableEditor();
    setSuccess(`Стол ${updated.tableNumber} обновлён`);
  };

  const handleDeleteTable = async () => {
    if (!deleteTarget) return;

    resetMessages();

    try {
      await onDeleteTable(deleteTarget.id);
      setHistory((current) => [...current, { type: 'delete', table: deleteTarget }]);
      setSelectedTableId((current) => (current === deleteTarget.id ? '' : current));
      if (tableEditorTableId === deleteTarget.id) {
        closeTableEditor();
      }
      setDeleteTarget(null);
      setSuccess(`Стол ${deleteTarget.tableNumber} удалён`);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Не удалось удалить стол');
    }
  };

  const handleSavePlanName = async () => {
    if (!floorPlan) return;
    if (!planName.trim()) {
      setError('Название плана не может быть пустым');
      return;
    }

    try {
      setIsSavingPlanName(true);
      await onSavePlanName(floorPlan.id, planName.trim());
      setSuccess('Название плана сохранено');
      setError('');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Не удалось сохранить название плана');
    } finally {
      setIsSavingPlanName(false);
    }
  };

  if (!floorPlan) {
    return (
      <Card className="border-border/40">
        <CardContent className="py-16 text-center">
          <p className="text-base font-medium text-foreground">Выберите или загрузите план, чтобы начать расстановку столов.</p>
          <p className="mt-2 text-sm text-muted-foreground">После загрузки изображения здесь появится интерактивный редактор.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {(error || success) ? (
        <div className="space-y-2">
          {error ? (
            <Alert variant="destructive" className="rounded-2xl border-destructive/25 bg-destructive/[0.04]">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {success ? (
            <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/[0.06] px-4 py-3 text-sm text-foreground">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div>{success}</div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="border-border/40">
          <CardHeader className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{stats?.tablesCount ?? 0} столов</Badge>
              <Badge variant="outline">Вместимость {stats?.capacity ?? 0}</Badge>
              <Badge variant="outline">{floorPlan.width} x {floorPlan.height}px</Badge>
            </div>

            <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-4">
                <div className="space-y-3">
                  <Label htmlFor="floor-plan-name">Название плана</Label>
                  <Input
                    id="floor-plan-name"
                    value={planName}
                    onChange={(event) => setPlanName(event.target.value)}
                    placeholder="Основной зал"
                    className="h-12 w-full rounded-2xl"
                  />
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                  <Button
                    onClick={handleSavePlanName}
                    disabled={!hasUnsavedPlanName || isSavingPlanName}
                    className="h-12 rounded-2xl px-5 sm:min-w-[240px]"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {isSavingPlanName ? 'Сохраняю...' : 'Сохранить изменения'}
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Название сохраняется отдельно от позиций столов.
                  </span>
                </div>

                <div className="rounded-[1.75rem] border border-border/50 bg-muted/10 px-5 py-4 text-sm text-muted-foreground">
                  {previewMode
                    ? 'Предпросмотр показывает, как клиент увидит схему и доступные точки.'
                    : isAddTableMode
                      ? 'Кликните по плану, чтобы добавить новый стол в выбранную точку.'
                      : 'Перетаскивайте столы мышкой. Новая позиция сохраняется после отпускания.'}
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-border/50 bg-muted/10 p-3">
                <div className="grid gap-3">
                  <Button
                    type="button"
                    variant={isAddTableMode ? 'default' : 'outline'}
                    className={isAddTableMode ? primaryToolbarButtonClassName : toolbarButtonClassName}
                    onClick={() => {
                      resetMessages();
                      setIsAddTableMode((current) => !current);
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    {isAddTableMode ? 'Режим добавления включён' : 'Добавить стол'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className={toolbarButtonClassName}
                    onClick={() => setPreviewMode((current) => !current)}
                  >
                    {previewMode ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
                    {previewMode ? 'Вернуться в редактор' : 'Предпросмотр'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className={toolbarButtonClassName}
                    onClick={handleUndo}
                    disabled={history.length === 0}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Отменить изменение
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className={toolbarButtonClassName}
                    onClick={() => window.print()}
                  >
                    <Printer className="mr-2 h-4 w-4" />
                    Экспорт в PDF
                  </Button>
                </div>
                <div className="mt-3 px-1 text-xs text-muted-foreground">
                  Быстрые действия для редактирования и проверки клиентского режима.
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-2xl border border-border/50 bg-muted/10 px-4 py-3 text-sm text-muted-foreground">
              <span>Масштаб плана</span>
              <div className="flex items-center gap-2">
                <Button type="button" size="icon" variant="ghost" onClick={() => setZoom((current) => Math.max(0.8, current - 0.1))}>
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="w-14 text-center text-xs text-foreground">{Math.round(zoom * 100)}%</span>
                <Button type="button" size="icon" variant="ghost" onClick={() => setZoom((current) => Math.min(2.2, current + 0.1))}>
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="floor-plan-shell">
              <div className="floor-plan-scroll">
                <div
                  ref={viewportRef}
                  className="floor-plan-viewport"
                  style={{
                    width: '100%',
                    transform: `scale(${zoom})`,
                  }}
                >
                  <div
                    className="relative"
                    style={{ aspectRatio: `${floorPlan.width} / ${floorPlan.height}` }}
                    onClick={handleStageClick}
                  >
                    <img src={floorPlan.imagePath} alt={floorPlan.name} className="floor-plan-image" />
                    <div className="floor-plan-grid" />

                    {localTables.map((table) => {
                      const isSelected = table.id === selectedTableId;
                      const isDragging = dragRef.current?.tableId === table.id;
                      const tableStatusClass = previewMode
                        ? table.isActive ? 'floor-plan-table--available' : 'floor-plan-table--inactive'
                        : 'floor-plan-table--admin';

                      return (
                        <button
                          key={table.id}
                          type="button"
                          className={cn(
                            'floor-plan-table',
                            `floor-plan-table--${table.shape}`,
                            tableStatusClass,
                            isSelected && 'floor-plan-table--selected',
                            isDragging && 'floor-plan-table--dragging',
                            !table.isActive && 'floor-plan-table--inactive',
                          )}
                          style={{
                            left: `${table.xPosition}%`,
                            top: `${table.yPosition}%`,
                            width: `${table.width}%`,
                            height: `${table.height}%`,
                            zIndex: isSelected ? 20 : 10,
                          }}
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedTableId(table.id);
                            if (previewMode) {
                              return;
                            }
                          }}
                          onDoubleClick={(event) => {
                            event.stopPropagation();
                            if (!previewMode) {
                              openEditDialog(table);
                            }
                          }}
                          onPointerDown={(event) => {
                            event.stopPropagation();
                            setSelectedTableId(table.id);
                            if (previewMode) return;
                            dragRef.current = {
                              tableId: table.id,
                              originX: table.xPosition,
                              originY: table.yPosition,
                              pointerId: event.pointerId,
                            };
                            event.currentTarget.setPointerCapture(event.pointerId);
                          }}
                          onPointerMove={(event) => {
                            if (!previewMode) {
                              handlePointerMove(event, table);
                            }
                          }}
                          onPointerUp={(event) => {
                            if (!previewMode) {
                              void handlePointerUp(table, event);
                            }
                          }}
                        >
                          <span className="floor-plan-table__number">{table.tableNumber}</span>
                          <span className="floor-plan-table__capacity">{table.capacity} мест</span>
                          {table.notes ? <span className="floor-plan-table__notes">{table.notes}</span> : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-border/40">
            <CardHeader>
              <CardTitle>{isTableEditorOpen ? 'Параметры стола' : 'Текущий выбор'}</CardTitle>
              <CardDescription>
                {isTableEditorOpen
                  ? 'Редактирование открывается прямо в правой колонке, без модального окна.'
                  : 'Нажмите на стол в списке или на плане, чтобы посмотреть детали и изменить его.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isTableEditorOpen ? (
                <TableFormPanel
                  mode={tableDialogMode}
                  initialDraft={tableDialogDraft}
                  tables={localTables}
                  editingTableId={tableDialogMode === 'edit' ? tableEditorTableId ?? undefined : undefined}
                  onCancel={closeTableEditor}
                  onSubmit={handleSubmitTableDialog}
                />
              ) : selectedTable ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-border/50 bg-card/60 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold text-foreground">Стол {selectedTable.tableNumber}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{selectedTable.capacity} мест</p>
                      </div>
                      <Badge variant={selectedTable.isActive ? 'default' : 'outline'}>
                        {selectedTable.isActive ? 'Активный' : 'Скрыт'}
                      </Badge>
                    </div>
                    <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                      <p>Форма: {selectedTable.shape === 'rectangle' ? 'прямоугольный' : selectedTable.shape === 'circle' ? 'круглый' : 'квадратный'}</p>
                      <p>Координаты: {selectedTable.xPosition.toFixed(1)}% / {selectedTable.yPosition.toFixed(1)}%</p>
                      <p>Размер: {selectedTable.width.toFixed(1)}% x {selectedTable.height.toFixed(1)}%</p>
                      {selectedTable.notes ? <p>Заметки: {selectedTable.notes}</p> : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button type="button" onClick={() => openEditDialog(selectedTable)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Редактировать
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setDeleteTarget(selectedTable)} className="rounded-2xl">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Удалить
                    </Button>
                  </div>

                  {deleteTarget?.id === selectedTable.id ? (
                    <div className="rounded-2xl border border-destructive/20 bg-destructive/[0.04] p-4">
                      <p className="text-sm font-medium text-foreground">
                        Удалить стол {selectedTable.tableNumber}?
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Стол исчезнет с плана. Последнее удаление можно отменить через Undo.
                      </p>
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <Button type="button" variant="destructive" className="rounded-2xl" onClick={() => void handleDeleteTable()}>
                          Подтвердить удаление
                        </Button>
                        <Button type="button" variant="outline" className="rounded-2xl" onClick={() => setDeleteTarget(null)}>
                          Оставить стол
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border/55 px-4 py-10 text-center text-sm text-muted-foreground">
                  Выберите стол на плане, чтобы посмотреть детали.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/40">
            <CardHeader>
              <CardTitle>Все столы</CardTitle>
              <CardDescription>Список помогает быстро переключаться между объектами на плане.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {localTables.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/55 px-4 py-8 text-center text-sm text-muted-foreground">
                  На этом плане пока нет столов.
                </div>
              ) : localTables.map((table) => (
                <button
                  key={table.id}
                  type="button"
                  onClick={() => setSelectedTableId(table.id)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-2xl border px-3 py-3 text-left transition-colors',
                    table.id === selectedTableId
                      ? 'border-primary/50 bg-primary/[0.08]'
                      : 'border-border/45 bg-card/50 hover:border-border/70 hover:bg-card/75',
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">Стол {table.tableNumber}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{table.capacity} мест</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Move className="h-3.5 w-3.5" />
                    {table.xPosition.toFixed(0)} / {table.yPosition.toFixed(0)}
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

    </div>
  );
}
