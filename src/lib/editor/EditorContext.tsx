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

// eslint-disable-next-line react-refresh/only-export-components -- provider와 hook을 한 파일에 두는 표준 context 패턴
export function useEditorContext(): EditorContextValue {
  return useContext(EditorContext)
}
