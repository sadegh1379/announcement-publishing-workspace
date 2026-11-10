import type { IAnnouncement, PublicationOperation } from '../../mocks'
import { selectCurrentOperation } from '../publishing/recoveryPolicy'
import type {
  AnnouncementId,
  AnnouncementView,
  OperationId,
  TrackerEvent,
  WorkspaceState,
} from '../types/workspace'

type WorkspaceAction =
  | {
      type: 'workspace/loaded'
      announcements: IAnnouncement[]
      operations: PublicationOperation[]
    }
  | { type: 'workspace/load-failed'; message: string }
  | { type: 'selection/set'; id: AnnouncementId }
  | {
      type: 'attempt/started'
      announcementId: AnnouncementId
      operationId: OperationId
      fresh: boolean
    }
  | { type: 'check/started'; announcementId: AnnouncementId; operationId: OperationId }
  | { type: 'tracker/event'; event: TrackerEvent }

export function createInitialState(): WorkspaceState {
  return {
    status: 'loading',
    loadError: null,
    order: [],
    byId: {},
    selectedId: null,
  }
}

function emptyView(announcement: IAnnouncement): AnnouncementView {
  return {
    id: announcement.id,
    title: announcement.title,
    body: announcement.body,
    operationId: null,
    phase: 'none',
    version: 0,
    publicationId: null,
    publishedAt: null,
    reason: null,
    activity: 'idle',
    notice: null,
  }
}

function applyOperation(
  view: AnnouncementView,
  operation: PublicationOperation,
): AnnouncementView {
  const next: AnnouncementView = {
    ...view,
    operationId: operation.operationId,
    version: operation.version,
    activity: 'idle',
    notice: null,
    publicationId: null,
    publishedAt: null,
    reason: null,
    phase: 'processing',
  }

  if (operation.status === 'processing') return next

  if (operation.status === 'rejected') {
    return { ...next, phase: 'rejected', reason: operation.reason }
  }

  return {
    ...next,
    phase: 'published',
    publicationId: operation.publicationId,
    publishedAt: operation.publishedAt,
  }
}

function applyIfNewer(
  view: AnnouncementView,
  operation: PublicationOperation,
): AnnouncementView {
  if (operation.announcementId !== view.id) return view
  if (view.operationId !== operation.operationId) return view
  if (view.version > operation.version) return view
  if (view.phase === 'published' && operation.status !== 'published') return view
  if (
    view.phase === 'rejected' &&
    view.version === 2 &&
    operation.status !== 'rejected'
  ) {
    return view
  }

  return applyOperation(view, operation)
}

function reconcileAnnouncement(
  view: AnnouncementView,
  operations: PublicationOperation[],
): AnnouncementView {
  const mine = operations.filter((operation) => operation.announcementId === view.id)
  const ours = view.operationId
    ? mine.find((operation) => operation.operationId === view.operationId)
    : undefined

  if (view.activity === 'submitting' && view.operationId && !ours) return view

  if (ours) return applyIfNewer(view, ours)

  if (view.phase === 'unconfirmed' && view.operationId) return view

  const chosen = selectCurrentOperation(mine)
  if (!chosen) return view
  if (view.phase === 'published' && chosen.status !== 'published') return view

  return applyOperation(view, chosen)
}

function updateView(
  state: WorkspaceState,
  id: AnnouncementId,
  view: AnnouncementView,
): WorkspaceState {
  if (state.byId[id] === view) return state
  return { ...state, byId: { ...state.byId, [id]: view } }
}

function applyTrackerEvent(state: WorkspaceState, event: TrackerEvent): WorkspaceState {
  switch (event.type) {
    case 'snapshot': {
      const id = event.operation.announcementId
      const view = state.byId[id]
      if (!view) return state
      return updateView(state, id, applyIfNewer(view, event.operation))
    }

    case 'response-lost': {
      const view = state.byId[event.announcementId]
      if (!view || view.operationId !== event.operationId) return state
      if (view.version >= 1) return updateView(state, view.id, { ...view, activity: 'idle' })

      return updateView(state, view.id, {
        ...view,
        phase: 'unconfirmed',
        activity: 'idle',
        notice:
          'The publication response could not be received. This does not show whether publication succeeded or failed.',
      })
    }

    case 'attempt-rejected': {
      const view = state.byId[event.announcementId]
      if (!view || view.operationId !== event.operationId) return state

      if (view.version >= 1) {
        return updateView(state, view.id, {
          ...view,
          activity: 'idle',
          notice: event.message,
        })
      }

      return updateView(state, view.id, {
        ...emptyView(view),
        notice: event.message,
      })
    }

    case 'check-failed': {
      const view = state.byId[event.announcementId]
      if (!view || view.operationId !== event.operationId) return state

      const notice =
        event.code === 'STATUS_UNAVAILABLE'
          ? 'Publication status is temporarily unavailable. The announcement was not rejected.'
          : `${event.message} The last known result is unchanged.`

      return updateView(state, view.id, {
        ...view,
        notice,
        activity: view.activity === 'submitting' ? 'submitting' : 'idle',
      })
    }

    case 'missing': {
      const view = state.byId[event.announcementId]
      if (!view || view.operationId !== event.operationId) return state
      if (view.activity === 'submitting') return state

      if (view.phase === 'unconfirmed') {
        return updateView(state, view.id, {
          ...view,
          activity: 'idle',
          notice:
            'The service has no record of this attempt. Retrying it uses the same operation id and will not publish a second time.',
        })
      }

      if (view.version >= 1) {
        return updateView(state, view.id, {
          ...view,
          activity: 'idle',
          notice:
            'The service has no record of this operation. The result above is unchanged.',
        })
      }

      return updateView(state, view.id, { ...view, activity: 'idle' })
    }
  }
}

export function workspaceReducer(
  state: WorkspaceState,
  action: WorkspaceAction,
): WorkspaceState {
  switch (action.type) {
    case 'workspace/loaded': {
      const byId: Record<AnnouncementId, AnnouncementView> = {}
      const order = action.announcements.map((announcement) => {
        byId[announcement.id] = reconcileAnnouncement(
          emptyView(announcement),
          action.operations,
        )
        return announcement.id
      })

      const selectedId =
        state.selectedId && byId[state.selectedId] ? state.selectedId : (order[0] ?? null)

      return {
        ...state,
        status: 'ready',
        loadError: null,
        order,
        byId,
        selectedId,
      }
    }

    case 'workspace/load-failed':
      return { ...state, status: 'error', loadError: action.message }

    case 'selection/set':
      if (!state.byId[action.id]) return state
      return { ...state, selectedId: action.id }

    case 'attempt/started': {
      const view = state.byId[action.announcementId]
      if (!view || view.activity === 'submitting') return state

      if (!action.fresh) {
        return updateView(state, view.id, {
          ...view,
          operationId: action.operationId,
          activity: 'submitting',
          notice: null,
        })
      }

      return updateView(state, view.id, {
        ...emptyView(view),
        operationId: action.operationId,
        activity: 'submitting',
      })
    }

    case 'check/started': {
      const view = state.byId[action.announcementId]
      if (!view || view.operationId !== action.operationId) return state
      if (view.activity === 'submitting') return state
      return updateView(state, view.id, { ...view, activity: 'checking' })
    }

    case 'tracker/event':
      return applyTrackerEvent(state, action.event)
  }
}
