import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Building2, CheckCircle2, FolderPlus, UploadCloud, X } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useVenueStore } from '@/store/venueStore';
import { useVenueDataGuard } from '@/hooks/useVenueDataGuard';
import { canManageBusinessResources, getAccessibleBusinessVenues, isBusinessPortalActive } from '@/lib/businessAccess';
import { validateFloorPlanImageFile } from '@/lib/floorPlanApi';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FloorPlanEditor } from '@/components/floor-plans/FloorPlanEditor';
import { FloorPlanList } from '@/components/floor-plans/FloorPlanList';
import '@/components/floor-plans/floor-plan.css';

export default function FloorPlanManagement() {
  const navigate = useNavigate();
  const { user, portal } = useAuthStore();
  const { isVenueDataLoading } = useVenueDataGuard(user, 'admin');
  const venues = useVenueStore((state) => state.venues);
  const floorPlans = useVenueStore((state) => state.floorPlans);
  const createFloorPlan = useVenueStore((state) => state.createFloorPlan);
  const updateFloorPlan = useVenueStore((state) => state.updateFloorPlan);
  const createFloorTable = useVenueStore((state) => state.createFloorTable);
  const updateFloorTable = useVenueStore((state) => state.updateFloorTable);
  const deleteFloorTable = useVenueStore((state) => state.deleteFloorTable);

  const dropInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedVenueId, setSelectedVenueId] = useState('');
  const [selectedFloorPlanId, setSelectedFloorPlanId] = useState('');
  const [isUploadPanelOpen, setIsUploadPanelOpen] = useState(true);
  const [floorPlanName, setFloorPlanName] = useState('');
  const [floorPlanFile, setFloorPlanFile] = useState<File | null>(null);
  const [isDropActive, setIsDropActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const isBusinessPortal = isBusinessPortalActive(user, portal);
  const accessibleVenues = useMemo(() => getAccessibleBusinessVenues(user, venues), [user, venues]);
  const canManageFloorPlans = canManageBusinessResources(user);
  const venueFloorPlans = useMemo(
    () => floorPlans.filter((floorPlan) => floorPlan.venueId === selectedVenueId),
    [floorPlans, selectedVenueId],
  );
  const selectedFloorPlan = useMemo(
    () => venueFloorPlans.find((floorPlan) => floorPlan.id === selectedFloorPlanId) ?? venueFloorPlans[0] ?? null,
    [selectedFloorPlanId, venueFloorPlans],
  );
  const showUploadPanel = isUploadPanelOpen || venueFloorPlans.length === 0;

  useEffect(() => {
    if (!user || !isBusinessPortal) {
      navigate('/');
      return;
    }
  }, [isBusinessPortal, navigate, user]);

  useEffect(() => {
    if (accessibleVenues.length === 0) {
      setSelectedVenueId('');
      return;
    }

    setSelectedVenueId((current) =>
      current && accessibleVenues.some((venue) => venue.id === current) ? current : accessibleVenues[0]?.id ?? '',
    );
  }, [accessibleVenues]);

  useEffect(() => {
    if (venueFloorPlans.length === 0) {
      setSelectedFloorPlanId('');
      setIsUploadPanelOpen(true);
      return;
    }

    setSelectedFloorPlanId((current) =>
      current && venueFloorPlans.some((floorPlan) => floorPlan.id === current) ? current : venueFloorPlans[0]?.id ?? '',
    );
  }, [venueFloorPlans]);

  const resetUploadDialog = () => {
    setFloorPlanName('');
    setFloorPlanFile(null);
    setIsDropActive(false);
    setError('');
  };

  const openUploadDialog = () => {
    resetUploadDialog();
    setSuccess('');
    setIsUploadPanelOpen(true);
  };

  const handleFileSelection = (file: File | null) => {
    if (!file) return;

    try {
      validateFloorPlanImageFile(file);
      setFloorPlanFile(file);
      if (!floorPlanName.trim()) {
        setFloorPlanName(file.name.replace(/\.[a-z0-9]+$/i, ''));
      }
      setError('');
    } catch (fileError) {
      setError(fileError instanceof Error ? fileError.message : 'Не удалось прочитать изображение');
      setFloorPlanFile(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedVenueId) {
      setError('Сначала выберите заведение');
      return;
    }

    if (!floorPlanName.trim()) {
      setError('Введите название плана');
      return;
    }

    if (!floorPlanFile) {
      setError('Выберите изображение плана');
      return;
    }

    try {
      setIsUploading(true);
      const created = await createFloorPlan({
        venueId: selectedVenueId,
        name: floorPlanName.trim(),
        file: floorPlanFile,
      });
      setSelectedFloorPlanId(created.id);
      setSuccess(`План «${created.name}» загружен`);
      setIsUploadPanelOpen(false);
      resetUploadDialog();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Не удалось загрузить план');
    } finally {
      setIsUploading(false);
    }
  };

  if (accessibleVenues.length === 0 && !isVenueDataLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-foreground">Планы заведений</h1>
          <p className="mt-2 text-muted-foreground">Сначала создайте заведение, а затем загрузите для него схему зала.</p>
        </div>

        <Card className="border-border/40">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Building2 className="h-10 w-10 text-muted-foreground/35" />
            <p className="mt-4 text-lg font-medium text-foreground">Пока нет доступных заведений</p>
            <p className="mt-2 max-w-lg text-sm text-muted-foreground">
              Раздел планов использует существующие заведения. Сначала создайте бизнес-точку, потом вернитесь сюда для загрузки схемы.
            </p>
            <Button className="mt-6" onClick={() => navigate('/my-venues')}>
              Перейти к заведению
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-foreground">Планы заведений</h1>
          <p className="mt-2 text-muted-foreground">
            Загружайте схемы залов, расставляйте столы и сразу проверяйте клиентский сценарий выбора места.
          </p>
        </div>

        <Card className="border-border/40">
          <CardContent className="flex flex-col gap-4 py-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <Label htmlFor="venue-floor-plan-select">Заведение</Label>
              <div className="w-full sm:w-[320px]">
                <Select value={selectedVenueId} onValueChange={setSelectedVenueId}>
                  <SelectTrigger id="venue-floor-plan-select">
                    <SelectValue placeholder="Выберите заведение" />
                  </SelectTrigger>
                  <SelectContent>
                    {accessibleVenues.map((venue) => (
                      <SelectItem key={venue.id} value={venue.id}>
                        {venue.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {canManageFloorPlans ? (
              <div className="flex flex-wrap gap-3">
                <Button onClick={openUploadDialog} disabled={!selectedVenueId}>
                  <FolderPlus className="mr-2 h-4 w-4" />
                  Добавить новый план
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

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

      {showUploadPanel ? (
        <Card className="border-border/40">
          <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <CardTitle>Загрузка нового плана</CardTitle>
              <CardDescription>Сначала загружается схема зала, потом на неё ставятся столы.</CardDescription>
            </div>
            {venueFloorPlans.length > 0 ? (
              <Button type="button" variant="ghost" onClick={() => setIsUploadPanelOpen(false)}>
                <X className="mr-2 h-4 w-4" />
                Скрыть блок загрузки
              </Button>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="new-floor-plan-name">Название плана</Label>
              <Input
                id="new-floor-plan-name"
                value={floorPlanName}
                onChange={(event) => setFloorPlanName(event.target.value)}
                placeholder="Основной зал"
              />
            </div>

            <button
              type="button"
              className="floor-plan-dropzone flex w-full flex-col items-center justify-center gap-3 px-6 py-14 text-center"
              data-active={isDropActive}
              onClick={() => dropInputRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDropActive(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                setIsDropActive(false);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setIsDropActive(false);
                handleFileSelection(event.dataTransfer.files[0] ?? null);
              }}
            >
              <UploadCloud className="h-10 w-10 text-primary" />
              <div>
                <p className="text-base font-medium text-foreground">Перетащите изображение сюда</p>
                <p className="mt-1 text-sm text-muted-foreground">или нажмите, чтобы выбрать файл с компьютера</p>
              </div>
              {floorPlanFile ? (
                <div className="rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs text-muted-foreground">
                  {floorPlanFile.name}
                </div>
              ) : null}
              <input
                ref={dropInputRef}
                type="file"
                accept="image/jpeg,image/png"
                className="hidden"
                onChange={(event) => handleFileSelection(event.target.files?.[0] ?? null)}
              />
            </button>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-muted-foreground">
                {floorPlanFile
                  ? `Файл выбран: ${floorPlanFile.name}`
                  : 'Выберите изображение плана, затем нажмите «Создать план».'
                }
              </div>
              <Button type="button" onClick={() => void handleUpload()} disabled={isUploading}>
              {isUploading ? 'Загружаю...' : 'Создать план'}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {venueFloorPlans.length > 0 ? (
        <>
          <FloorPlanList
            floorPlans={venueFloorPlans}
            selectedFloorPlanId={selectedFloorPlan?.id ?? ''}
            onSelect={setSelectedFloorPlanId}
            showAddButton={false}
            isBusy={!canManageFloorPlans}
          />

          <FloorPlanEditor
            floorPlan={selectedFloorPlan}
            onSavePlanName={async (floorPlanId, name) => {
              await updateFloorPlan(floorPlanId, { name });
            }}
            onCreateTable={createFloorTable}
            onUpdateTable={updateFloorTable}
            onDeleteTable={deleteFloorTable}
          />
        </>
      ) : null}
    </div>
  );
}
