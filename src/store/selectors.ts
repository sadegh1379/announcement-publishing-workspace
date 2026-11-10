import type { AnnouncementView, WorkspaceState } from '../types/workspace'

export type BadgeTone =
  | 'none'
  | 'submitting'
  | 'processing'
  | 'published'
  | 'rejected'
  | 'unconfirmed'

export function badgeTone(view: AnnouncementView): BadgeTone {
  if (
    view.activity === 'submitting' &&
    view.phase !== 'processing' &&
    view.phase !== 'published' &&
    view.phase !== 'rejected'
  ) {
    return 'submitting'
  }

  if (view.phase === 'none') return 'none'
  return view.phase
}

export function situationCopy(view: AnnouncementView): string {
  if (badgeTone(view) === 'submitting') {
    return 'Sending this announcement to the publishing service.'
  }

  switch (view.phase) {
    case 'none':
      return 'This announcement has not been submitted yet.'
    case 'processing':
      return 'The service has accepted this operation, but publication is not finished.'
    case 'published':
      return 'The service has confirmed this announcement is published.'
    case 'rejected':
      return 'The service declined publication.'
    case 'unconfirmed':
      return 'The last response was lost or failed. That does not establish whether publication succeeded or failed.'
  }
}

export function canPublish(view: AnnouncementView): boolean {
  return view.activity === 'idle' && (view.phase === 'none' || view.phase === 'rejected')
}

export function canRetrySame(view: AnnouncementView): boolean {
  return view.activity === 'idle' && view.phase === 'unconfirmed' && view.operationId !== null
}

export function canCheck(view: AnnouncementView): boolean {
  if (view.activity === 'submitting' || !view.operationId) return false
  return view.phase !== 'none'
}

export function watchSignature(state: WorkspaceState): string {
  if (state.status !== 'ready') return ''

  return state.order
    .flatMap((id) => {
      const view = state.byId[id]
      if (!view?.operationId) return []
      const follow =
        view.activity === 'submitting' ||
        view.phase === 'processing' ||
        view.phase === 'unconfirmed'
      return follow ? [`${id}:${view.operationId}`] : []
    })
    .join('|')
}
