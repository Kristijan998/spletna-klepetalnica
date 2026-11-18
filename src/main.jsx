import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import '@/styles/classic.css'
import { applyInitialTheme } from '@/hooks/use-theme'

applyInitialTheme()

const sentryDsn = import.meta.env.VITE_SENTRY_DSN

async function initSentry() {
  if (!sentryDsn) return;
  const Sentry = await import('@sentry/react');
  Sentry.init({
    dsn: sentryDsn,
    integrations: [Sentry.browserTracingIntegration()],
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

