import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import LoginView from './views/LoginView';
import NewTreatmentView from './views/technician/NewTreatmentView';
import DashboardView from './views/admin/DashboardView';
import FollowUpQueueView from './views/admin/FollowUpQueueView';
import ProductsView from './views/admin/ProductsView';
import UsersView from './views/admin/UsersView';
import ReportsView from './views/admin/ReportsView';
import AuditLogsView from './views/admin/AuditLogsView';
import FleetView from './views/admin/FleetView';
import InstallPwaBanner from './components/InstallPwaBanner';

export default function App() {
  const { user, loading } = useAuth();
  const [currentView, setCurrentView] = useState('new-treatment');
  const [activeReportId, setActiveReportId] = useState(null);

  // Set default view on user change
  useEffect(() => {
    if (user) {
      if (user.role === 'admin') {
        setCurrentView('dashboard');
      } else {
        setCurrentView('new-treatment');
      }
    }
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-bold text-slate-600 mt-4">טוען מערכת טיפולון...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  const isAdmin = user.role === 'admin';

  // Guard admin views
  let viewToRender = currentView;
  const adminOnlyViews = ['dashboard', 'fleet', 'follow-up', 'products', 'users', 'audit-logs'];
  if (!isAdmin && adminOnlyViews.includes(currentView)) {
    viewToRender = 'new-treatment';
  }

  const handleViewReportFromQueue = (reportId) => {
    setActiveReportId(reportId);
    setCurrentView('reports');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <InstallPwaBanner />
      <Navbar currentView={viewToRender} setCurrentView={(v) => { setActiveReportId(null); setCurrentView(v); }} />

      <main className="flex-1 pb-12">
        {viewToRender === 'new-treatment' && (
          <NewTreatmentView onTreatmentCompleted={() => {
            // Stay on new treatment scan screen
          }} />
        )}

        {viewToRender === 'dashboard' && isAdmin && (
          <DashboardView 
            onNavigateToReports={() => setCurrentView('reports')}
            onNavigateToFollowUp={() => setCurrentView('follow-up')}
          />
        )}

        {viewToRender === 'fleet' && isAdmin && (
          <FleetView onSelectBusReports={(busNum) => setCurrentView('reports')} />
        )}

        {viewToRender === 'follow-up' && isAdmin && (
          <FollowUpQueueView onViewReport={handleViewReportFromQueue} />
        )}

        {viewToRender === 'reports' && (
          <ReportsView initialReportId={activeReportId} />
        )}

        {viewToRender === 'products' && isAdmin && (
          <ProductsView />
        )}

        {viewToRender === 'users' && isAdmin && (
          <UsersView />
        )}

        {viewToRender === 'audit-logs' && isAdmin && (
          <AuditLogsView />
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-400">
        טיפולון – מערכת טיפול מונע באוטובוסים © 2026
      </footer>
    </div>
  );
}
