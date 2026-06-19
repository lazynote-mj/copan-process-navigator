import { createContext, useContext, type ReactNode } from 'react'
import type { AppMode } from './selectionTypes'

type EditorContextValue = {
  appMode: AppMode
  isEditMode: boolean
}

const EditorContext = createContext<EditorContextValue>({
  appMode: 'view',
  isEditMode: false,
})

export function EditorContextProvider({
  appMode,
  children,
}: {
  appMode: AppMode
  children: ReactNode
}) {
  return (
    <EditorContext.Provider value={{ appMode, isEditMode: appMode === 'edit' }}>
      {children}
    </EditorContext.Provider>
  )
}

export function useEditorContext(): EditorContextValue {
  return useContext(EditorContext)
}
