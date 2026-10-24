// ── EmptyState ── 空状态组件（迁移自 claude-board）

interface EmptyStateProps {
  readonly title: string;
  readonly description: string;
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="text-center py-20">
      <div className="text-lg font-medium text-gray-400 dark:text-gray-500 mb-2">
        {title}
      </div>
      <div className="text-sm text-gray-300 dark:text-gray-600">
        {description}
      </div>
    </div>
  );
}
