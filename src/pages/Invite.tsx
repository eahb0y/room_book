import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useVenueStore } from '@/store/venueStore';
import { getInvitationByToken, redeemInvitation } from '@/lib/inviteApi';
import type { Invitation } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { useI18n } from '@/i18n/useI18n';
import { hasBusinessAccess } from '@/lib/businessAccess';
import PreferenceControls from '@/components/PreferenceControls';
import {
  formatResidentPromoCode,
  getResidentPromoDescription,
  getResidentPromoTitle,
} from '@/lib/residentPromo';

export default function Invite() {
  const { t } = useI18n();
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const loadUserData = useVenueStore((state) => state.loadUserData);
  const [loadedToken, setLoadedToken] = useState<string | null>(null);
  const [loadedInvitation, setLoadedInvitation] = useState<Invitation | null>(null);
  const [loadedInviteError, setLoadedInviteError] = useState('');
  const [redeemErrorState, setRedeemErrorState] = useState<{ token: string | null; message: string }>({
    token: null,
    message: '',
  });
  const redeemAttemptRef = useRef<string | null>(null);
  const invitation = token && loadedToken === token ? loadedInvitation : null;
  const inviteLoadError = token && loadedToken === token ? loadedInviteError : '';
  const inviteLoading = Boolean(token && loadedToken !== token);
  const error = token && redeemErrorState.token === token ? redeemErrorState.message : '';

  const invitationStatus = !invitation
    ? 'missing'
    : invitation.revokedAt
      ? 'revoked'
      : invitation.expiresAt && new Date(invitation.expiresAt) <= new Date()
        ? 'expired'
        : invitation.maxUses !== undefined && invitation.uses >= invitation.maxUses
          ? 'used'
          : 'valid';

  const inviteSubtitle = inviteLoading
    ? t('Проверяем приглашение…')
    : invitation
      ? getResidentPromoTitle(invitation.venueName, t)
      : t('Приглашение');

  useEffect(() => {
    redeemAttemptRef.current = null;
  }, [token]);

  useEffect(() => {
    if (!token) return;
    let isActive = true;

    getInvitationByToken(token)
      .then((data) => {
        if (!isActive) return;
        setLoadedInvitation(data);
        setLoadedInviteError('');
        setLoadedToken(token);
      })
      .catch((err) => {
        if (!isActive) return;
        const rawMessage = err instanceof Error ? err.message : t('Не удалось проверить приглашение');
        const lower = rawMessage.toLowerCase();
        if (lower.includes('not found') || lower.includes('не найдено')) {
          setLoadedInviteError('');
        } else {
          setLoadedInviteError(t(rawMessage));
        }
        setLoadedInvitation(null);
        setLoadedToken(token);
      });

    return () => {
      isActive = false;
    };
  }, [token, t]);

  useEffect(() => {
    if (!token || !isAuthenticated || !user) return;
    if (hasBusinessAccess(user)) return;
    if (inviteLoading || inviteLoadError) return;
    if (invitationStatus !== 'valid') return;

    const redeemKey = `${token}:${user.id}`;
    if (redeemAttemptRef.current === redeemKey) return;
    redeemAttemptRef.current = redeemKey;

    redeemInvitation(token)
      .then(async (result) => {
        if (result.success && result.venueId) {
          await loadUserData(user.id);
          navigate(`/venue/${result.venueId}`);
        } else {
          setRedeemErrorState({
            token: token ?? null,
            message: t('Не удалось применить приглашение'),
          });
        }
      })
      .catch((err) => {
        const message = err instanceof Error ? t(err.message) : t('Не удалось применить приглашение');
        setRedeemErrorState({
          token: token ?? null,
          message,
        });
      });
  }, [token, isAuthenticated, user, inviteLoading, inviteLoadError, invitationStatus, loadUserData, navigate, t]);

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
        <PreferenceControls />
      </div>

      <div className="w-full max-w-lg relative z-10 animate-fade-up">
        {/* Heading */}
        <div className="text-center mb-8">
          <img
            src="/favicon.svg"
            alt=""
            aria-hidden="true"
            className="mx-auto mb-5 h-12 w-12 rounded-xl shadow-glow"
          />
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

            {!inviteLoading && !inviteLoadError && invitationStatus !== 'valid' && (
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

            {invitation ? (
              <div className="rounded-2xl border border-border/50 bg-background/35 p-4">
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{t('Промокод')}</p>
                <p className="mt-2 text-lg font-semibold text-foreground">
                  {getResidentPromoTitle(invitation.venueName, t)}
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {getResidentPromoDescription(t)}
                </p>
                <div className="mt-4 rounded-xl border border-border/50 bg-background/50 p-3">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{t('Промокод')}</p>
                  <p className="mt-1 font-mono text-sm text-foreground">{formatResidentPromoCode(invitation.token)}</p>
                </div>
              </div>
            ) : null}

            {error && (
              <Alert variant="destructive" className="animate-scale-in">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {invitationStatus === 'valid' && isAuthenticated && user && !hasBusinessAccess(user) && (
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
                  {t('Войдите или зарегистрируйтесь, чтобы активировать промокод.')}
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

            {isAuthenticated && user && hasBusinessAccess(user) && (
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
