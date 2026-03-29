import { useCallback, useEffect, useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { getOAuthCallbackErrorMessage } from '@/lib/authApi';
import { getSupabaseEnvironment } from '@/lib/supabaseConfig';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useI18n } from '@/i18n/useI18n';
import PreferenceControls from '@/components/PreferenceControls';

export default function Register() {
  const { t } = useI18n();
  const isProdEnvironment = getSupabaseEnvironment() === 'prod';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const register = useAuthStore((state) => state.register);
  const setPortal = useAuthStore((state) => state.setPortal);
  const startGoogleAuth = useAuthStore((state) => state.startGoogleAuth);
  const completeGoogleAuth = useAuthStore((state) => state.completeGoogleAuth);
  const searchParams = new URLSearchParams(location.search);
  const inviteToken = searchParams.get('invite');
  const nextPathParam = searchParams.get('next');
  const nextPath = nextPathParam && nextPathParam.startsWith('/') && !nextPathParam.startsWith('//') ? nextPathParam : null;
  const oauthReturnParams = new URLSearchParams();
  if (inviteToken) oauthReturnParams.set('invite', inviteToken);
  if (nextPath) oauthReturnParams.set('next', nextPath);
  const oauthReturnPath = oauthReturnParams.toString() ? `/register?${oauthReturnParams.toString()}` : '/register';
  const loginParams = new URLSearchParams();
  if (inviteToken) loginParams.set('invite', inviteToken);
  if (nextPath) loginParams.set('next', nextPath);
  const loginPath = loginParams.toString() ? `/login?${loginParams.toString()}` : '/login';
  const isInviteFlow = Boolean(inviteToken);
  const resolvePostAuthPath = useCallback(
    () => (inviteToken ? `/invite/${inviteToken}` : nextPath ?? '/profile'),
    [inviteToken, nextPath],
  );

  useEffect(() => {
    const oauthError = getOAuthCallbackErrorMessage(location.search);
    if (!oauthError) return;

    setError(t(oauthError));
    setIsLoading(false);
    window.history.replaceState(null, '', oauthReturnPath);
  }, [location.search, oauthReturnPath, t]);

  useEffect(() => {
    const oauthHash = location.hash;
    const hasOAuthPayload = oauthHash.includes('access_token') || oauthHash.includes('refresh_token');
    if (!hasOAuthPayload) return;

    let isActive = true;
    setError('');
    setIsLoading(true);
    window.history.replaceState(null, '', `${location.pathname}${location.search}`);

    void (async () => {
      try {
        const success = await completeGoogleAuth(oauthHash);
        if (!success) return;
        setPortal('user');
        if (isProdEnvironment) return;
        navigate(resolvePostAuthPath());
      } catch (err) {
        const message = err instanceof Error ? t(err.message) : t('Произошла ошибка при регистрации');
        if (isActive) setError(message);
      } finally {
        if (isActive) setIsLoading(false);
      }
    })();

    return () => {
      isActive = false;
    };
  }, [completeGoogleAuth, isProdEnvironment, location.hash, location.pathname, location.search, navigate, resolvePostAuthPath, setPortal, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError(t('Пароли не совпадают'));
      return;
    }

    if (password.length < 6) {
      setError(t('Пароль должен содержать минимум 6 символов'));
      return;
    }

    setIsLoading(true);

    try {
      const success = await register({ email, password });
      if (success) {
        setPortal('user');
        navigate(resolvePostAuthPath());
      } else {
        setError(t('Пользователь с таким email уже существует'));
      }
    } catch (err) {
      const message = err instanceof Error ? t(err.message) : t('Произошла ошибка при регистрации');
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 relative overflow-hidden">
      {/* Ambient copper glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[30%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-primary/[0.04] rounded-full blur-[120px] animate-glow-pulse" />
      </div>
      <div className="absolute right-4 top-4 z-20">
        <PreferenceControls />
      </div>

      <div className="w-full max-w-md relative z-10 animate-fade-up">
        {/* Heading */}
        <div className="text-center mb-8">
          <img
            src="/favicon.svg"
            alt=""
            aria-hidden="true"
            className="mx-auto mb-5 h-12 w-12 rounded-xl shadow-glow"
          />
          <h1 className="text-3xl font-semibold text-foreground mb-2">
            {isInviteFlow ? t('Регистрация по приглашению') : t('Создание пользовательского аккаунта')}
          </h1>
          <p className="text-muted-foreground text-sm">
            {isInviteFlow
              ? t('Создайте аккаунт, чтобы принять приглашение')
              : t('Создайте аккаунт, чтобы бронировать места в маркетплейсе')}
          </p>
        </div>

        <Card className="border-border/40 shadow-xl shadow-black/20">
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-5 pt-6">
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full border-border/60 bg-secondary/40"
                onClick={() => startGoogleAuth(isProdEnvironment ? '/?oauth_register=1' : oauthReturnPath)}
                disabled={isLoading}
              >
                {t('Продолжить с Google')}
              </Button>

              <div className="flex items-center gap-3 text-xs uppercase tracking-[0.14em] text-muted-foreground/70">
                <span className="h-px flex-1 bg-border/60" />
                <span>{t('или через email')}</span>
                <span className="h-px flex-1 bg-border/60" />
              </div>

              {error && (
                <Alert variant="destructive" className="animate-scale-in">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm text-muted-foreground">{t('Email')}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t('Например: your@email.com')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-11 bg-input/50 border-border/50 focus:border-primary/60 transition-colors"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm text-muted-foreground">{t('Пароль')}</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-11 bg-input/50 border-border/50 focus:border-primary/60 transition-colors"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm text-muted-foreground">{t('Подтвердите пароль')}</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="h-11 bg-input/50 border-border/50 focus:border-primary/60 transition-colors"
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4 pb-6">
              <Button type="submit" className="w-full h-11 font-medium text-sm tracking-wide" disabled={isLoading}>
                {isLoading ? t('Регистрация...') : t('Зарегистрироваться')}
              </Button>
              <p className="text-sm text-center text-muted-foreground">
                {t('Уже есть аккаунт?')}{' '}
                <Link
                  to={loginPath}
                  className="text-primary hover:text-primary/80 transition-colors"
                >
                  {t('Войти')}
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
