import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

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

  return (
    <QueryClientProvider client={queryClientInstance}>
      <Router basename={import.meta.env.BASE_URL}>
        <Routes>
          <Route path="/" element={
            <LayoutWrapper currentPageName={mainPageKey}>
              <MainPage />
            </LayoutWrapper>
          } />
          {Object.entries(Pages).map(([path, Page]) => (
            <Route
              key={path}
              path={`/${path}`}
              element={
                <LayoutWrapper currentPageName={path}>
                  <Page />
                </LayoutWrapper>
              }
            />
          ))}
          <Route path="*" element={<PageNotFound />} />
        </Routes>
      </Router>
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  )
}

export default App
