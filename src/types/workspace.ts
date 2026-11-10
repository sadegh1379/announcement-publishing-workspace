import type {
  AnnouncementErrorCode,
  PublicationOperation,
} from '../../mocks/contracts'

export type AnnouncementId = string
export type OperationId = string

export type Phase = 'none' | 'unconfirmed' | 'processing' | 'published' | 'rejected'

export type Activity = 'idle' | 'submitting' | 'checking'

export interface AnnouncementView {
  id: AnnouncementId
  title: string
  body: string
  operationId: OperationId | null
  phase: Phase
  version: 0 | 1 | 2
  publicationId: string | null
  publishedAt: string | null
  reason: string | null
  activity: Activity
  notice: string | null
}

export interface WorkspaceState {
  status: 'loading' | 'ready' | 'error'
  loadError: string | null
  order: AnnouncementId[]
  byId: Record<AnnouncementId, AnnouncementView>
  selectedId: AnnouncementId | null
}

export interface WatchTarget {
  announcementId: AnnouncementId
  operationId: OperationId
}

export type TrackerEvent =
  | { type: 'snapshot'; operation: PublicationOperation }
  | {
      type: 'response-lost'
      announcementId: AnnouncementId
      operationId: OperationId
      message: string
    }
  | {
      type: 'attempt-rejected'
      announcementId: AnnouncementId
      operationId: OperationId
      message: string
    }
  | {
      type: 'check-failed'
      announcementId: AnnouncementId
      operationId: OperationId
      message: string
      code?: AnnouncementErrorCode
    }
  | {
      type: 'missing'
      announcementId: AnnouncementId
      operationId: OperationId
    }
