import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useVenueStore } from '@/store/venueStore';
import { getInvitationByToken, redeemInvitation } from '@/lib/inviteApi';
import type { Invitation } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2, Ticket } from 'lucide-react';
import { useI18n } from '@/i18n/useI18n';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function Invite() {
  const { t } = useI18n();
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const loadUserData = useVenueStore((state) => state.loadUserData);
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteLoadError, setInviteLoadError] = useState('');

  const [redeemState, setRedeemState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState('');
  const redeemAttemptRef = useRef<string | null>(null);

  const invitationStatus = !isAuthenticated
    ? 'pending-auth'
    : !invitation
      ? 'missing'
      : invitation.revokedAt
        ? 'revoked'
        : invitation.expiresAt && new Date(invitation.expiresAt) <= new Date()
          ? 'expired'
          : invitation.maxUses !== undefined && invitation.uses >= invitation.maxUses
            ? 'used'
            : 'valid';

  const inviteSubtitle = !isAuthenticated
    ? t('Войдите, чтобы проверить приглашение')
    : inviteLoading
      ? t('Проверяем приглашение…')
      : invitation?.venueName
        ? t('Вы приглашены в «{venue}»', { venue: invitation.venueName })
        : t('Приглашение');

  useEffect(() => {
    if (!token) return;
    redeemAttemptRef.current = null;
    setRedeemState('idle');
    setError('');
  }, [token]);

  useEffect(() => {
    if (!token || !isAuthenticated) {
      setInviteLoading(false);
      setInviteLoadError('');
      setInvitation(null);
      return;
    }
    let isActive = true;
    setInviteLoading(true);
    setInviteLoadError('');
    setInvitation(null);

    getInvitationByToken(token)
      .then((data) => {
        if (!isActive) return;
        setInvitation(data);
      })
      .catch((err) => {
        if (!isActive) return;
        const rawMessage = err instanceof Error ? err.message : t('Не удалось проверить приглашение');
        const lower = rawMessage.toLowerCase();
        if (lower.includes('not found') || lower.includes('не найдено')) {
          setInviteLoadError('');
        } else {
          setInviteLoadError(t(rawMessage));
        }
        setInvitation(null);
      })
      .finally(() => {
        if (!isActive) return;
        setInviteLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [token, isAuthenticated, t]);

  useEffect(() => {
    if (!token || !isAuthenticated || !user) return;
    if (user.role === 'admin') return;
    if (inviteLoading || inviteLoadError) return;
    if (invitationStatus !== 'valid') return;
    if (redeemState !== 'idle') return;

    const redeemKey = `${token}:${user.id}`;
    if (redeemAttemptRef.current === redeemKey) return;
    redeemAttemptRef.current = redeemKey;

    setRedeemState('loading');
    redeemInvitation(token, user.id, user.email)
      .then(async (result) => {
        if (result.success && result.venueId) {
          await loadUserData(user.id);
          navigate(`/venue/${result.venueId}`);
        } else {
          setError(t('Не удалось применить приглашение'));
          setRedeemState('error');
        }
      })
      .catch((err) => {
        const message = err instanceof Error ? t(err.message) : t('Не удалось применить приглашение');
        setError(message);
        setRedeemState('error');
      });
  }, [token, isAuthenticated, user, inviteLoading, inviteLoadError, invitationStatus, redeemState, loadUserData, navigate, t]);

  const handleContinue = () => {
    if (!token) return;
    navigate(`/login?invite=${token}`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[30%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-primary/[0.04] rounded-full blur-[120px] animate-glow-pulse" />
      </div>
      <div className="absolute right-4 top-4 z-20">
        <LanguageSwitcher />
      </div>

      <div className="w-full max-w-lg relative z-10 animate-fade-up">
        {/* Heading */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/90 mb-5 shadow-glow">
            <Ticket className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-3xl font-semibold text-foreground mb-2">
            {t('Приглашение')}
          </h1>
          <p className="text-muted-foreground text-sm">
            {inviteSubtitle}
          </p>
        </div>

        <Card className="border-border/40 shadow-xl shadow-black/20">
          <CardContent className="space-y-4 pt-6 pb-6">
            {inviteLoadError && (
              <Alert variant="destructive" className="animate-scale-in">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{inviteLoadError}</AlertDescription>
              </Alert>
            )}

            {!inviteLoading && !inviteLoadError && isAuthenticated && invitationStatus !== 'valid' && (
              <Alert variant="destructive" className="animate-scale-in">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {invitationStatus === 'missing'
                    ? t('Приглашение не найдено')
                    : invitationStatus === 'revoked'
                    ? t('Приглашение было отозвано')
                    : invitationStatus === 'expired'
                    ? t('Срок действия приглашения истёк')
                    : t('Лимит использования приглашения исчерпан')}
                </AlertDescription>
              </Alert>
            )}

            {error && (
              <Alert variant="destructive" className="animate-scale-in">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {invitationStatus === 'valid' && isAuthenticated && user?.role !== 'admin' && (
              <Alert className="bg-emerald-950/30 border-emerald-800/40 animate-scale-in">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <AlertDescription className="text-emerald-300">
                  {t('Приглашение подтверждено, перенаправляем…')}
                </AlertDescription>
              </Alert>
            )}

            {!isAuthenticated && (
              <>
                <p className="text-sm text-muted-foreground">
                  {t('Войдите или зарегистрируйтесь, чтобы принять приглашение.')}
                </p>
                <div className="flex flex-col gap-3">
                  <Button onClick={handleContinue} className="h-11">{t('Войти')}</Button>
                  <Button
                    variant="outline"
                    className="h-11"
                    onClick={() => token && navigate(`/register?invite=${token}`)}
                  >
                    {t('Зарегистрироваться')}
                  </Button>
                </div>
              </>
            )}

            {isAuthenticated && user?.role === 'admin' && (
              <Alert variant="destructive" className="animate-scale-in">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {t('Администраторские аккаунты не могут принимать приглашения.')}
                </AlertDescription>
              </Alert>
            )}

            <div className="pt-2">
              <Link to="/" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                {t('← Вернуться на главную')}
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
