interface SwarmLogoProps {
  /** 外框边长，侧边栏展开约 28，收起同样用这一档 */
  size?: number;
  className?: string;
}

/**
 * dev-swarm 标：三枚节点呈右向雁阵。
 * 右侧大节点是编排者，左右两翼是并行 agent，连线表示同一条流程里的协同。
 * 颜色走 currentColor，由外层套皮肤主色。
 */
export function SwarmLogo({ size = 28, className = '' }: SwarmLogoProps) {
  const mark = Math.round(size * 0.72);
  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 rounded-lg bg-[rgb(var(--skin-primary)/0.12)] text-[rgb(var(--skin-primary))] ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label="dev-swarm"
      title="dev-swarm"
    >
      <svg width={mark} height={mark} viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <path
          d="M10.6 9.8 L19.4 14.6"
          stroke="currentColor"
          strokeOpacity="0.45"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
        <path
          d="M10.6 22.2 L19.4 17.4"
          stroke="currentColor"
          strokeOpacity="0.45"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
        <circle cx="23.4" cy="16" r="3.7" fill="currentColor" />
        <circle cx="8.5" cy="8.2" r="2.45" fill="currentColor" />
        <circle cx="8.5" cy="23.8" r="2.45" fill="currentColor" />
      </svg>
    </span>
  );
}
