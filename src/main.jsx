import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { applyInitialTheme } from '@/hooks/use-theme'

applyInitialTheme()

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
  void initSentry();
  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(<App />);
}

void renderApp();

