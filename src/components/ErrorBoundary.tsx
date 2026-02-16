import { Component, type ReactNode } from 'react';
import { translate } from '@/i18n/messages';
import { useLocaleStore } from '@/store/localeStore';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const locale = useLocaleStore.getState().locale;
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0C0C0F',
          color: '#EDE8E0',
          fontFamily: "'Golos Text', system-ui, sans-serif",
          padding: '2rem',
        }}>
          <div style={{ textAlign: 'center', maxWidth: '420px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'rgba(201, 68, 68, 0.15)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px',
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C94444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <h1 style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: '1.75rem',
              marginBottom: '8px',
              fontWeight: 600,
              letterSpacing: '-0.015em',
            }}>
              {translate('Что-то пошло не так', locale)}
            </h1>
            <p style={{
              color: '#807A72',
              fontSize: '0.875rem',
              marginBottom: '24px',
              lineHeight: 1.6,
            }}>
              {this.state.error?.message || translate('Неизвестная ошибка', locale)}
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '10px 24px',
                background: '#D4853A',
                color: '#0C0C0F',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 600,
                fontFamily: "'Golos Text', system-ui, sans-serif",
                transition: 'background 0.2s',
              }}
              onMouseOver={(e) => (e.currentTarget.style.background = '#E0924A')}
              onMouseOut={(e) => (e.currentTarget.style.background = '#D4853A')}
            >
              {translate('Перезагрузить', locale)}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
