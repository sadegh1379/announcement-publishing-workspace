import { AnnouncementList } from './components/AnnouncementList'
import { PublicationPanel } from './components/PublicationPanel'
import { WorkspaceProvider } from './store/WorkspaceProvider'
import { useWorkspaceActions, useWorkspaceState } from './store/workspaceContext'

export default function App() {
  return (
    <WorkspaceProvider>
      <WorkspaceScreen />
    </WorkspaceProvider>
  )
}

function WorkspaceScreen() {
  const { status, loadError } = useWorkspaceState()
  const { reload } = useWorkspaceActions()

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-10">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Announcement Publishing</h1>
        <p className="max-w-2xl text-sm text-zinc-400">
          Choose a prepared announcement, publish it, and follow the result. Each
          announcement keeps its own publication, so another can be submitted before
          the first one finishes.
        </p>
      </header>

      {status === 'loading' ? (
        <p className="text-sm text-zinc-400">Loading announcements…</p>
      ) : null}

      {status === 'error' ? (
        <div className="space-y-3 rounded-lg border border-red-900/60 bg-red-950/30 px-4 py-4">
          <p className="text-sm text-red-300">{loadError}</p>
          <button type="button" onClick={reload} className="btn">
            Try again
          </button>
        </div>
      ) : null}

      {status === 'ready' ? (
        <div className="grid items-start gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <AnnouncementList />
          <PublicationPanel />
        </div>
      ) : null}

    </main>
  )
}
