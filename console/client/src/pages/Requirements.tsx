// ── 需求列表（05-B3/F2 列表后进入：行式列表 + 进行中/已终态双段 + 30s 轮询；卡片改行） ──
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAPI } from '../hooks/useAPI';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { EmptyState } from '../components/EmptyState';
import { RequirementRow } from '../components/RequirementRow';
import { DevEntryDrawer } from '../components/DevEntryDrawer';
import type { RequirementSummary } from '../utils/workflow';

export function Requirements() {
  const navigate = useNavigate();
  const { data: requirements, loading, error, refetch } = useAPI<RequirementSummary[]>('/requirements');
  // F09/D003-v3：研发入口抽屉（默认收起；行内按钮打开，抽屉自取详情）
  const [drawerReq, setDrawerReq] = useState<string | null>(null);

  // 列表页 30s 轮询（console 旧行为保留，与 H09 一致）
  useEffect(() => {
    const t = setInterval(refetch, 30000);
    return () => clearInterval(t);
  }, [refetch]);

  if (loading) return <LoadingSkeleton count={4} />;
  if (error) return <div className="text-sm text-red-400">Error: {error}</div>;

  if (!requirements?.length) {
    return (
      <EmptyState
        title="暂无工作空间"
        description="未发现任何进行中的工作空间（dataClone 未配置或 workspace/ 为空）"
      />
    );
  }

  const activeReqs = requirements.filter((r) => !r.terminal);
  const completedReqs = requirements.filter((r) => Boolean(r.terminal));

  function handleRowClick(req: RequirementSummary) {
    navigate(`/requirements/${encodeURIComponent(req.name)}`);
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <h2 className="text-lg font-semibold skin-text">工作空间</h2>
        <span className="text-xs skin-text-muted">
          进行中 {activeReqs.length} · 已终态 {completedReqs.length} · 点行进入详情
        </span>
      </div>

      <div className="border skin-border rounded-lg skin-bg-card overflow-hidden">
        {activeReqs.map((req) => (
          <RequirementRow key={req.name} requirement={req} onOpen={() => handleRowClick(req)} onDevEntry={() => setDrawerReq(req.name)} />
        ))}

        {completedReqs.length > 0 && (
          <>
            <div className="flex items-center gap-2 px-4 py-1.5 border-y skin-border bg-gray-50/60 dark:bg-gray-800/30">
              <span className="text-xs skin-text-muted">已终态 ({completedReqs.length})</span>
            </div>
            {completedReqs.map((req) => (
              <RequirementRow key={req.name} requirement={req} onOpen={() => handleRowClick(req)} onDevEntry={() => setDrawerReq(req.name)} />
            ))}
          </>
        )}
      </div>

      <DevEntryDrawer
        reqName={drawerReq ?? ''}
        open={drawerReq !== null}
        onClose={() => setDrawerReq(null)}
      />
    </div>
  );
}
