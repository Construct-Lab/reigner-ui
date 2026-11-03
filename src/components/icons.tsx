import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function stroke({ size = 16, ...props }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    ...props,
  }
}

/** The Reigner crown, from the brand assets. */
export function Crown({ size = 28, ...props }: IconProps) {
  return (
    <svg width={size} height={size * 0.725} viewBox="0 0 200 145" aria-hidden {...props}>
      <path d="M8,118 L15,28 L38,90 L54,52 L78,96 L100,14 L122,96 L146,52 L162,90 L185,28 L192,118 Z" fill="currentColor" />
      <rect x="8" y="116" width="184" height="27" rx="3" fill="currentColor" />
      <path d="M100,46 L114,72 L100,104 L86,72 Z" fill="var(--paper)" opacity=".35" />
    </svg>
  )
}

export const ChevronUpDown = (p: IconProps) => (
  <svg {...stroke(p)}>
    <path d="m7 15 5 5 5-5M7 9l5-5 5 5" />
  </svg>
)

export const ChevronRight = (p: IconProps) => (
  <svg {...stroke({ strokeWidth: 2.4, ...p })}>
    <path d="m9 6 6 6-6 6" />
  </svg>
)

export const Check = (p: IconProps) => (
  <svg {...stroke({ strokeWidth: 2.2, ...p })}>
    <path d="M5 12l5 5L20 7" />
  </svg>
)

export const Plus = (p: IconProps) => (
  <svg {...stroke(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)

export const Pencil = (p: IconProps) => (
  <svg {...stroke(p)}>
    <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
)

export const Search = (p: IconProps) => (
  <svg {...stroke(p)}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
)

export const Close = (p: IconProps) => (
  <svg {...stroke(p)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
)

export const Trash = (p: IconProps) => (
  <svg {...stroke(p)}>
    <path d="M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3" />
  </svg>
)

export const ArrowUpRight = (p: IconProps) => (
  <svg {...stroke(p)}>
    <path d="M7 17 17 7M8 7h9v9" />
  </svg>
)
