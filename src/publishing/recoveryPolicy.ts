import type { PublicationOperation } from '../../mocks/contracts'
import type { AnnouncementView, OperationId } from '../types/workspace'

export function selectCurrentOperation(
  operations: PublicationOperation[],
): PublicationOperation | null {
  if (operations.length === 0) return null

  const published = operations.filter((operation) => operation.status === 'published')
  if (published.length > 0) return latest(published)

  const processing = operations.filter((operation) => operation.status === 'processing')
  if (processing.length > 0) return latest(processing)

  return latest(operations)
}

export function createOperationId(announcementId: string): OperationId {
  return `op-${announcementId}-${crypto.randomUUID()}`
}

export function planAttempt(
  view: AnnouncementView,
): { operationId: OperationId; fresh: boolean } | null {
  if (view.activity !== 'idle') return null
  if (view.phase === 'published' || view.phase === 'processing') return null

  if (view.phase === 'unconfirmed' && view.operationId) {
    return { operationId: view.operationId, fresh: false }
  }

  if (view.phase === 'none' || view.phase === 'rejected') {
    return { operationId: createOperationId(view.id), fresh: true }
  }

  return null
}

function latest(operations: PublicationOperation[]): PublicationOperation {
  return [...operations].sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt),
  )[operations.length - 1]
}
