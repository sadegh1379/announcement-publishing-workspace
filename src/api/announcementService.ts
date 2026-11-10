import {
  AnnouncementMockError,
  createAnnouncementMock,
} from '../../mocks'
import type {
  AnnouncementErrorCode,
  IAnnouncementService,
  PublicationOperation,
} from '../../mocks'

export const announcementService: IAnnouncementService = createAnnouncementMock()

const RECOVERY_ATTEMPTS = 6

export function describeServiceError(error: unknown): {
  message: string
  code?: AnnouncementErrorCode
} {
  if (error instanceof AnnouncementMockError) {
    return { message: error.message, code: error.code }
  }

  if (error instanceof Error && error.message) {
    return { message: error.message }
  }

  return { message: 'The publishing service could not be reached.' }
}

export async function listOperationsForRecovery(
  service: IAnnouncementService,
): Promise<PublicationOperation[]> {
  let failure: unknown

  for (let attempt = 0; attempt < RECOVERY_ATTEMPTS; attempt += 1) {
    try {
      return await service.listOperations()
    } catch (error) {
      failure = error
      if (describeServiceError(error).code !== 'STATUS_UNAVAILABLE') throw error
    }
  }

  throw failure
}
