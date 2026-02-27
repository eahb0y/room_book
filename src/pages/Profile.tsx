import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowLeft, Camera, CheckCircle2, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useI18n } from '@/i18n/useI18n';

const MAX_PROFILE_PHOTO_SIDE = 900;
const MAX_PROFILE_PHOTO_BYTES = 900_000;
const PROFILE_PHOTO_QUALITY = 0.84;

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('Не удалось прочитать файл'));
    };
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
    reader.readAsDataURL(file);
  });

const compressImageDataUrl = (source: string) =>
  new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const longestSide = Math.max(img.width, img.height);
      const scale = longestSide > MAX_PROFILE_PHOTO_SIDE ? MAX_PROFILE_PHOTO_SIDE / longestSide : 1;
      const width = Math.max(1, Math.round(img.width * scale));
      const height = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Не удалось обработать изображение'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', PROFILE_PHOTO_QUALITY));
    };
    img.onerror = () => reject(new Error('Не удалось обработать изображение'));
    img.src = source;
  });

const estimateDataUrlBytes = (dataUrl: string) => {
  const base64 = dataUrl.split(',')[1];
  if (!base64) return 0;
  return Math.ceil((base64.length * 3) / 4);
};

const toInitials = (firstName?: string, lastName?: string, email?: string) => {
  const full = `${firstName ?? ''} ${lastName ?? ''}`.trim();
  if (full) {
    const parts = full.split(/\s+/).filter(Boolean);
    return parts
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }

  if (!email) return 'U';
  return email.charAt(0).toUpperCase();
};

export default function Profile() {
  const { t } = useI18n();
  const { user, updateProfile } = useAuthStore();
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isImageProcessing, setIsImageProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    setFirstName(user?.firstName ?? '');
    setLastName(user?.lastName ?? '');
    setAvatarUrl(user?.avatarUrl ?? null);
    setError('');
    setSuccess('');
  }, [user?.id, user?.firstName, user?.lastName, user?.avatarUrl]);

  const initials = useMemo(
    () => toInitials(firstName.trim(), lastName.trim(), user?.email),
    [firstName, lastName, user?.email],
  );

  if (!user) return null;

  const isSimpleUser = user.role === 'user';

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate('/');
  };

  const handlePhotoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError('');
    setSuccess('');
    setIsImageProcessing(true);

    try {
      if (!file.type.startsWith('image/')) {
        throw new Error('Можно загружать только изображения');
      }

      const rawDataUrl = await readFileAsDataUrl(file);
      const compressedDataUrl = await compressImageDataUrl(rawDataUrl);
      const imageBytes = estimateDataUrlBytes(compressedDataUrl);

      if (imageBytes > MAX_PROFILE_PHOTO_BYTES) {
        throw new Error('Одно из фото слишком большое. Выберите изображение меньшего размера');
      }

      setAvatarUrl(compressedDataUrl);
    } catch (err) {
      const message = err instanceof Error ? t(err.message) : t('Не удалось загрузить фото');
      setError(message);
    } finally {
      setIsImageProcessing(false);
      event.target.value = '';
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setIsSaving(true);

    try {
      const normalizedFirstName = firstName.trim();
      const normalizedLastName = lastName.trim();
      const normalizedCurrentFirstName = user.firstName?.trim() ?? '';
      const normalizedCurrentLastName = user.lastName?.trim() ?? '';

      const payload: {
        firstName?: string;
        lastName?: string;
        avatarUrl?: string | null;
      } = {};

      if (normalizedFirstName !== normalizedCurrentFirstName) {
        payload.firstName = normalizedFirstName;
      }

      if (normalizedLastName !== normalizedCurrentLastName) {
        payload.lastName = normalizedLastName;
      }

      if (avatarUrl !== (user.avatarUrl ?? null)) {
        payload.avatarUrl = avatarUrl;
      }

      await updateProfile(payload);
      setSuccess(t('Профиль обновлён'));
    } catch (err) {
      const message = err instanceof Error ? t(err.message) : t('Произошла ошибка при сохранении');
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const profileSections = (
    <div className="space-y-8">
      <Card id="profile-business" className="border-border/40 scroll-mt-28">
        <CardHeader>
          <CardTitle>{t('Бизнес-профиль')}</CardTitle>
          <CardDescription>{t('Лендинг для добавления бизнеса открывается из профиля')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {t('Нажмите кнопку, чтобы открыть страницу с условиями и подключением бизнеса')}
          </p>
          <Button
            type="button"
            onClick={() => {
              navigate('/business/landing');
            }}
            className="h-11 sm:min-w-56"
          >
            {t('Добавить бизнес')}
          </Button>
        </CardContent>
      </Card>

      <Card id="profile-personal" className="border-border/40 scroll-mt-28">
        <CardHeader>
          <CardTitle>{t('Личные данные')}</CardTitle>
          <CardDescription>{t('Имя, фото и контактный email')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {(error || success) && (
              <Alert
                variant={error ? 'destructive' : 'default'}
                className={!error ? 'border-emerald-700/40 bg-emerald-950/20' : ''}
              >
                {error ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                <AlertDescription className={!error ? 'text-emerald-300' : ''}>
                  {error || success}
                </AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <Avatar className="h-24 w-24 border border-border/50">
                {avatarUrl ? <AvatarImage src={avatarUrl} alt={t('Фото профиля')} /> : null}
                <AvatarFallback className="text-xl">{initials}</AvatarFallback>
              </Avatar>

              <div className="flex flex-wrap gap-2">
                <Label
                  htmlFor="profilePhoto"
                  className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-border/50 px-4 text-sm text-foreground hover:bg-secondary/50"
                >
                  <Camera className="h-4 w-4" />
                  <span>{t('Загрузить фото')}</span>
                </Label>
                <input
                  id="profilePhoto"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoChange}
                  disabled={isImageProcessing || isSaving}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAvatarUrl(null)}
                  disabled={!avatarUrl || isImageProcessing || isSaving}
                >
                  <Trash2 className="h-4 w-4" />
                  <span>{t('Удалить фото')}</span>
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">{t('Имя')}</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  maxLength={100}
                  placeholder={t('Имя')}
                  className="h-11 bg-input/50 border-border/50 focus:border-primary/60 transition-colors"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">{t('Фамилия')}</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  maxLength={100}
                  placeholder={t('Фамилия')}
                  className="h-11 bg-input/50 border-border/50 focus:border-primary/60 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{t('Email')}</Label>
              <Input
                id="email"
                value={user.email}
                readOnly
                disabled
                className="h-11 bg-input/30 border-border/50 text-muted-foreground"
              />
              <p className="text-xs text-muted-foreground">{t('Email нельзя изменить')}</p>
            </div>

            <div className="pt-2">
              <Button type="submit" className="h-11 min-w-44" disabled={isSaving || isImageProcessing}>
                {isSaving ? t('Сохранение…') : t('Сохранить')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

    </div>
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-4xl font-semibold text-foreground tracking-tight">{t('Профиль')}</h1>
          <p className="text-muted-foreground mt-2">{t('Редактируйте персональные данные аккаунта')}</p>
        </div>
        {isSimpleUser ? (
          <Button type="button" variant="outline" onClick={handleBack} className="h-10 w-fit">
            <ArrowLeft className="h-4 w-4" />
            <span>{t('Назад')}</span>
          </Button>
        ) : null}
      </div>

      {profileSections}
    </div>
  );
}
