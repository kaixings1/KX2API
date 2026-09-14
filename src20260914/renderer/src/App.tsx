import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { MainLayout } from '@/components/layout/MainLayout'
import { TrayView } from '@/components/Tray/TrayView'
import { Toaster } from '@/components/ui/toaster'
import { Skeleton } from '@/components/ui/skeleton'
import { ChatPage } from '@/pages/Chat/ChatPage'
import { Dashboard } from '@/pages/Dashboard'
import PlanManagement from '@/pages/PlanManagement/PlanManagementPage'
import TaskManagement from '@/pages/TaskManagement/TaskManagementPage'
import GitManagement from '@/pages/GitManagement/GitManagementPage'
import AgentManagement from '@/pages/AgentManagement/AgentManagementPage'
import AgentDetailPage from '@/pages/AgentManagement/AgentDetailPage'
import CommandManagement from '@/pages/CommandManagement/CommandManagementPage'
import WorkflowManagement from '@/pages/WorkflowManagement/WorkflowManagementPage'
import WorkflowDetailPage from '@/pages/WorkflowManagement/WorkflowDetailPage'
import McpManagement from '@/pages/McpManagement/McpManagementPage'
import McpServerDetailPage from '@/pages/McpManagement/McpServerDetailPage'
import PluginManagement from '@/pages/PluginManagement/PluginManagementPage'
import PluginDetailPage from '@/pages/PluginManagement/PluginDetailPage'
import OtherConfig from '@/pages/OtherConfig/OtherConfigPage'
import ToolManagement from '@/pages/ToolManagement/ToolManagementPage'
import ToolDetailPage from '@/pages/ToolManagement/ToolDetailPage'
import PlanDetailPage from '@/pages/PlanManagement/PlanDetailPage'
const PromptsManagement = lazy(() => import('@/pages/Prompts/PromptsManagement').then(m => ({ default: m.PromptsManagement })))

const Providers = lazy(() => import('@/pages/Providers').then(m => ({ default: m.Providers })))
const ProxySettings = lazy(() => import('@/pages/ProxySettings').then(m => ({ default: m.ProxySettings })))
const Models = lazy(() => import('@/pages/Models').then(m => ({ default: m.Models })))
const ApiKeys = lazy(() => import('@/pages/ApiKeys'))
const Logs = lazy(() => import('@/pages/Logs'))
const Settings = lazy(() => import('@/pages/Settings').then(m => ({ default: m.Settings })))
const About = lazy(() => import('@/pages/About').then(m => ({ default: m.About })))
const Profiles = lazy(() => import('@/pages/Profiles').then(m => ({ default: m.Profiles })))
const SessionManagement = lazy(() => import('@/pages/SessionManagement').then(m => ({ default: m.SessionManagement })))
const TeamTask = lazy(() => import('@/pages/TeamTask/TeamTaskPage').then(m => ({ default: m.TeamTaskPage })))
const CookieSessionPage = lazy(() => import('@/pages/CookieSessionPage').then(m => ({ default: m.default })))

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="space-y-4 w-full max-w-md">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-32 w-full" />
      </div>
    </div>
  )
}

function App() {
  return (
    <>
      <Routes>
        <Route path="/tray" element={<TrayView />} />
        <Route element={<MainLayout />}>
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/" element={<Suspense fallback={<PageLoader />}><Dashboard /></Suspense>} />
          <Route path="/providers" element={<Suspense fallback={<PageLoader />}><Providers /></Suspense>} />
          <Route path="/plans" element={<Suspense fallback={<PageLoader />}><PlanManagement /></Suspense>} />
          <Route path="/tasks" element={<Suspense fallback={<PageLoader />}><TaskManagement /></Suspense>} />
          <Route path="/git" element={<Suspense fallback={<PageLoader />}><GitManagement /></Suspense>} />
          <Route path="/agents" element={<Suspense fallback={<PageLoader />}><AgentManagement /></Suspense>} />
          <Route path="/agents/:id" element={<Suspense fallback={<PageLoader />}><AgentDetailPage /></Suspense>} />
          <Route path="/commands" element={<Suspense fallback={<PageLoader />}><CommandManagement /></Suspense>} />
          <Route path="/workflows" element={<Suspense fallback={<PageLoader />}><WorkflowManagement /></Suspense>} />
          <Route path="/workflows/:id" element={<Suspense fallback={<PageLoader />}><WorkflowDetailPage /></Suspense>} />
          <Route path="/mcp" element={<Suspense fallback={<PageLoader />}><McpManagement /></Suspense>} />
          <Route path="/mcp/:id" element={<Suspense fallback={<PageLoader />}><McpServerDetailPage /></Suspense>} />
          <Route path="/plugins" element={<Suspense fallback={<PageLoader />}><PluginManagement /></Suspense>} />
          <Route path="/plugins/:id" element={<Suspense fallback={<PageLoader />}><PluginDetailPage /></Suspense>} />
          <Route path="/proxy" element={<Suspense fallback={<PageLoader />}><ProxySettings /></Suspense>} />
          <Route path="/models" element={<Suspense fallback={<PageLoader />}><Models /></Suspense>} />
          <Route path="/api-keys" element={<Suspense fallback={<PageLoader />}><ApiKeys /></Suspense>} />
          <Route path="/logs" element={<Suspense fallback={<PageLoader />}><Logs /></Suspense>} />
          <Route path="/session" element={<Suspense fallback={<PageLoader />}><SessionManagement /></Suspense>} />
          <Route path="/cookie-session" element={<Suspense fallback={<PageLoader />}><CookieSessionPage /></Suspense>} />
          <Route path="/settings" element={<Suspense fallback={<PageLoader />}><Settings /></Suspense>} />
          <Route path="/profiles" element={<Suspense fallback={<PageLoader />}><Profiles /></Suspense>} />
          <Route path="/other-config" element={<Suspense fallback={<PageLoader />}><OtherConfig /></Suspense>} />
          <Route path="/prompts" element={<Suspense fallback={<PageLoader />}><PromptsManagement /></Suspense>} />
          <Route path="/tools" element={<Suspense fallback={<PageLoader />}><ToolManagement /></Suspense>} />
          <Route path="/tools/:id" element={<Suspense fallback={<PageLoader />}><ToolDetailPage /></Suspense>} />
          <Route path="/plans" element={<Suspense fallback={<PageLoader />}><PlanManagement /></Suspense>} />
          <Route path="/plans/:id" element={<Suspense fallback={<PageLoader />}><PlanDetailPage /></Suspense>} />
          <Route path="/team" element={<Suspense fallback={<PageLoader />}><TeamTask /></Suspense>} />
          <Route path="/about" element={<Suspense fallback={<PageLoader />}><About /></Suspense>} />
        </Route>
      </Routes>
      <Toaster />
    </>
  )
}

export default App
