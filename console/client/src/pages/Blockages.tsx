// ── 阻塞视图（B1：旧 Blockages skin 化重做，数据源不变 H04） ──
import { useEffect, useState } from 'react';

interface Blockage { req: string; type: string; detail: string }

export function Blockages() {
  const [bs, setBs] = useState<Blockage[]>([]);
  useEffect(() => {
    const load = () => fetch('/api/blockages').then(r => r.json()).then(setBs).catch(() => {});
    const t = setInterval(load, 30000);
    load();
    return () => clearInterval(t);
  }, []);

  return (
    <div>
      <h2 className="text-lg font-semibold skin-text mb-4">阻塞</h2>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
        {bs.map((b, i) => (
          <div key={i} className="skin-bg-card rounded-xl p-4 border border-red-200 dark:border-red-900/60">
            <span className="text-red-600 dark:text-red-400 font-medium">{b.type}</span>
            <p className="text-sm skin-text-muted mt-1">{b.req}</p>
            <p className="text-sm skin-text mt-2">{b.detail}</p>
          </div>
        ))}
        {bs.length === 0 && <p className="text-sm skin-text-muted">✅ 无阻塞</p>}
      </div>
    </div>
  );
}
