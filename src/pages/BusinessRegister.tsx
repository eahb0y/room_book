import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useVenueStore } from '@/store/venueStore';
import { isBusinessEmail } from '@/lib/emailRules';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useI18n } from '@/i18n/useI18n';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function BusinessRegister() {
  const { t } = useI18n();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const register = useAuthStore((state) => state.register);
  const setPortal = useAuthStore((state) => state.setPortal);
  const createVenue = useVenueStore((state) => state.createVenue);
  const navigate = useNavigate();

  const [businessName, setBusinessName] = useState('');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!businessName.trim() || !address.trim()) {
      setError(t('Название бизнеса и адрес обязательны'));
      return;
    }

    if (isAuthenticated && user && !isBusinessEmail(user.email)) {
      setError(t('Для регистрации бизнеса используйте корпоративный email'));
      return;
    }

    if (!isAuthenticated) {
      if (!isBusinessEmail(email)) {
        setError(t('Для регистрации бизнеса используйте корпоративный email'));
        return;
      }

      if (password.length < 6) {
        setError(t('Пароль должен содержать минимум 6 символов'));
        return;
      }

      if (password !== confirmPassword) {
        setError(t('Пароли не совпадают'));
        return;
      }
    }

    setIsLoading(true);

    try {
      let currentUser = user;

      if (!isAuthenticated || !currentUser) {
        const success = await register({ email, password });
        if (!success) {
          setError(t('Пользователь с таким email уже существует'));
          return;
        }
        currentUser = useAuthStore.getState().user;
      }

      if (!currentUser) {
        setError(t('Не удалось завершить регистрацию'));
        return;
      }

      await createVenue({
        adminId: currentUser.id,
        name: businessName.trim(),
        address: address.trim(),
        description: description.trim(),
      });

      setPortal('business');
      navigate('/my-venue');
    } catch (err) {
      const message = err instanceof Error ? t(err.message) : t('Произошла ошибка при регистрации');
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[30%] h-[440px] w-[680px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/[0.05] blur-[150px]" />
      </div>

      <div className="absolute right-4 top-4 z-20">
        <LanguageSwitcher />
      </div>

      <div className="relative z-10 w-full max-w-lg animate-fade-up">
        <div className="mb-8 text-center">
          <img
            src="/favicon.svg"
            alt=""
            aria-hidden="true"
            className="mx-auto mb-5 h-12 w-12 rounded-xl shadow-glow"
          />
          <h1 className="text-3xl font-semibold text-foreground">{t('Регистрация бизнеса')}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isAuthenticated
              ? t('Добавьте новый бизнес в ваш кабинет')
              : t('Создайте бизнес-аккаунт и сразу добавьте свой первый бизнес')}
          </p>
        </div>

        <Card className="border-border/40 shadow-xl shadow-black/20">
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-5 pt-6">
              {error && (
                <Alert variant="destructive" className="animate-scale-in">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="businessName" className="text-sm text-muted-foreground">
                  {t('Название бизнеса')}
                </Label>
                <Input
                  id="businessName"
                  value={businessName}
                  onChange={(event) => setBusinessName(event.target.value)}
                  placeholder={t('Например: Nura Spaces')}
                  required
                  className="h-11 border-border/50 bg-input/50 focus:border-primary/60"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address" className="text-sm text-muted-foreground">
                  {t('Адрес')}
                </Label>
                <Input
                  id="address"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  placeholder={t('Например: ул. Ленина, 1')}
                  required
                  className="h-11 border-border/50 bg-input/50 focus:border-primary/60"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm text-muted-foreground">
                  {t('Описание')}
                </Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={3}
                  placeholder={t('Коротко опишите, что можно бронировать')}
                  className="border-border/50 bg-input/50 focus:border-primary/60"
                />
              </div>

              {!isAuthenticated && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm text-muted-foreground">
                      {t('Корпоративный email')}
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="team@yourcompany.com"
                      required
                      className="h-11 border-border/50 bg-input/50 focus:border-primary/60"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="password" className="text-sm text-muted-foreground">
                        {t('Пароль')}
                      </Label>
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="••••••••"
                        required
                        className="h-11 border-border/50 bg-input/50 focus:border-primary/60"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword" className="text-sm text-muted-foreground">
                        {t('Подтвердите пароль')}
                      </Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        placeholder="••••••••"
                        required
                        className="h-11 border-border/50 bg-input/50 focus:border-primary/60"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="rounded-xl border border-emerald-800/40 bg-emerald-950/20 px-3 py-2 text-xs text-emerald-200">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{t('После регистрации вы сразу попадете в бизнес-кабинет')}</span>
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-4 pb-6">
              <Button type="submit" className="h-11 w-full font-medium tracking-wide" disabled={isLoading}>
                {isLoading ? t('Регистрация...') : t('Зарегистрировать бизнес')}
              </Button>
              {!isAuthenticated && (
                <p className="text-center text-sm text-muted-foreground">
                  {t('Уже есть бизнес-аккаунт?')}{' '}
                  <Link to="/business/login" className="text-primary transition-colors hover:text-primary/80">
                    {t('Войти в бизнес-кабинет')}
                  </Link>
                </p>
              )}
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
