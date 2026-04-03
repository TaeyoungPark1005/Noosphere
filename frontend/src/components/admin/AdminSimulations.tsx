import React, { useEffect, useState } from 'react';
import { useAdminSimulations } from '../../hooks/useAdmin';
import { Panel, Pagination, UserAvatar, badge, ADMIN_COLORS } from './AdminLayout';
import { t } from '../../tokens';

type StatusFilter = 'all' | 'running' | 'completed' | 'failed' | 'cancelled';

const AdminSimulations: React.FC = () => {
  const { data, loading, error, fetchSims, cancelSim } = useAdminSimulations();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [actionMsg, setActionMsg] = useState('');

  useEffect(() => {
    fetchSims(page, status, search);
  }, [page, status, search, fetchSims]);

  const handleCancel = async (simId: string) => {
    if (!confirm(`시뮬레이션 ${simId}를 취소하시겠습니까?`)) return;
    try {
      await cancelSim(simId);
      setActionMsg(`✓ ${simId} 취소됨`);
      fetchSims(page, status, search);
    } catch (e) {
      setActionMsg(`✗ ${String(e)}`);
    }
  };

  const sims = ((data as Record<string, unknown>)?.simulations as unknown[] ?? []) as Array<{
    id: string;
    status: string;
    created_at: string;
    input_text: string;
    platforms: string[];
    credit_cost: number;
    email: string;
  }>;
  const runningCount = sims.filter((s) => s.status === 'running').length;

  return (
    <div>
      <div style={{ marginBottom: 4, fontSize: 20, fontWeight: 700, color: ADMIN_COLORS.textPrimary }}>
        시뮬레이션 관리
      </div>
      <div style={{ color: ADMIN_COLORS.textSecondary, fontSize: 13, marginBottom: 20 }}>
        전체 {data?.total?.toLocaleString() ?? '–'}개 시뮬레이션
      </div>

      {actionMsg && (
        <div style={{ padding: '10px 16px', background: actionMsg.startsWith('✓') ? '#f0fdf4' : '#fef2f2', borderRadius: 8, marginBottom: 16, fontSize: 13, color: actionMsg.startsWith('✓') ? '#16a34a' : '#dc2626' }}>
          {actionMsg}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        {(['all', 'running', 'completed', 'failed', 'cancelled'] as const).map((s) => (
          <button
            key={s}
            onClick={() => { setStatus(s); setPage(1); }}
            style={{ padding: '6px 14px', borderRadius: 6, border: `1px solid ${status === s ? ADMIN_COLORS.primary : ADMIN_COLORS.border}`, background: status === s ? ADMIN_COLORS.primary : 'white', color: status === s ? 'white' : ADMIN_COLORS.textSecondary, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
          >
            {s === 'all' ? '전체' : s === 'running' ? `실행 중 ${runningCount > 0 ? `(${runningCount})` : ''}` : s === 'completed' ? '완료' : s === 'failed' ? '실패' : '취소됨'}
          </button>
        ))}
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="🔍 ID, 유저 검색..."
          style={{ marginLeft: 'auto', padding: '6px 12px', borderRadius: 6, border: `1px solid ${ADMIN_COLORS.border}`, fontSize: 13, width: 220, outline: 'none' }}
        />
      </div>

      <Panel title="시뮬레이션 목록">
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: ADMIN_COLORS.textMuted }}>로딩 중...</div>
        ) : error ? (
          <div style={{ padding: 20, color: '#dc2626' }}>{error}</div>
        ) : (
          <>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['ID', '유저', '입력 텍스트', '플랫폼', '상태', '크레딧', '시작', '액션'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 600, color: ADMIN_COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: `1px solid ${ADMIN_COLORS.border}` }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sims.map((sim) => (
                  <tr
                    key={sim.id}
                    style={{ borderBottom: `1px solid #f1f5f9`, background: sim.status === 'running' ? t.color.warningLight : 'white' }}
                  >
                    <td style={{ padding: '12px 12px' }}>
                      <code style={{ fontSize: 11, background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, color: ADMIN_COLORS.primary }}>
                        {sim.id.slice(0, 12)}
                      </code>
                    </td>
                    <td style={{ padding: '12px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <UserAvatar email={sim.email || '?'} size={24} />
                        <span style={{ fontSize: 13 }}>{sim.email?.split('@')[0]}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 12px', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: ADMIN_COLORS.textSecondary, fontSize: 12 }}>
                      {sim.input_text}
                    </td>
                    <td style={{ padding: '12px 12px', fontSize: 11, color: ADMIN_COLORS.textSecondary }}>
                      {sim.platforms.join(' · ')}
                    </td>
                    <td style={{ padding: '12px 12px' }}>
                      {badge(
                        sim.status === 'completed' ? 'success' :
                        sim.status === 'running' ? 'warning' :
                        sim.status === 'failed' ? 'error' : 'neutral',
                        sim.status === 'completed' ? '완료' :
                        sim.status === 'running' ? '실행 중' :
                        sim.status === 'failed' ? '실패' :
                        sim.status === 'cancelled' ? '취소됨' : sim.status
                      )}
                    </td>
                    <td style={{ padding: '12px 12px', fontWeight: 600 }}>{sim.credit_cost}</td>
                    <td style={{ padding: '12px 12px', color: ADMIN_COLORS.textMuted, fontSize: 12 }}>
                      {sim.created_at ? new Date(sim.created_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '–'}
                    </td>
                    <td style={{ padding: '12px 12px' }}>
                      {sim.status === 'running' && (
                        <button
                          onClick={() => handleCancel(sim.id)}
                          style={{ padding: '5px 10px', borderRadius: 5, border: `1px solid #fecaca`, background: 'white', color: '#ef4444', cursor: 'pointer', fontSize: 12 }}
                        >
                          취소
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data && (
              <Pagination page={data.page} pages={data.pages} total={data.total} perPage={data.per_page} onPage={setPage} />
            )}
          </>
        )}
      </Panel>
    </div>
  );
};

export default AdminSimulations;
