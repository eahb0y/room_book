import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Camera, CheckCircle2, Trash2 } from 'lucide-react';
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
  const { user, updateProfile, changePassword } = useAuthStore();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isImageProcessing, setIsImageProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  useEffect(() => {
    setFirstName(user?.firstName ?? '');
    setLastName(user?.lastName ?? '');
    setAvatarUrl(user?.avatarUrl ?? null);
    setError('');
    setSuccess('');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
    setPasswordSuccess('');
  }, [user?.id, user?.firstName, user?.lastName, user?.avatarUrl]);

  const initials = useMemo(
    () => toInitials(firstName.trim(), lastName.trim(), user?.email),
    [firstName, lastName, user?.email],
  );

  if (!user) return null;

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

  const handlePasswordSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');
    setIsChangingPassword(true);

    try {
      if (!currentPassword || !newPassword || !confirmPassword) {
        throw new Error('Заполните все поля');
      }

      if (newPassword !== confirmPassword) {
        throw new Error('Пароли не совпадают');
      }

      await changePassword({
        currentPassword,
        newPassword,
      });

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSuccess(t('Пароль успешно обновлён'));
    } catch (err) {
      const message = err instanceof Error ? t(err.message) : t('Произошла ошибка при сохранении');
      setPasswordError(message);
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-semibold text-foreground tracking-tight">{t('Профиль')}</h1>
        <p className="text-muted-foreground mt-2">{t('Редактируйте персональные данные аккаунта')}</p>
      </div>

      <Card className="border-border/40">
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

      <Card className="border-border/40">
        <CardHeader>
          <CardTitle>{t('Безопасность аккаунта')}</CardTitle>
          <CardDescription>{t('Смените пароль для защиты аккаунта')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordSubmit} className="space-y-6">
            {(passwordError || passwordSuccess) && (
              <Alert
                variant={passwordError ? 'destructive' : 'default'}
                className={!passwordError ? 'border-emerald-700/40 bg-emerald-950/20' : ''}
              >
                {passwordError ? (
                  <AlertCircle className="h-4 w-4" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                )}
                <AlertDescription className={!passwordError ? 'text-emerald-300' : ''}>
                  {passwordError || passwordSuccess}
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="currentPassword">{t('Текущий пароль')}</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  autoComplete="current-password"
                  className="h-11 bg-input/50 border-border/50 focus:border-primary/60 transition-colors"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">{t('Новый пароль')}</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  autoComplete="new-password"
                  className="h-11 bg-input/50 border-border/50 focus:border-primary/60 transition-colors"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{t('Подтвердите новый пароль')}</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  className="h-11 bg-input/50 border-border/50 focus:border-primary/60 transition-colors"
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">{t('Пароль должен содержать минимум 6 символов')}</p>

            <div className="pt-2">
              <Button type="submit" className="h-11 min-w-44" disabled={isChangingPassword}>
                {isChangingPassword ? t('Обновление…') : t('Обновить пароль')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
