import { Suspense, useEffect, useState } from 'react'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : null;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const PageNotFound = () => (
  <div className="min-h-screen flex items-center justify-center p-6">
    <div className="max-w-md w-full text-center space-y-3">
      <h1 className="text-5xl font-semibold">404</h1>
      <p className="text-sm text-muted-foreground">Stran ne obstaja.</p>
      <button
        onClick={() => (window.location.href = import.meta.env.BASE_URL || "/")}
        className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md border"
      >
        Domov
      </button>
    </div>
  </div>
);


function App() {
  const [AnalyticsComponent, setAnalyticsComponent] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let timerId = null;
    let idleHandle = null;

    const loadAnalytics = async () => {
      try {
        const mod = await import("@vercel/analytics/react");
        if (!cancelled) {
          setAnalyticsComponent(() => mod.Analytics);
        }
      } catch {
        // ignore analytics loading failures
      }
    };

    if ("requestIdleCallback" in window) {
      idleHandle = window.requestIdleCallback(() => {
        void loadAnalytics();
      }, { timeout: 5000 });
    } else {
      timerId = window.setTimeout(() => {
        void loadAnalytics();
      }, 2200);
    }

    return () => {
      cancelled = true;
      if (timerId) window.clearTimeout(timerId);
      if (idleHandle && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleHandle);
      }
    };
  }, []);

  return (
    <>
      <Router basename={import.meta.env.BASE_URL}>
        <main id="main-content">
          <Routes>
            <Route path="/" element={
              <LayoutWrapper currentPageName={mainPageKey}>
                <Suspense fallback={null}>
                  {MainPage ? <MainPage /> : null}
                </Suspense>
              </LayoutWrapper>
            } />
            {Object.entries(Pages).map(([path, Page]) => (
              <Route
                key={path}
                path={`/${path}`}
                element={
                  <LayoutWrapper currentPageName={path}>
                    <Suspense fallback={null}>
                      <Page />
                    </Suspense>
                  </LayoutWrapper>
                }
              />
            ))}
            <Route path="*" element={<PageNotFound />} />
          </Routes>
        </main>
      </Router>
      <Toaster richColors position="top-right" />
      {AnalyticsComponent ? <AnalyticsComponent /> : null}
    </>
  )
}

export default App
