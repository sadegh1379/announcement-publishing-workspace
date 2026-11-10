import {
  badgeTone,
  canCheck,
  canPublish,
  canRetrySame,
  situationCopy,
} from '../store/selectors'
import { useWorkspaceActions, useWorkspaceState } from '../store/workspaceContext'
import { formatTimestamp } from '../utils/formatTime'
import { StatusBadge } from './StatusBadge'

export function PublicationPanel() {
  const { selectedId, byId } = useWorkspaceState()
  const { publish, check } = useWorkspaceActions()
  const announcement = selectedId ? byId[selectedId] : undefined

  if (!announcement) {
    return (
      <p className="rounded-lg border border-dashed border-zinc-800 px-4 py-10 text-center text-sm text-zinc-500">
        Select an announcement.
      </p>
    )
  }

  const tone = badgeTone(announcement)
  const checking = announcement.activity === 'checking'

  return (
    <section className="space-y-5 rounded-lg border border-zinc-800 bg-zinc-950 p-5">
      <header className="space-y-2">
        <p className="text-xs text-zinc-500">{announcement.id}</p>
        <h2 className="text-xl font-semibold text-zinc-100">{announcement.title}</h2>
        <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-300">{announcement.body}</p>
      </header>

      <div aria-live="polite" className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-medium text-zinc-200">Publication</h3>
          <StatusBadge tone={tone} />
        </div>

        <p className="text-sm text-zinc-300">{situationCopy(announcement)}</p>

        {announcement.phase === 'rejected' && announcement.reason ? (
          <p className="text-sm text-red-300">Reason: {announcement.reason}</p>
        ) : null}

        {announcement.phase === 'published' ? (
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-zinc-500">Publication id</dt>
              <dd className="break-all text-zinc-200">{announcement.publicationId}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Published</dt>
              <dd className="text-zinc-200">
                {announcement.publishedAt ? (
                  <time dateTime={announcement.publishedAt}>
                    {formatTimestamp(announcement.publishedAt)}
                  </time>
                ) : null}
              </dd>
            </div>
          </dl>
        ) : null}

        {announcement.operationId ? (
          <p className="break-all text-xs text-zinc-500">
            Operation {announcement.operationId}
          </p>
        ) : null}

        {announcement.notice ? (
          <p role="status" className="text-sm text-amber-300">
            {announcement.notice}
          </p>
        ) : null}

        {announcement.phase === 'unconfirmed' ? (
          <p className="text-xs text-zinc-500">
            Retry uses this same operation, so it cannot create a second publication.
          </p>
        ) : null}

        {announcement.phase === 'rejected' ? (
          <p className="text-xs text-zinc-500">
            Publish again starts a new operation. The rejected one stays rejected.
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {canPublish(announcement) ? (
            <button
              type="button"
              onClick={() => publish(announcement.id)}
              className="btn border-sky-600 bg-sky-600 hover:bg-sky-500"
            >
              {announcement.phase === 'rejected' ? 'Publish again' : 'Publish'}
            </button>
          ) : null}

          {canRetrySame(announcement) ? (
            <button
              type="button"
              onClick={() => publish(announcement.id)}
              className="btn border-sky-600 bg-sky-600 hover:bg-sky-500"
            >
              Retry this attempt
            </button>
          ) : null}

          {tone === 'submitting' ? (
            <button type="button" disabled className="btn">
              Submitting…
            </button>
          ) : null}

          {canCheck(announcement) ? (
            <button
              type="button"
              onClick={() => check(announcement.id)}
              disabled={checking}
              className="btn"
            >
              {checking ? 'Checking…' : 'Check status'}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  )
}
