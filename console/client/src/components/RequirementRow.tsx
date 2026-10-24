// ── 需求行（05-B3/F2 列表后进入：一行一条，替代装饰卡片 RequirementCard；装饰/死分支不随行迁移）──
// 七要素：名称、profile、当前阶段或流程结束、下一手（agent · action）、已完成数/冻结链长度、更新时间、TAPD 入口
// 03 §F3/D004：TAPD 唯一来源=server 解析的 tapdUrl（current.md 正文）；无 URL 不渲染（H6）；
// 链接新窗口打开且 stopPropagation 不触发行点击进详情（H5）
import type { RequirementSummary } from '../utils/workflow';
import { formatStamp } from '../utils/workflow';

interface RequirementRowProps {
  readonly requirement: RequirementSummary;
  readonly onOpen: () => void;
  readonly onDevEntry?: () => void;  // F09/D003-v3：研发入口抽屉（stopPropagation 不触发行导航）
}

export function RequirementRow({ requirement: req, onOpen, onDevEntry }: RequirementRowProps) {
  const isTerminal = Boolean(req.terminal);

  // 解析失败行：醒目红色，保证状态文件问题可见
  if (req.format === 'error') {
    return (
      <div
        onClick={onOpen}
        className="px-4 py-2.5 border-b skin-border cursor-pointer hover:bg-red-50/40 dark:hover:bg-red-950/10 transition-colors"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm">⚠️</span>
          <span className="font-medium text-sm text-red-700 dark:text-red-400 truncate">{req.name}</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 shrink-0">
            状态文件解析失败
          </span>
        </div>
        <p className="text-xs text-red-600 dark:text-red-400/90 font-mono truncate mt-0.5" title={req.parseError}>
          {req.parseError}
        </p>
      </div>
    );
  }

  // S3：next 缺失时显示 blockers 或「—」（不挡，兜底展示）
  const nextText = req.next
    ? `${req.next.agent} · ${req.next.action}`
    : req.blockers.length
      ? `阻塞：${req.blockers.join('；')}`
      : '—';

  return (
    <div
      onClick={onOpen}
      className={`group flex items-start gap-3 px-4 py-2.5 border-b skin-border cursor-pointer transition-colors ${
        isTerminal
          ? 'opacity-70 hover:bg-gray-50 dark:hover:bg-gray-800/40'
          : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
      }`}
      title={`进入：${req.name}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${isTerminal ? 'bg-green-500' : 'bg-[rgb(var(--skin-primary))] animate-pulse'}`} />
            <span className="font-medium text-sm skin-text truncate">{req.name}</span>
            {req.profile && (
              <span
                className="px-1.5 py-0.5 rounded border text-[10px] font-mono shrink-0
                  bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 skin-text-secondary"
                title={`绑定流程 profile：${req.profile}`}
              >
                {req.profile}
              </span>
            )}
            <span className="text-xs skin-text-muted shrink-0">
              {isTerminal ? '流程结束' : req.phase || '进行中'}
            </span>
            {req.blockers.length > 0 && (
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0
                  bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400"
                title={req.blockers.join('；')}
              >
                阻塞 {req.blockers.length}
              </span>
            )}
          </div>
          <span className="text-xs skin-text-muted font-mono shrink-0">
            {req.completedPhases}/{req.totalPhases} · {formatStamp(req.updated_at)}
          </span>
        </div>
        <p className="text-xs mt-1 truncate">
          <span className="skin-text-muted">下一手 </span>
          <span className={isTerminal ? 'skin-text-secondary' : 'skin-primary'}>{nextText}</span>
        </p>
      </div>
      {req.tapdUrl && (
        <a
          href={req.tapdUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 mt-0.5 px-1.5 py-0.5 rounded border text-[10px] font-mono
            bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800/60
            text-amber-600 dark:text-amber-400
            hover:border-amber-400 dark:hover:border-amber-600 hover:underline transition-colors"
          title="新窗口打开 TAPD 故事"
        >
          TAPD ↗
        </a>
      )}
      {onDevEntry && (
        <button
          onClick={(e) => { e.stopPropagation(); onDevEntry(); }}
          className="shrink-0 mt-0.5 px-1.5 py-0.5 rounded border text-[10px] font-mono
            bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700
            skin-text-secondary
            hover:border-[rgb(var(--skin-primary))] hover:underline transition-colors"
          title="打开研发入口抽屉（TAPD/研发计划/环境集群/流水线/SQL/Saturn/Apollo/监控）"
        >
          研发入口
        </button>
      )}
    </div>
  );
}
