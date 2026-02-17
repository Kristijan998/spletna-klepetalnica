import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { applyInitialTheme } from '@/hooks/use-theme'

applyInitialTheme()

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
const sentryDsn = import.meta.env.VITE_SENTRY_DSN

async function initSentry() {
  if (!sentryDsn) return;
  const [Sentry, { BrowserTracing }] = await Promise.all([
    import('@sentry/react'),
    import('@sentry/tracing'),
  ]);
  Sentry.init({
    dsn: sentryDsn,
    integrations: [new BrowserTracing()],
    tracesSampleRate: 0.1,
    environment: import.meta.env.MODE,
  });
}

async function renderApp() {
  await initSentry();
  const root = ReactDOM.createRoot(document.getElementById('root'));

  if (googleClientId) {
    const { GoogleOAuthProvider } = await import('@react-oauth/google');
    root.render(
      <GoogleOAuthProvider clientId={googleClientId}>
        <App />
      </GoogleOAuthProvider>
    );
    return;
  }

  root.render(<App />);
}

void renderApp();

