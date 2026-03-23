import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { App } from 'antd'
import { AuthProvider } from './hooks/useAuth'
import { router } from './routes'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </App>
  </StrictMode>,
)
