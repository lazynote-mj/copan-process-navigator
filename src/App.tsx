import { toBeNavigator } from './data/toBeNavigatorRegistry'
import { ProcessDataProvider } from './data/processDataStore'
import { createInitialProcessData } from './data/processDataMigration'
import { AppLayout } from './components/layout/AppLayout'
import { createApplicationBootstrap } from './bootstrap'

const fallbackProcessData = createInitialProcessData(
  toBeNavigator.overview,
  toBeNavigator.detailProcesses,
)
const applicationBootstrap = createApplicationBootstrap()
const storageAdapter = applicationBootstrap.workspaceRuntime.templateRuntime.storageAdapter

function App() {
  return (
    <ProcessDataProvider
      fallbackData={fallbackProcessData}
      registryDetailProcesses={toBeNavigator.detailProcesses}
      storageAdapter={storageAdapter}
    >
      <AppLayout />
    </ProcessDataProvider>
  )
}

export default App
