// ── 待复验视图（F04：名称+状态过滤，状态默认「待复验」；纯前端过滤 H07，接口不变；30s 轮询与新行高亮保留）──
import { useEffect, useMemo, useRef, useState } from 'react';

interface ReverifyRow {
  req: string; id: string; repo: string; commit: string; dataRoot: string;
  point: string; expect: string; actual: string; instance: string; state: string;
}

const STATE_OPTIONS = ['全部', '待复验', '已复验', '已打回'];

export function Reverify() {
  const [rows, setRows] = useState<ReverifyRow[]>([]);
  const [fresh, setFresh] = useState<Record<string, number>>({});
  const seen = useRef<Set<string>>(new Set());
  const [nameFilter, setNameFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('待复验'); // F04：状态默认「待复验」

  const load = () => fetch('/api/reverify').then(r => r.json()).then((rs: ReverifyRow[]) => {
    const nf: Record<string, number> = {};
    for (const r of rs) {
      const k = `${r.req}|${r.id}|${r.commit}`;
      if (!seen.current.has(k)) { nf[k] = Date.now() + 30000; seen.current.add(k); }
    }
    setRows(rs);
    if (Object.keys(nf).length) setFresh(prev => ({ ...prev, ...nf }));
  }).catch(() => {});

  useEffect(() => {
    const t = setInterval(load, 30000);
    load();
    return () => clearInterval(t);
  }, []);

  const filtered = useMemo(() => rows.filter(r =>
    (stateFilter === '全部' || r.state === stateFilter) &&
    (!nameFilter.trim() || r.req.toLowerCase().includes(nameFilter.trim().toLowerCase()))
  ), [rows, nameFilter, stateFilter]);

  const now = Date.now();
  return (
    <div>
      <h2 className="text-lg font-semibold skin-text mb-4">待复验</h2>

      {/* 过滤条（F04） */}
      <div className="flex items-center gap-3 mb-3">
        <input
          value={nameFilter}
          onChange={(e) => setNameFilter(e.target.value)}
          placeholder="按工作空间名称过滤…"
          className="w-64 px-3 py-1.5 text-sm skin-bg-card skin-text border skin-border rounded-md
                     placeholder:text-gray-400 focus:outline-none focus:border-[rgb(var(--skin-primary)/0.6)]"
        />
        <select
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
          className="px-2 py-1.5 text-sm skin-bg-card skin-text border skin-border rounded-md"
        >
          {STATE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="text-xs skin-text-muted">{filtered.length}/{rows.length} 条</span>
      </div>

      <div className="skin-bg-card skin-border rounded-xl overflow-x-auto thin-scroll">
        <table className="w-full text-sm">
          <thead>
            <tr className="skin-text-muted">
              {['工作空间', '单号', '代码根', 'commit', '数据根', '复验动作', '期望', '实际', '实例', '状态'].map(h => (
                <th key={h} className="text-left px-3 py-2 font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => {
              const k = `${r.req}|${r.id}|${r.commit}`;
              return (
                <tr key={i} className={`border-t skin-border ${!r.instance ? 'bg-red-50/50 dark:bg-red-950/20' : ''}`}>
                  <td className="px-3 py-2 skin-text whitespace-nowrap">{r.req}</td>
                  <td className="px-3 py-2 skin-text font-mono">{r.id}</td>
                  <td className="px-3 py-2 skin-text-secondary">{r.repo}</td>
                  <td className="px-3 py-2 skin-text-muted font-mono">{r.commit.slice(0, 7)}</td>
                  <td className="px-3 py-2 skin-text-secondary">{r.dataRoot}</td>
                  <td className="px-3 py-2 skin-text-secondary">{r.point}</td>
                  <td className="px-3 py-2 skin-text-secondary max-w-[200px]">{r.expect}</td>
                  <td className="px-3 py-2 skin-text-muted max-w-[160px]">{r.actual || '—'}</td>
                  <td className="px-3 py-2">{r.instance || <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400">等部署</span>}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {fresh[k] > now && <span className="mr-1 px-2 py-0.5 rounded-full text-xs skin-primary-bg-light skin-primary">新</span>}
                    <span className={`px-2 py-0.5 rounded-full text-xs ${r.state === '已复验' ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400' : 'skin-primary-bg-light skin-primary'}`}>{r.state}</span>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={10} className="px-3 py-6 text-center skin-text-muted text-sm">
                {rows.length === 0 ? '暂无复验单' : '无符合条件的复验单（调整过滤条件或切「全部」）'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
