import { describeServiceError } from '../api/announcementService'
import type { IAnnouncementService } from '../../mocks'
import type { TrackerEvent, WatchTarget } from '../types/workspace'

const POLL_MS = 1500

interface PublicationTrackerOptions {
  service: IAnnouncementService
  onEvent: (event: TrackerEvent) => void
}

export class PublicationTracker {
  private disposed = false
  private timer: ReturnType<typeof setTimeout> | null = null
  private targets: WatchTarget[] = []
  private publishing = new Set<string>()
  private reading = new Set<string>()
  private readonly options: PublicationTrackerOptions

  constructor(options: PublicationTrackerOptions) {
    this.options = options
  }

  publish(target: WatchTarget): boolean {
    if (this.disposed || this.publishing.has(target.announcementId)) return false

    this.publishing.add(target.announcementId)
    void this.runPublish(target)
    return true
  }

  check(target: WatchTarget): boolean {
    if (this.disposed || this.reading.has(target.operationId)) return false

    this.reading.add(target.operationId)
    void this.runRead(target)
    return true
  }

  sync(targets: WatchTarget[]): void {
    this.targets = targets
    if (this.disposed) return

    if (targets.length === 0) {
      this.clearTimer()
      return
    }

    void this.poll()
    this.ensureTimer()
  }

  dispose(): void {
    this.disposed = true
    this.clearTimer()
    this.targets = []
  }

  private ensureTimer(): void {
    if (this.timer !== null || this.disposed) return

    this.timer = setTimeout(() => {
      this.timer = null
      if (this.disposed || this.targets.length === 0) return
      void this.poll()
      this.ensureTimer()
    }, POLL_MS)
  }

  private clearTimer(): void {
    if (this.timer === null) return
    clearTimeout(this.timer)
    this.timer = null
  }

  private emit(event: TrackerEvent): void {
    if (this.disposed) return
    this.options.onEvent(event)
  }

  private async poll(): Promise<void> {
    const targets = [...this.targets]
    await Promise.all(targets.map((target) => this.readIfIdle(target)))
  }

  private async readIfIdle(target: WatchTarget): Promise<void> {
    if (this.disposed || this.reading.has(target.operationId)) return
    if (!this.targets.some((item) => item.operationId === target.operationId)) return

    this.reading.add(target.operationId)
    await this.runRead(target)
  }

  private async runRead(target: WatchTarget): Promise<void> {
    try {
      const operation = await this.options.service.getStatus(target.operationId)
      if (this.disposed) return

      if (operation === null) {
        this.emit({ type: 'missing', ...target })
        return
      }

      this.emit({ type: 'snapshot', operation })
    } catch (error) {
      const described = describeServiceError(error)
      this.emit({
        type: 'check-failed',
        ...target,
        message: described.message,
        code: described.code,
      })
    } finally {
      this.reading.delete(target.operationId)
    }
  }

  private async runPublish(target: WatchTarget): Promise<void> {
    try {
      const operation = await this.options.service.publish(
        target.announcementId,
        target.operationId,
      )
      this.emit({ type: 'snapshot', operation })
    } catch (error) {
      const described = describeServiceError(error)
      const lost = described.code === 'RESPONSE_LOST'
      this.emit({
        type: lost ? 'response-lost' : 'attempt-rejected',
        announcementId: target.announcementId,
        operationId: target.operationId,
        message: described.message,
      })
    } finally {
      this.publishing.delete(target.announcementId)
    }
  }
}
