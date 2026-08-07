import { RouterProvider } from 'react-router-dom'
import { AuthProvider } from '@/lib/AuthContext'
import { ItemsProvider } from '@/lib/ItemsContext'
import { RequestsProvider } from '@/lib/RequestsContext'
import { EarningsProvider } from '@/lib/EarningsContext'
import { router } from '@/routes'

function App() {
  return (
    <AuthProvider>
      <ItemsProvider>
        <RequestsProvider>
          <EarningsProvider>
            <RouterProvider router={router} />
          </EarningsProvider>
        </RequestsProvider>
      </ItemsProvider>
    </AuthProvider>
  )
}

export default App
