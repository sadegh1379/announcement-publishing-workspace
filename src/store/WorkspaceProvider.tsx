import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  announcementService,
  describeServiceError,
  listOperationsForRecovery,
} from '../api/announcementService'
import { planAttempt } from '../publishing/recoveryPolicy'
import { PublicationTracker } from '../publishing/publicationTracker'
import type { AnnouncementId } from '../types/workspace'
import { canCheck, watchSignature } from './selectors'
import {
  WorkspaceActionsContext,
  WorkspaceStateContext,
  type WorkspaceActions,
} from './workspaceContext'
import { createInitialState, workspaceReducer } from './workspaceReducer'

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(workspaceReducer, undefined, createInitialState)
  const stateRef = useRef(state)
  stateRef.current = state

  const [tracker, setTracker] = useState<PublicationTracker | null>(null)
  const trackerRef = useRef<PublicationTracker | null>(null)

  useEffect(() => {
    const created = new PublicationTracker({
      service: announcementService,
      onEvent: (event) => dispatch({ type: 'tracker/event', event }),
    })
    trackerRef.current = created
    setTracker(created)
    return () => {
      created.dispose()
      if (trackerRef.current === created) trackerRef.current = null
    }
  }, [])

  const load = useMemo(() => {
    return async () => {
      try {
        const [announcements, operations] = await Promise.all([
          announcementService.getAnnouncements(),
          listOperationsForRecovery(announcementService),
        ])
        dispatch({
          type: 'workspace/loaded',
          announcements,
          operations,
        })
      } catch (error) {
        dispatch({
          type: 'workspace/load-failed',
          message: describeServiceError(error).message,
        })
      }
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const signature = watchSignature(state)

  useEffect(() => {
    const current = trackerRef.current
    if (!current) return

    const snapshot = stateRef.current
    const targets =
      snapshot.status === 'ready'
        ? snapshot.order.flatMap((id) => {
            const view = snapshot.byId[id]
            if (!view?.operationId) return []
            const follow =
              view.activity === 'submitting' ||
              view.phase === 'processing' ||
              view.phase === 'unconfirmed'
            if (!follow) return []
            return [
              {
                announcementId: id,
                operationId: view.operationId,
              },
            ]
          })
        : []

    current.sync(targets)
  }, [signature, tracker])

  const actions = useMemo<WorkspaceActions>(() => {
    const publish = (id: AnnouncementId) => {
      const current = stateRef.current
      const view = current.byId[id]
      const active = trackerRef.current
      if (!view || !active) return

      const plan = planAttempt(view)
      if (!plan) return

      const started = active.publish({
        announcementId: id,
        operationId: plan.operationId,
      })
      if (!started) return

      dispatch({
        type: 'attempt/started',
        announcementId: id,
        operationId: plan.operationId,
        fresh: plan.fresh,
      })
    }

    return {
      select: (id) => dispatch({ type: 'selection/set', id }),

      publish,

      check: (id) => {
        const current = stateRef.current
        const view = current.byId[id]
        const active = trackerRef.current
        if (!view || !active || !canCheck(view) || view.activity !== 'idle' || !view.operationId) {
          return
        }

        const started = active.check({
          announcementId: id,
          operationId: view.operationId,
        })
        if (!started) return

        dispatch({
          type: 'check/started',
          announcementId: id,
          operationId: view.operationId,
        })
      },

      reload: () => {
        void load()
      },
    }
  }, [load])

  return (
    <WorkspaceStateContext.Provider value={state}>
      <WorkspaceActionsContext.Provider value={actions}>
        {children}
      </WorkspaceActionsContext.Provider>
    </WorkspaceStateContext.Provider>
  )
}
