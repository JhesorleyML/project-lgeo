import React from 'react';
import { useAuthStore } from './store/useAuthStore';
import { useMapFilterStore } from './store/useMapFilterStore';
import { PortalLayout } from './components/layout/PortalLayout';
import { LoginPage } from './pages/LoginPage';
import { MapExplorerPage } from './pages/MapExplorerPage';
import { AnalyticsDashboardPage } from './pages/AnalyticsDashboardPage';
import { UploadManagerPage } from './pages/UploadManagerPage';
import { ReportGeneratorPage } from './pages/ReportGeneratorPage';
import { YoYComparisonPage } from './pages/YoYComparisonPage';
import { UserManagementPage } from './pages/UserManagementPage';

export const App: React.FC = () => {
  const { currentUser } = useAuthStore();
  const { activePage } = useMapFilterStore();

  if (!currentUser) {
    return <LoginPage />;
  }

  if (activePage === 'map') {
    return <MapExplorerPage />;
  }

  return (
    <PortalLayout>
      {activePage === 'dashboard' && <AnalyticsDashboardPage />}
      {activePage === 'uploads' && <UploadManagerPage />}
      {activePage === 'reports' && <ReportGeneratorPage />}
      {activePage === 'yoy' && <YoYComparisonPage />}
      {activePage === 'users' && <UserManagementPage />}
    </PortalLayout>
  );
};

export default App;
