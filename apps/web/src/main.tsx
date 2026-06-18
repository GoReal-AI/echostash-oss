import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createBrowserRouter } from 'react-router-dom'
import { Layout } from './Layout'
import './index.css'
import { PromptDetail } from './pages/PromptDetail'
import { Registry } from './pages/Registry'

const queryClient = new QueryClient()

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Registry /> },
      { path: '/prompts/:id', element: <PromptDetail /> },
    ],
  },
])

const root = document.getElementById('root')
if (!root) throw new Error('missing #root')

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
