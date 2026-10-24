import { useEffect, useRef, useState } from 'react';
import type { WorkspaceNode } from '../utils/workflow';
import { formatSize } from '../utils/workflow';

interface WorkspaceTreeProps {
  readonly nodes: WorkspaceNode[];
  readonly selectedPath?: string;
  readonly onSelect: (node: WorkspaceNode) => void;
  /** 本阶段产物：目录全部展开。未传时只展开第一层。 */
  readonly expandAll?: boolean;
}

function dirPaths(nodes: readonly WorkspaceNode[], all: boolean): string[] {
  const out: string[] = [];
  const walk = (list: readonly WorkspaceNode[], nested: boolean) => {
    for (const node of list) {
      if (node.type !== 'dir') continue;
      if (all || !nested) out.push(node.path);
      if (node.children?.length) walk(node.children, true);
    }
  };
  walk(nodes, false);
  return out;
}

function TreeNode({ node, depth, selectedPath, onSelect, expanded, onToggle }: {
  node: WorkspaceNode;
  depth: number;
  selectedPath?: string;
  onSelect: (node: WorkspaceNode) => void;
  expanded: Set<string>;
  onToggle: (path: string) => void;
}) {
  const isDir = node.type === 'dir';
  const isExpanded = expanded.has(node.path);
  const isSelected = node.path === selectedPath;

  return (
    <div>
      <button
        onClick={() => (isDir ? onToggle(node.path) : onSelect(node))}
        title={node.path}
        className={`w-full text-left pr-2 py-1 rounded text-xs transition-colors flex items-center gap-1
          ${isSelected
            ? 'skin-primary-bg-light skin-primary'
            : 'skin-text-secondary hover:bg-gray-100 dark:hover:bg-gray-800'}`}
        style={{ paddingLeft: `${depth * 14 + 6}px` }}
      >
        {isDir && (
          <span className="shrink-0 text-[9px] opacity-60 w-3 text-center">
            {isExpanded ? '▼' : '▶'}
          </span>
        )}
        {!isDir && <span className="shrink-0 w-3" />}
        <span className="shrink-0">{isDir ? '📁' : '📄'}</span>
        <span className="truncate flex-1">{node.name}</span>
        {isDir ? (
          <span className="shrink-0 text-[10px] opacity-50">({node.children?.length ?? 0})</span>
        ) : (
          <span className="shrink-0 text-[10px] opacity-50">{formatSize(node.size)}</span>
        )}
      </button>
      {isDir && isExpanded && node.children?.map((child) => (
        <TreeNode
          key={child.path}
          node={child}
          depth={depth + 1}
          selectedPath={selectedPath}
          onSelect={onSelect}
          expanded={expanded}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
}

export function WorkspaceTree({ nodes, selectedPath, onSelect, expandAll = false }: WorkspaceTreeProps) {
  // 进入时按 expandAll 展开全部目录，否则只展开第一层；阶段切换由调用方换 key 重新初始化
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(dirPaths(nodes, expandAll)),
  );
  // 06 审查 S5：workspace 分组晚于首次挂载到达时，useState 初值已是空集——
  // expandAll 模式下把「新到达且从未自动展开过」的目录补进 expanded；已见过的目录不强制（保留用户手动收起）
  const autoSeen = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!expandAll) return;
    setExpanded((prev) => {
      const fresh = dirPaths(nodes, true).filter((p) => !autoSeen.current.has(p));
      if (!fresh.length) return prev;
      fresh.forEach((p) => autoSeen.current.add(p));
      return new Set([...prev, ...fresh]);
    });
  }, [nodes, expandAll]);

  function toggle(path: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  if (nodes.length === 0) {
    return <p className="text-xs text-gray-400 px-2 py-2">该阶段暂无产物文件</p>;
  }

  return (
    <div className="space-y-0.5">
      {nodes.map((node) => (
        <TreeNode
          key={node.path}
          node={node}
          depth={0}
          selectedPath={selectedPath}
          onSelect={onSelect}
          expanded={expanded}
          onToggle={toggle}
        />
      ))}
    </div>
  );
}
