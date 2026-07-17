import { RouterProvider } from 'react-router-dom'
import { AuthProvider } from '@/lib/AuthContext'
import { ItemsProvider } from '@/lib/ItemsContext'
import { router } from '@/routes'

function App() {
  return (
    <AuthProvider>
      <ItemsProvider>
        <RouterProvider router={router} />
      </ItemsProvider>
    </AuthProvider>
  )
}

export default App
