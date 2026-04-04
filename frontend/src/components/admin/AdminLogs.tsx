import React, { useEffect, useState, useRef } from 'react';
import { useAdminLogs } from '../../hooks/useAdmin';
import { Panel, ADMIN_COLORS } from './AdminLayout';
import { t } from '../../tokens';
import type { AdminLogRow } from '../../types/admin';

const LEVEL_COLORS: Record<string, { bg: string; color: string }> = {
  error: { bg: t.color.dangerLight, color: t.color.dangerText },
  warning: { bg: t.color.warningLight, color: t.color.warningMid },
  info: { bg: '#eff6ff', color: '#2563eb' },
};

const AdminLogs: React.FC = () => {
  const { logs, loading, error, fetchLogs } = useAdminLogs();
  const [level, setLevel] = useState('all');
  const [paused, setPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchLogs(level);
  }, [level, fetchLogs]);

  useEffect(() => {
    if (paused) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => fetchLogs(level), 10000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [paused, level, fetchLogs]);

  return (
    <div>
      <div style={{ marginBottom: 4, fontSize: 20, fontWeight: 700, color: ADMIN_COLORS.textPrimary }}>시스템 로그</div>
      <div style={{ color: ADMIN_COLORS.textSecondary, fontSize: 13, marginBottom: 20 }}>DB 이벤트 기반 로그 (10초마다 자동 갱신)</div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        {['all', 'error', 'warning', 'info'].map((l) => (
          <button key={l} onClick={() => setLevel(l)}
            style={{ padding: '6px 14px', borderRadius: 6, border: `1px solid ${level === l ? ADMIN_COLORS.primary : ADMIN_COLORS.border}`, background: level === l ? ADMIN_COLORS.primary : 'white', color: level === l ? 'white' : ADMIN_COLORS.textSecondary, cursor: 'pointer', fontSize: 13 }}>
            {l === 'all' ? '전체' : l.toUpperCase()}
          </button>
        ))}
        <button onClick={() => setPaused((p) => !p)} style={{ marginLeft: 'auto', padding: '6px 14px', borderRadius: 6, border: `1px solid ${ADMIN_COLORS.border}`, background: 'white', color: ADMIN_COLORS.textSecondary, cursor: 'pointer', fontSize: 13 }}>
          {paused ? '▶ 재개' : '⏸ 일시정지'}
        </button>
        <button onClick={() => fetchLogs(level)} style={{ padding: '6px 14px', borderRadius: 6, border: `1px solid ${ADMIN_COLORS.border}`, background: 'white', color: ADMIN_COLORS.textSecondary, cursor: 'pointer', fontSize: 13 }}>
          🔄 새로고침
        </button>
      </div>

      <Panel title={`로그 ${logs.length > 0 ? `(${logs.length}건)` : ''}`}>
        {loading && logs.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: ADMIN_COLORS.textMuted }}>로딩 중...</div>
        ) : error ? (
          <div style={{ padding: 20, color: '#dc2626' }}>{error}</div>
        ) : (
          <div style={{ fontFamily: 'monospace', fontSize: 12 }}>
            {logs.map((log, i) => (
              <LogEntry key={i} log={log} />
            ))}
            {logs.length === 0 && (
              <div style={{ padding: 40, textAlign: 'center', color: ADMIN_COLORS.textMuted }}>로그 없음</div>
            )}
          </div>
        )}
      </Panel>
    </div>
  );
};

const LogEntry: React.FC<{ log: AdminLogRow }> = ({ log }) => {
  const lc = LEVEL_COLORS[log.level] ?? LEVEL_COLORS.info;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 20px', borderBottom: `1px solid #f1f5f9` }}>
      <span style={{ color: ADMIN_COLORS.textMuted, whiteSpace: 'nowrap', fontSize: 11 }}>
        {new Date(log.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </span>
      <span style={{ ...lc, padding: '1px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap', width: 60, textAlign: 'center' }}>
        {log.level.toUpperCase()}
      </span>
      <span style={{ color: '#374151' }}>{log.message}</span>
    </div>
  );
};

export default AdminLogs;
