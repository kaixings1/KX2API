import { useState } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  MessageSquare,
  LayoutDashboard,
  Server,
  Settings2,
  FileText,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Key,
  Cpu,
  Info,
  AlertTriangle,
  Plug,
  Users,
  Calendar,
  CheckSquare,
  GitBranch,
  Bot,
  Terminal,
  Workflow,
  Puzzle,
  Wrench,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSettingsStore } from '@/stores/settingsStore'
import { useNavigationStore } from '@/stores/navigationStore'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface NavItem {
  titleKey: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  { label: '核心', items: [
    { titleKey: 'nav.chat', href: '/chat', icon: MessageSquare },
    { titleKey: 'nav.dashboard', href: '/', icon: LayoutDashboard },
  ]},
  { label: '数据管理', items: [
    { titleKey: 'nav.plans', href: '/plans', icon: Calendar },
    { titleKey: 'nav.tasks', href: '/tasks', icon: CheckSquare },
    { titleKey: 'nav.logs', href: '/logs', icon: FileText },
    { titleKey: 'nav.session', href: '/session', icon: MessageSquare },
    { titleKey: 'nav.cookieSession', href: '/cookie-session', icon: MessageSquare },
    { titleKey: 'nav.prompts', href: '/prompts', icon: FileText },
  ]},
  { label: '开发工具', items: [
    { titleKey: 'nav.providers', href: '/providers', icon: Server },
    { titleKey: 'nav.git', href: '/git', icon: GitBranch },
    { titleKey: 'nav.agents', href: '/agents', icon: Bot },
    { titleKey: 'nav.commands', href: '/commands', icon: Terminal },
    { titleKey: 'nav.workflows', href: '/workflows', icon: Workflow },
    { titleKey: 'nav.team', href: '/team', icon: Users },
  ]},
  { label: '集成管理', items: [
    { titleKey: 'nav.mcp', href: '/mcp', icon: Plug },
    { titleKey: 'nav.plugins', href: '/plugins', icon: Puzzle },
    { titleKey: 'nav.tools', href: '/tools', icon: Cpu },
  ]},
  { label: '系统', items: [
    { titleKey: 'nav.proxy', href: '/proxy', icon: Settings2 },
    { titleKey: 'nav.models', href: '/models', icon: Cpu },
    { titleKey: 'nav.apiKeys', href: '/api-keys', icon: Key },
    { titleKey: 'nav.profiles', href: '/profiles', icon: Plug },
    { titleKey: 'nav.otherConfig', href: '/other-config', icon: Wrench },
    { titleKey: 'nav.settings', href: '/settings', icon: Settings },
    { titleKey: 'nav.about', href: '/about', icon: Info },
  ]},
]

function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="tooltip-container">
      {children}
      <div className="tooltip-content">
        {label}
        <div className="tooltip-arrow" />
      </div>
    </div>
  )
}

export function Sidebar() {
  const { t } = useTranslation()
  const { sidebarCollapsed, toggleSidebar } = useSettingsStore()
  const { blockers, isDialogOpen, confirmNavigation, cancelNavigation } = useNavigationStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [pendingHref, setPendingHref] = useState<string | null>(null)

  const hasBlockers = blockers.length > 0

  const handleNavigation = (href: string) => {
    if (hasBlockers && location.pathname !== href) {
      setPendingHref(href)
    } else {
      navigate(href)
    }
  }

  const handleConfirmNavigation = () => {
    if (pendingHref) {
      navigate(pendingHref)
      setPendingHref(null)
    }
    confirmNavigation()
  }

  const handleCancelNavigation = () => {
    setPendingHref(null)
    cancelNavigation()
  }

  return (
    <>
      <aside
        className={cn(
          'glass-sidebar flex flex-col transition-all duration-300 ease-in-out',
          sidebarCollapsed ? 'w-[72px]' : 'w-64'
        )}
      >
        <nav className="flex-1 p-3 space-y-1 overflow-x-hidden overflow-y-auto pt-5">
          {navGroups.map(group => (
            <div key={group.label} className="space-y-1">
              {!sidebarCollapsed && (
                <p className="px-2 py-1 text-xs text-muted-foreground font-medium">{group.label}</p>
              )}
              {group.items.map(item => {
                const title = t(item.titleKey)
                const buttonContent = (
                  <div
                    onClick={(e) => {
                      if (hasBlockers && location.pathname !== item.href) {
                        e.preventDefault()
                        handleNavigation(item.href)
                      }
                    }}
                    className="block"
                  >
                    <NavLink
                      to={item.href}
                      onClick={(e) => {
                        if (hasBlockers && location.pathname !== item.href) {
                          e.preventDefault()
                        }
                      }}
                      className={({ isActive }) =>
                        cn(
                          'sidebar-nav-item',
                          sidebarCollapsed ? 'collapsed' : 'expanded',
                          isActive ? 'active' : 'inactive'
                        )
                      }
                    >
                      <item.icon className="h-5 w-5 flex-shrink-0" />
                      <span
                        className={cn(
                          'whitespace-nowrap transition-all duration-300',
                          sidebarCollapsed ? 'w-0 opacity-0 overflow-hidden' : 'w-auto opacity-100'
                        )}
                      >
                        {title}
                      </span>
                    </NavLink>
                  </div>
                )
                if (sidebarCollapsed) {
                  return <Tooltip key={item.href} label={title}>{buttonContent}</Tooltip>
                }
                return <div key={item.href}>{buttonContent}</div>
              })}
            </div>
          ))}
        </nav>

        <div className="mx-4 border-t border-[var(--glass-border)] opacity-50" />

        <div className="p-3 overflow-hidden flex justify-center">
          <button
            className="sidebar-collapse-btn"
            onClick={toggleSidebar}
            aria-label={sidebarCollapsed ? t('settings.sidebarCollapsedHelp') : t('settings.sidebarCollapsedHelp')}
            title={sidebarCollapsed ? t('settings.sidebarCollapsedHelp') : t('settings.sidebarCollapsedHelp')}
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen className="h-5 w-5" />
            ) : (
              <PanelLeftClose className="h-5 w-5" />
            )}
          </button>
        </div>
      </aside>

      <Dialog open={isDialogOpen} onOpenChange={(open) => !open && handleCancelNavigation()}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {t('proxy.unsavedChangesTitle')}
            </DialogTitle>
            <DialogDescription>
              {blockers[0]?.message || t('proxy.unsavedChangesDescription')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleCancelNavigation}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmNavigation}
            >
              {t('proxy.discardAndLeave')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
