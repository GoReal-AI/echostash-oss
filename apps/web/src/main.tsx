import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createBrowserRouter } from 'react-router-dom'
import { Layout } from './Layout'
import './index.css'
import { Dashboard } from './pages/Dashboard'
import { DatasetDetail } from './pages/DatasetDetail'
import { Datasets } from './pages/Datasets'
import { EvalDetail } from './pages/EvalDetail'
import { Evals } from './pages/Evals'
import { Observability } from './pages/Observability'
import { ProjectDetail } from './pages/ProjectDetail'
import { Projects } from './pages/Projects'
import { PromptDetail } from './pages/PromptDetail'
import { Prompts } from './pages/Prompts'
import { Sandbox } from './pages/Sandbox'
import { Scorers } from './pages/Scorers'
import { Settings } from './pages/Settings'
import { Sources } from './pages/Sources'
import { Storage } from './pages/Storage'

const queryClient = new QueryClient()

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Dashboard /> },
      { path: '/projects', element: <Projects /> },
      { path: '/projects/:id', element: <ProjectDetail /> },
      { path: '/prompts', element: <Prompts /> },
      { path: '/prompts/:id', element: <PromptDetail /> },
      { path: '/sandbox', element: <Sandbox /> },
      { path: '/datasets', element: <Datasets /> },
      { path: '/datasets/:id', element: <DatasetDetail /> },
      { path: '/scorers', element: <Scorers /> },
      { path: '/evals', element: <Evals /> },
      { path: '/evals/:id', element: <EvalDetail /> },
      { path: '/observability', element: <Observability /> },
      { path: '/storage', element: <Storage /> },
      { path: '/sources', element: <Sources /> },
      { path: '/settings', element: <Settings /> },
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
