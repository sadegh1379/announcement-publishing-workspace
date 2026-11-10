import { badgeTone } from '../store/selectors'
import { useWorkspaceActions, useWorkspaceState } from '../store/workspaceContext'
import { StatusBadge } from './StatusBadge'

export function AnnouncementList() {
  const { order, byId, selectedId } = useWorkspaceState()
  const { select } = useWorkspaceActions()

  return (
    <ul aria-label="Announcements" className="space-y-2">
      {order.map((id) => {
        const announcement = byId[id]
        const selected = id === selectedId

        return (
          <li key={id}>
            <button
              type="button"
              onClick={() => select(id)}
              aria-current={selected ? 'true' : undefined}
              className={`w-full rounded-lg border px-3 py-3 text-left transition-colors ${
                selected
                  ? 'border-sky-500/50 bg-sky-500/10'
                  : 'border-zinc-800 bg-zinc-950 hover:bg-zinc-900/60'
              }`}
            >
              <span className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-zinc-100">
                    {announcement.title}
                  </span>
                  <span className="mt-1 block text-xs text-zinc-500">{announcement.id}</span>
                </span>
                <StatusBadge tone={badgeTone(announcement)} />
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
