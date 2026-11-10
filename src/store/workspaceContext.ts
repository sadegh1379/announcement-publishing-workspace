import { createContext, useContext } from 'react'
import type { AnnouncementId, WorkspaceState } from '../types/workspace'

export interface WorkspaceActions {
  select: (id: AnnouncementId) => void
  publish: (id: AnnouncementId) => void
  check: (id: AnnouncementId) => void
  reload: () => void
}

export const WorkspaceStateContext = createContext<WorkspaceState | null>(null)
export const WorkspaceActionsContext = createContext<WorkspaceActions | null>(null)

export function useWorkspaceState(): WorkspaceState {
  const state = useContext(WorkspaceStateContext)
  if (!state) throw new Error('Workspace hooks require <WorkspaceProvider>')
  return state
}

export function useWorkspaceActions(): WorkspaceActions {
  const actions = useContext(WorkspaceActionsContext)
  if (!actions) throw new Error('Workspace hooks require <WorkspaceProvider>')
  return actions
}
