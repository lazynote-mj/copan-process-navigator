import { toBeNavigator } from './data/toBeNavigatorRegistry'
import { createInitialProcessData, ProcessDataProvider } from './data/processDataStore'
import { AppLayout } from './components/layout/AppLayout'

const fallbackProcessData = createInitialProcessData(
  toBeNavigator.overview,
  toBeNavigator.detailProcesses,
)

function App() {
  return (
    <ProcessDataProvider
      fallbackData={fallbackProcessData}
      registryDetailProcesses={toBeNavigator.detailProcesses}
    >
      <AppLayout />
    </ProcessDataProvider>
  )
}

export default App
