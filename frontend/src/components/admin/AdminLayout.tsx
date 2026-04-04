import React from 'react';
import { t } from '../../tokens';

export type AdminSection =
  | 'dashboard'
  | 'users'
  | 'simulations'
  | 'credits'
  | 'payments'
  | 'analytics'
  | 'logs'
  | 'settings';

interface Props {
  activeSection: AdminSection;
  onNavigate: (s: AdminSection) => void;
  children: React.ReactNode;
}

const SIDEBAR_ITEMS: {
  id: AdminSection;
  icon: string;
  label: string;
  group: string;
}[] = [
  { id: 'dashboard', icon: '📊', label: 'Dashboard', group: 'overview' },
  { id: 'analytics', icon: '📈', label: 'Analytics', group: 'overview' },
  { id: 'users', icon: '👥', label: 'Users', group: 'management' },
  { id: 'simulations', icon: '⚡', label: 'Simulations', group: 'management' },
  { id: 'credits', icon: '💳', label: 'Credits', group: 'management' },
  { id: 'payments', icon: '💰', label: 'Payments', group: 'management' },
  { id: 'logs', icon: '📋', label: 'Logs', group: 'system' },
  { id: 'settings', icon: '⚙️', label: 'Settings', group: 'system' },
];

const SECTION_LABELS: Record<AdminSection, string> = {
  dashboard: 'Dashboard',
  analytics: 'Analytics',
  users: '유저 관리',
  simulations: '시뮬레이션 관리',
  credits: '크레딧 관리',
  payments: '결제 내역',
  logs: '시스템 로그',
  settings: '설정',
};

export const ADMIN_COLORS = {
  primary: '#6366f1',
  primaryHover: '#4f46e5',
  primaryLight: '#eef2ff',
  sidebarBg: '#0f172a',
  sidebarBorder: '#1e293b',
  sidebarText: '#94a3b8',
  sidebarActive: '#6366f1',
  bodyBg: '#f1f5f9',
  panelBg: '#ffffff',
  border: '#e2e8f0',
  textPrimary: '#1e293b',
  textSecondary: '#64748b',
  textMuted: '#94a3b8',
};

export const badge = (
  variant: 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'purple',
  text: string,
) => {
  const styles: Record<string, React.CSSProperties> = {
    success: { background: '#f0fdf4', color: '#16a34a' },
    warning: { background: t.color.warningLight, color: t.color.warningMid },
    error: { background: '#fef2f2', color: '#dc2626' },
    info: { background: '#eff6ff', color: '#2563eb' },
    neutral: { background: '#f1f5f9', color: '#64748b' },
    purple: { background: '#faf5ff', color: t.color.accentDark },
  };
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 8px',
        borderRadius: 12,
        fontSize: 11,
        fontWeight: 600,
        gap: 4,
        ...styles[variant],
      }}
    >
      <span style={{ fontSize: 8, opacity: 0.8 }}>●</span>
      {text}
    </span>
  );
};

export const UserAvatar: React.FC<{ email: string; size?: number }> = ({
  email,
  size = 32,
}) => {
  const initials = email
    .split('@')[0]
    .slice(0, 2)
    .toUpperCase();
  const colors = [
    '#6366f1', t.color.accent, '#3b82f6', '#22c55e',
    t.color.warning, t.color.danger, '#ec4899', '#06b6d4',
  ];
  const color = colors[email.charCodeAt(0) % colors.length];
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontSize: size * 0.38,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
};

export const Pagination: React.FC<{
  page: number;
  pages: number;
  total: number;
  perPage: number;
  onPage: (p: number) => void;
}> = ({ page, pages, total, perPage, onPage }) => {
  const start = (page - 1) * perPage + 1;
  const end = Math.min(page * perPage, total);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 20px',
        borderTop: `1px solid ${ADMIN_COLORS.border}`,
        color: ADMIN_COLORS.textSecondary,
        fontSize: 13,
      }}
    >
      <span>
        {total}개 중 {start}–{end} 표시
      </span>
      <div style={{ display: 'flex', gap: 4 }}>
        <PageBtn label="‹" active={false} onClick={() => onPage(Math.max(1, page - 1))} />
        {Array.from({ length: Math.min(5, pages) }, (_, i) => i + 1).map((p) => (
          <PageBtn key={p} label={String(p)} active={p === page} onClick={() => onPage(p)} />
        ))}
        {pages > 5 && <span style={{ padding: '0 4px', color: ADMIN_COLORS.textMuted }}>...</span>}
        {pages > 5 && (
          <PageBtn label={String(pages)} active={pages === page} onClick={() => onPage(pages)} />
        )}
        <PageBtn label="›" active={false} onClick={() => onPage(Math.min(pages, page + 1))} />
      </div>
    </div>
  );
};

const PageBtn: React.FC<{ label: string; active: boolean; onClick: () => void }> = ({
  label,
  active,
  onClick,
}) => (
  <button
    onClick={onClick}
    style={{
      width: 32,
      height: 32,
      borderRadius: 6,
      border: `1px solid ${active ? ADMIN_COLORS.primary : ADMIN_COLORS.border}`,
      background: active ? ADMIN_COLORS.primary : 'white',
      color: active ? 'white' : ADMIN_COLORS.textSecondary,
      cursor: 'pointer',
      fontSize: 13,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    {label}
  </button>
);

export const Panel: React.FC<{
  title: string;
  action?: { label: string; onClick: () => void };
  children: React.ReactNode;
}> = ({ title, action, children }) => (
  <div
    style={{
      background: ADMIN_COLORS.panelBg,
      borderRadius: 10,
      border: `1px solid ${ADMIN_COLORS.border}`,
      overflow: 'hidden',
    }}
  >
    <div
      style={{
        padding: '14px 20px',
        borderBottom: `1px solid ${ADMIN_COLORS.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <span style={{ fontWeight: 600, color: ADMIN_COLORS.textPrimary, fontSize: 14 }}>
        {title}
      </span>
      {action && (
        <span
          onClick={action.onClick}
          style={{ color: ADMIN_COLORS.primary, fontSize: 12, cursor: 'pointer', fontWeight: 500 }}
        >
          {action.label} →
        </span>
      )}
    </div>
    {children}
  </div>
);

export const StatCard: React.FC<{
  label: string;
  value: string | number;
  change?: string;
  changeType?: 'up' | 'down' | 'neutral';
  icon: string;
  iconColor: string;
}> = ({ label, value, change, changeType, icon, iconColor }) => (
  <div
    style={{
      background: ADMIN_COLORS.panelBg,
      borderRadius: 10,
      border: `1px solid ${ADMIN_COLORS.border}`,
      padding: 20,
    }}
  >
    <div
      style={{
        width: 40,
        height: 40,
        borderRadius: 8,
        background: iconColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 18,
        marginBottom: 12,
      }}
    >
      {icon}
    </div>
    <div style={{ fontSize: 11, fontWeight: 600, color: ADMIN_COLORS.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
      {label}
    </div>
    <div style={{ fontSize: 26, fontWeight: 700, color: ADMIN_COLORS.textPrimary, marginBottom: 4 }}>
      {value}
    </div>
    {change && (
      <div
        style={{
          fontSize: 12,
          color:
            changeType === 'up'
              ? '#22c55e'
              : changeType === 'down'
              ? '#ef4444'
              : ADMIN_COLORS.textSecondary,
        }}
      >
        {change}
      </div>
    )}
  </div>
);

// ── 메인 레이아웃 ────────────────────────────────────────────

const AdminLayout: React.FC<Props> = ({ activeSection, onNavigate, children }) => {
  const groups = [
    { id: 'overview', label: 'OVERVIEW' },
    { id: 'management', label: 'MANAGEMENT' },
    { id: 'system', label: 'SYSTEM' },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: ADMIN_COLORS.bodyBg }}>
      {/* Sidebar */}
      <nav
        style={{
          width: 240,
          background: ADMIN_COLORS.sidebarBg,
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          position: 'fixed',
          height: '100vh',
          overflowY: 'auto',
        }}
      >
        {/* Logo */}
        <div
          style={{
            padding: '20px 16px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            borderBottom: `1px solid ${ADMIN_COLORS.sidebarBorder}`,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              background: `linear-gradient(135deg, ${t.color.primary}, ${t.color.accent})`,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 700,
              fontSize: 16,
            }}
          >
            N
          </div>
          <span style={{ color: 'white', fontWeight: 600, fontSize: 15 }}>Noosphere</span>
          <span
            style={{
              background: ADMIN_COLORS.primary,
              color: 'white',
              fontSize: 10,
              fontWeight: 600,
              padding: '2px 6px',
              borderRadius: 4,
              letterSpacing: '0.5px',
            }}
          >
            ADMIN
          </span>
        </div>

        {/* Nav items */}
        {groups.map((group) => {
          const items = SIDEBAR_ITEMS.filter((i) => i.group === group.id);
          return (
            <div
              key={group.id}
              style={{
                padding: '12px 0',
                borderBottom: `1px solid ${ADMIN_COLORS.sidebarBorder}`,
              }}
            >
              <div
                style={{
                  padding: '4px 16px 8px',
                  color: '#475569',
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.8px',
                  textTransform: 'uppercase',
                }}
              >
                {group.label}
              </div>
              {items.map((item) => {
                const isActive = item.id === activeSection;
                return (
                  <div
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '9px 16px',
                      color: isActive ? ADMIN_COLORS.sidebarActive : ADMIN_COLORS.sidebarText,
                      cursor: 'pointer',
                      background: isActive ? ADMIN_COLORS.sidebarBorder : 'transparent',
                      borderLeft: isActive ? `3px solid ${ADMIN_COLORS.primary}` : '3px solid transparent',
                      transition: 'all 0.15s',
                    }}
                  >
                    <span style={{ fontSize: 15, width: 20, textAlign: 'center' }}>
                      {item.icon}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{item.label}</span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Main */}
      <div style={{ marginLeft: 240, flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Topbar */}
        <div
          style={{
            background: 'white',
            borderBottom: `1px solid ${ADMIN_COLORS.border}`,
            padding: '0 24px',
            height: 56,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: ADMIN_COLORS.textSecondary, fontSize: 13 }}>
            <span>Admin</span>
            <span>›</span>
            <span style={{ color: ADMIN_COLORS.textPrimary, fontWeight: 600 }}>
              {SECTION_LABELS[activeSection]}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: '#f8fafc',
                border: `1px solid ${ADMIN_COLORS.border}`,
                borderRadius: 6,
                padding: '6px 12px',
                color: ADMIN_COLORS.textMuted,
                fontSize: 13,
                width: 220,
              }}
            >
              🔍 <span>Search anything...</span>
            </div>
          </div>
        </div>

        {/* Page content */}
        <div style={{ padding: 24, flex: 1 }}>{children}</div>
      </div>
    </div>
  );
};

export default AdminLayout;
