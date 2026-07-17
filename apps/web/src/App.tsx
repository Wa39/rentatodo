import { RouterProvider } from 'react-router-dom'
import { AuthProvider } from '@/lib/AuthContext'
import { ItemsProvider } from '@/lib/ItemsContext'
import { RequestsProvider } from '@/lib/RequestsContext'
import { router } from '@/routes'

function App() {
  return (
    <AuthProvider>
      <ItemsProvider>
        <RequestsProvider>
          <RouterProvider router={router} />
        </RequestsProvider>
      </ItemsProvider>
    </AuthProvider>
  )
}

export default App
