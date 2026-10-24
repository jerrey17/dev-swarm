// ── 研发入口抽屉（F09/D003-v3；09/BUG-001~003 schema v2）：右侧滑出、默认收起；类目全渲染，未填=待办 pill；只读 ──
// 数据：详情接口 links（_state/links.yaml；缺失=空对象全待办）+ services（services.yaml 服务名铺服务级槽，S1/S4）
// 类目（BUG-003 后）：需求级 TAPD/研发计划/测试环境和集群(·cluster)/Wiki 多条；服务级 流水线+Wiki 两槽
// TAPD 空回退行上 tapdUrl（BUG-002：仅未迁移需求的只读回退）；列表入口自取详情，详情页直传 detail
import { useAPI } from '../hooks/useAPI';

// 09/BUG-001~003 schema v2：+wiki（需求级多条/服务级一槽）；-monitor/sql/saturn/apollo
export interface ReqLinks {
  tapd?: { url?: string };
  dev_plan?: { url?: string };
  test_env?: { url?: string; cluster?: string };
  wiki?: Array<{ name?: string; url?: string }>;
  services?: Record<string, { pipeline?: string; wiki?: string }>;
}

interface DevEntryDrawerProps {
  reqName: string;
  open: boolean;
  onClose: () => void;
  detail?: { services?: { name: string }[]; links?: ReqLinks; tapdUrl?: string } | null;
}

function LinkSlot({ label, url, extra }: { label: string; url?: string; extra?: string }) {
  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-between gap-2 px-2 py-1.5 rounded border skin-border skin-bg-card
          hover:border-[rgb(var(--skin-primary))] hover:underline transition-colors"
        title={url}
      >
        <span className="text-xs skin-text shrink-0">{label}</span>
        <span className="text-[10px] skin-primary font-mono shrink-0">打开 ↗</span>
      </a>
    );
  }
  return (
    <div
      className="flex items-center justify-between gap-2 px-2 py-1.5 rounded border border-dashed skin-border"
      title={extra || '待 human 提供后 cc-dev 代填（links.yaml）'}
    >
      <span className="text-xs skin-text-muted">{label}</span>
      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0
        bg-gray-100 dark:bg-gray-800 skin-text-muted">待办</span>
    </div>
  );
}

export function DevEntryDrawer({ reqName, open, onClose, detail }: DevEntryDrawerProps) {
  // 列表入口无 detail：open 时自取详情（useAPI 空路径不请求）
  const { data } = useAPI<NonNullable<DevEntryDrawerProps['detail']>>(
    open && !detail && reqName ? `/requirements/${encodeURIComponent(reqName)}` : '',
  );
  const d = detail ?? data;
  const links: ReqLinks = d?.links ?? {};
  const services = d?.services ?? [];
  const tapdUrl = links.tapd?.url || d?.tapdUrl;  // S5/BUG-002：links 优先，正文 tapdUrl 仅未迁移需求只读回退

  // 09/BUG-003：砍需求级 monitor、服务级 sql/saturn/apollo/monitor（入口在研发计划上配置，不在抽屉重复）
  const reqRows = [
    { label: 'TAPD 需求单', url: tapdUrl },
    { label: '研发计划', url: links.dev_plan?.url },
    // 06 审查 S4：cluster 在 URL 已填时也要可见（拼进 label），不再只藏在待办 title
    { label: links.test_env?.cluster ? `测试环境和集群 · ${links.test_env.cluster}` : '测试环境和集群', url: links.test_env?.url, extra: links.test_env?.cluster ? `集群：${links.test_env.cluster}` : undefined },
  ];
  // 09/BUG-001：wiki 需求级多条（name+url），空列表=待办
  const wikiList: Array<{ name?: string; url?: string }> = Array.isArray(links.wiki) ? links.wiki : [];

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />}
      <aside
        aria-hidden={!open}
        className={`fixed right-0 top-0 z-50 h-full w-80 max-w-[85vw] flex flex-col
          skin-bg-card border-l skin-border shadow-xl transition-transform duration-200
          ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b skin-border shrink-0">
          <div className="min-w-0">
            <p className="text-sm font-medium skin-text truncate">{reqName}</p>
            <p className="text-[10px] skin-text-muted">研发入口（只读 · 未填挂待办）</p>
          </div>
          <button onClick={onClose} className="shrink-0 px-2 py-1 rounded border skin-border text-xs skin-text hover:bg-gray-100 dark:hover:bg-gray-800" title="收起">
            收起 ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto thin-scroll px-3 py-3 space-y-4">
          <section>
            <p className="text-[10px] skin-text-muted mb-1.5">需求级</p>
            <div className="space-y-1.5">
              {reqRows.map((r) => <LinkSlot key={r.label} {...r} />)}
              {wikiList.length > 0
                ? wikiList.map((w, i) => (
                    <LinkSlot key={`wiki-${w.name || i}`} label={w.name ? `Wiki · ${w.name}` : 'Wiki'} url={w.url} />
                  ))
                : <LinkSlot label="Wiki" />}
            </div>
          </section>
          <section>
            <p className="text-[10px] skin-text-muted mb-1.5">服务级（流水线 / Wiki 两槽）</p>
            {services.length === 0 && <p className="text-xs skin-text-muted">本需求无 services（toolchain 类）</p>}
            {services.map((sv) => (
              <div key={sv.name} className="mb-3">
                <p className="text-xs font-mono skin-text-secondary mb-1">{sv.name}</p>
                <div className="space-y-1.5">
                  <LinkSlot label="流水线" url={links.services?.[sv.name]?.pipeline} />
                  <LinkSlot label="Wiki" url={links.services?.[sv.name]?.wiki} />
                </div>
              </div>
            ))}
          </section>
        </div>
      </aside>
    </>
  );
}
