import { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { AlertCircle, CalendarDays } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useI18n } from '@/i18n/useI18n';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function Login() {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((state) => state.login);
  const inviteToken = new URLSearchParams(location.search).get('invite');
  const isInviteFlow = Boolean(inviteToken);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const success = await login({ email, password });
      if (success) {
        if (inviteToken) {
          navigate(`/invite/${inviteToken}`);
        } else {
          navigate('/app');
        }
      } else {
        setError(t('Неверный email или пароль'));
      }
    } catch (err) {
      const message = err instanceof Error ? t(err.message) : t('Произошла ошибка при входе');
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
        <LanguageSwitcher />
      </div>

      <div className="w-full max-w-md relative z-10 animate-fade-up">
        {/* Heading above card */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/90 mb-5 shadow-glow">
            <CalendarDays className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-3xl font-semibold text-foreground mb-2">
            {t('Вход в систему')}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t('Введите данные для доступа к платформе')}
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
                <Label htmlFor="email" className="text-sm text-muted-foreground">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
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
            </CardContent>
            <CardFooter className="flex flex-col gap-4 pt-2 pb-6">
              <Button type="submit" className="w-full h-11 font-medium text-sm tracking-wide" disabled={isLoading}>
                {isLoading ? t('Вход...') : t('Войти')}
              </Button>
              {isInviteFlow ? (
                <p className="text-sm text-center text-muted-foreground">
                  {t('Нет аккаунта?')}{' '}
                  <Link to={`/register?invite=${inviteToken}`} className="text-primary hover:text-primary/80 transition-colors">
                    {t('Зарегистрироваться')}
                  </Link>
                </p>
              ) : (
                <p className="text-sm text-center text-muted-foreground">
                  {t('Нет аккаунта?')}{' '}
                  <Link to="/register" className="text-primary hover:text-primary/80 transition-colors">
                    {t('Зарегистрироваться')}
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
