'use client';

interface Props {
  data: (number | null)[];
  color?: string;
  width?: number;
  height?: number;
}

export function Sparkline({ data, color = '#1a73e8', width = 60, height = 20 }: Props) {
  const valid = data.filter((v): v is number => v !== null);
  if (valid.length < 2) {
    return (
      <svg width={width} height={height} aria-hidden>
        <line x1={0} y1={height / 2} x2={width} y2={height / 2} stroke="rgba(255,255,255,0.1)" strokeWidth={1} />
      </svg>
    );
  }

  const mn = Math.min(...valid) - 2;
  const mx = Math.max(...valid) + 2;
  const range = mx - mn || 1;

  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = v === null ? height / 2 : height - ((v - mn) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg width={width} height={height} aria-hidden>
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
