import type { BadgeTone } from '../store/selectors'

const BADGES: Record<BadgeTone, { label: string; className: string }> = {
  none: { label: 'Not submitted', className: 'bg-zinc-800 text-zinc-300' },
  submitting: { label: 'Submitting', className: 'bg-indigo-500/20 text-indigo-200' },
  processing: { label: 'Processing', className: 'bg-sky-500/15 text-sky-300' },
  published: { label: 'Published', className: 'bg-emerald-500/15 text-emerald-300' },
  rejected: { label: 'Rejected', className: 'bg-red-500/15 text-red-300' },
  unconfirmed: { label: 'Unconfirmed', className: 'bg-amber-500/15 text-amber-300' },
}

export function StatusBadge({ tone }: { tone: BadgeTone }) {
  const { label, className } = BADGES[tone]
  const busy = tone === 'submitting' || tone === 'processing'

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}
    >
      {busy ? (
        <span
          aria-hidden="true"
          className="mr-1.5 size-1.5 animate-pulse rounded-full bg-current"
        />
      ) : null}
      {label}
    </span>
  )
}
