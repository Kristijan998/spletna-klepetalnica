import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { applyInitialTheme } from '@/hooks/use-theme'
import * as Sentry from '@sentry/react'
import { BrowserTracing } from '@sentry/tracing'

applyInitialTheme()

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
const sentryDsn = import.meta.env.VITE_SENTRY_DSN

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    integrations: [new BrowserTracing()],
    tracesSampleRate: 0.1,
    environment: import.meta.env.MODE,
  })
}

const Root = googleClientId
  ? (
    <GoogleOAuthProvider clientId={googleClientId}>
      <App />
    </GoogleOAuthProvider>
  )
  : <App />

ReactDOM.createRoot(document.getElementById('root')).render(
  Root
)

