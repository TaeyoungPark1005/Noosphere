import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Navigate } from 'react-router-dom';
import { useIsSignedIn } from '../cloud/auth';
import AdminLayout, { ADMIN_COLORS } from '../components/admin/AdminLayout';
import type { AdminSection } from '../components/admin/AdminLayout';
import { t } from '../tokens';

// Lazy-load each section to keep bundle lightweight
const AdminDashboard = lazy(() => import('../components/admin/AdminDashboard'));
const AdminUsers = lazy(() => import('../components/admin/AdminUsers'));
const AdminSimulations = lazy(() => import('../components/admin/AdminSimulations'));
const AdminCredits = lazy(() => import('../components/admin/AdminCredits'));
const AdminPayments = lazy(() => import('../components/admin/AdminPayments'));
const AdminAnalytics = lazy(() => import('../components/admin/AdminAnalytics'));
const AdminLogs = lazy(() => import('../components/admin/AdminLogs'));
const AdminSettings = lazy(() => import('../components/admin/AdminSettings'));

const AdminPage: React.FC = () => {
  const isSignedIn = useIsSignedIn();
  const [section, setSection] = useState<AdminSection>('dashboard');
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isSignedIn) {
      setIsAdmin(false);
      return;
    }
    const checkAdmin = async () => {
      try {
        const { authenticatedFetch } = await import('../cloud/auth');
        const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';
        const res = await authenticatedFetch(`${API_BASE}/admin/dashboard`);
        setIsAdmin(res.ok);
      } catch {
        setIsAdmin(false);
      }
    };
    checkAdmin();
  }, [isSignedIn]);

  if (!isSignedIn) return <Navigate to="/" replace />;

  if (isAdmin === null) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: ADMIN_COLORS.bodyBg }}>
        <div style={{ color: ADMIN_COLORS.textMuted, fontSize: 14 }}>권한 확인 중...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: ADMIN_COLORS.bodyBg }}>
        <div style={{ background: t.color.bgPage, padding: 40, borderRadius: t.radius.lg, border: `1px solid ${ADMIN_COLORS.border}`, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: ADMIN_COLORS.textPrimary, marginBottom: 8 }}>접근 권한 없음</div>
          <div style={{ fontSize: 13, color: ADMIN_COLORS.textSecondary }}>어드민 권한이 필요합니다.</div>
        </div>
      </div>
    );
  }

  const fallback = <div style={{ padding: 40, textAlign: 'center', color: ADMIN_COLORS.textMuted }}>로딩 중...</div>;

  return (
    <AdminLayout activeSection={section} onNavigate={setSection}>
      <Suspense fallback={fallback}>
        {section === 'dashboard' && <AdminDashboard onNavigate={setSection} />}
        {section === 'users' && <AdminUsers />}
        {section === 'simulations' && <AdminSimulations />}
        {section === 'credits' && <AdminCredits />}
        {section === 'payments' && <AdminPayments />}
        {section === 'analytics' && <AdminAnalytics />}
        {section === 'logs' && <AdminLogs />}
        {section === 'settings' && <AdminSettings />}
      </Suspense>
    </AdminLayout>
  );
};

export { AdminPage };
export default AdminPage;
