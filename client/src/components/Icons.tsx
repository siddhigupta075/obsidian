import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

const baseProps: IconProps = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

export function BrandMark({ className = '' }: { className?: string }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 2.5L4.5 5.8v5.5c0 4.8 3.2 9.1 7.5 10.2 4.3-1.1 7.5-5.4 7.5-10.2V5.8L12 2.5Z" />
      <path d="M7.5 12c1.4-2.2 7.6-2.2 9 0-1.4 2.2-7.6 2.2-9 0Z" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function MicIcon({ className = '' }: { className?: string }) {
  return (
    <svg {...baseProps} className={`shrink-0 ${className}`}>
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  )
}

export function MicOffIcon({ className = '' }: { className?: string }) {
  return (
    <svg {...baseProps} className={`shrink-0 ${className}`}>
      <line x1="2" x2="22" y1="2" y2="22" />
      <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" />
      <path d="M5 10v2a7 7 0 0 0 12 5" />
      <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  )
}

export function SquareStopIcon({ className = '' }: { className?: string }) {
  return (
    <svg {...baseProps} className={`shrink-0 ${className}`}>
      <rect x="5" y="5" width="14" height="14" rx="2" />
    </svg>
  )
}

export function AlertCircleIcon({ className = '' }: { className?: string }) {
  return (
    <svg {...baseProps} className={`shrink-0 ${className}`}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" x2="12" y1="8" y2="12" />
      <line x1="12" x2="12.01" y1="16" y2="16" />
    </svg>
  )
}

export function AlertTriangleIcon({ className = '' }: { className?: string }) {
  return (
    <svg {...baseProps} className={`shrink-0 ${className}`}>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  )
}

export function ShieldAlertIcon({ className = '' }: { className?: string }) {
  return (
    <svg {...baseProps} className={`shrink-0 ${className}`}>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </svg>
  )
}

export function ShieldCheckIcon({ className = '' }: { className?: string }) {
  return (
    <svg {...baseProps} className={`shrink-0 ${className}`}>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

export function CheckCircleIcon({ className = '' }: { className?: string }) {
  return (
    <svg {...baseProps} className={`shrink-0 ${className}`}>
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

export function ClockIcon({ className = '' }: { className?: string }) {
  return (
    <svg {...baseProps} className={`shrink-0 ${className}`}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

export function XCircleIcon({ className = '' }: { className?: string }) {
  return (
    <svg {...baseProps} className={`shrink-0 ${className}`}>
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6" />
      <path d="m9 9 6 6" />
    </svg>
  )
}

export function ChevronDownIcon({ className = '' }: { className?: string }) {
  return (
    <svg {...baseProps} className={`shrink-0 ${className}`}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

export function ChevronUpIcon({ className = '' }: { className?: string }) {
  return (
    <svg {...baseProps} className={`shrink-0 ${className}`}>
      <path d="m18 15-6-6-6 6" />
    </svg>
  )
}
