// frontend/src/components/layout/sidebar.tsx — NeoStills v4
import { Link, useRouterState } from '@tanstack/react-router'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import {
  type LucideIcon,
  LayoutDashboard, Beaker, FlaskConical, BookOpen,
  Package, ShoppingCart, FileText, Settings,
  ChevronLeft, ChevronRight, Cpu, Archive, BarChart3, Bot,
  Droplets, Users, GraduationCap, Sparkles,
} from 'lucide-react'
import { useUIStore } from '@/stores/ui-store'
import { useAuthStore } from '@/stores/auth-store'
import { useAvatarStore } from '@/stores/avatar-store'
import { Logo } from '@/components/ui/logo'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  icon: LucideIcon
  labelKey: string
}

interface NavGroup {
  labelKey: string | null
  tone: 'steel' | 'copper' | 'cobalt' | 'cyan'
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    labelKey: null,
    tone: 'steel',
    items: [
      { to: '/', icon: LayoutDashboard, labelKey: 'nav.overview' },
    ],
  },
  {
    labelKey: 'nav.group_brew',
    tone: 'copper',
    items: [
      { to: '/brewing', icon: Beaker, labelKey: 'nav.brew_day' },
      { to: '/fermentation', icon: FlaskConical, labelKey: 'nav.fermentation' },
      { to: '/recipes', icon: BookOpen, labelKey: 'nav.recipes' },
      { to: '/water-lab', icon: Droplets, labelKey: 'nav.water_lab' },
    ],
  },
  {
    labelKey: 'nav.group_ops',
    tone: 'steel',
    items: [
      { to: '/inventory', icon: Package, labelKey: 'nav.inventory' },
      { to: '/procurement', icon: ShoppingCart, labelKey: 'nav.procurement' },
      { to: '/pool-buying', icon: Users, labelKey: 'nav.pool_buying' },
      { to: '/suppliers', icon: FileText, labelKey: 'nav.suppliers' },
    ],
  },
  {
    labelKey: 'nav.group_gear',
    tone: 'cyan',
    items: [
      { to: '/devices', icon: Cpu, labelKey: 'nav.devices' },
      { to: '/keezer', icon: Archive, labelKey: 'nav.keezer' },
    ],
  },
  {
    labelKey: 'nav.group_insights',
    tone: 'cobalt',
    items: [
      { to: '/analytics', icon: BarChart3, labelKey: 'nav.analytics' },
      { to: '/ai-chat', icon: Bot, labelKey: 'nav.ai_assistant' },
      { to: '/avatar-config', icon: Sparkles, labelKey: 'nav.avatar_config' },
      { to: '/brew-academy', icon: GraduationCap, labelKey: 'nav.brew_academy' },
    ],
  },
]

const bottomNav: NavItem[] = [
  { to: '/settings', icon: Settings, labelKey: 'nav.settings' },
]

export function Sidebar() {
  const { t } = useTranslation('common')
  const { sidebarCollapsed, toggleSidebar } = useUIStore()
  const { user } = useAuthStore()
  const avatarConfig = useAvatarStore((s) => s.config)
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname

  const isActive = (to: string) =>
    to === '/' ? currentPath === '/' : currentPath.startsWith(to)

  const handleClick = (to: string) => {
    if (to === '#ai') {
      useUIStore.getState().openAiPanel()
    }
  }

  const toneAccent: Record<NavGroup['tone'], string> = {
    steel: 'var(--accent-steel)',
    copper: 'var(--accent-copper)',
    cobalt: 'var(--accent-cobalt)',
    cyan: 'var(--accent-cyan)',
  }

  const renderItem = ({ to, icon: Icon, labelKey }: NavItem, accent: string) => {
    const active = to !== '#ai' && isActive(to)
    const content = (
      <div
        className={cn(
          'neo-sidebar__item',
          active && 'neo-sidebar__item--active',
          sidebarCollapsed && 'justify-center px-0',
        )}
        title={sidebarCollapsed ? t(labelKey) : undefined}
        aria-current={active ? 'page' : undefined}
        onClick={() => handleClick(to)}
      >
        <Icon size={18} className="shrink-0 neo-sidebar__icon" />
        <AnimatePresence>
          {!sidebarCollapsed && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              className="neo-sidebar__label overflow-hidden whitespace-nowrap"
            >
              {t(labelKey)}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    )

    if (to === '#ai') {
      return <div key={to} className="cursor-pointer">{content}</div>
    }

    return (
      <Link key={to} to={to}>
        {content}
      </Link>
    )
  }

  return (
    <aside
      className="neo-sidebar hidden md:flex flex-col h-full overflow-hidden"
      data-collapsed={sidebarCollapsed ? 'true' : 'false'}
      role="navigation"
      aria-label={t('nav.main_navigation', 'Main navigation')}
    >
      {/* Logo */}
      <div className="neo-sidebar__logo flex items-center" style={{ justifyContent: sidebarCollapsed ? 'center' : 'flex-start' }}>
        <AnimatePresence mode="wait">
          {!sidebarCollapsed ? (
            <motion.div
              key="full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="overflow-hidden"
            >
              <img
                src="/assets/neostills/logo-neostills.svg"
                alt="NeoStills"
                style={{ width: 168, height: 'auto', display: 'block', filter: 'drop-shadow(0 4px 14px rgba(184,115,51,0.30))' }}
                onError={(e) => {
                  const img = e.target as HTMLImageElement
                  if (img.src.endsWith('.svg')) img.src = '/assets/neostills/logo-neostills.png'
                }}
              />
            </motion.div>
          ) : (
            <motion.div key="icon" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mx-auto">
              <img
                src="/assets/neostills/logo-neostills-mark.png"
                alt="NS"
                className="h-9 w-9 object-contain"
                onError={(e) => {
                  const img = e.target as HTMLImageElement
                  if (!img.src.endsWith('.svg')) img.src = '/assets/neostills/logo-neostills-mark.svg'
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 py-2 px-2 overflow-y-auto no-scrollbar" aria-label={t('nav.main_navigation', 'Site navigation')}>
        {navGroups.map((group, gi) => (
          <div key={gi}>
            {group.labelKey && !sidebarCollapsed && (
              <div className="neo-sidebar__section-title">{t(group.labelKey)}</div>
            )}
            {group.labelKey && sidebarCollapsed && (
              <div className="h-px bg-white/[0.06] mx-2 my-3" />
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => renderItem(item, toneAccent[group.tone]))}
            </div>
          </div>
        ))}
      </nav>

      {/* Avatar mini-preview */}
      {avatarConfig.enabled && avatarConfig.imageUrl && !sidebarCollapsed && (
        <Link to="/avatar-config" className="block mx-3 mb-2">
          <div className="flex items-center gap-2.5 p-2 rounded-xl glass-card border border-white/[0.06] hover:border-accent-purple/30 transition-all group cursor-pointer">
            <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-accent-purple/30 ring-2 ring-accent-purple/10">
              <img src={avatarConfig.imageUrl} alt="Avatar" className="w-full h-full object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium text-text-primary truncate">{t('nav.avatar_config')}</p>
              <p className="text-[9px] text-accent-purple flex items-center gap-1">
                <Sparkles size={8} />
                Activo
              </p>
            </div>
          </div>
        </Link>
      )}
      {avatarConfig.enabled && sidebarCollapsed && (
        <Link to="/avatar-config" className="flex justify-center mb-2" title={t('nav.avatar_config')}>
          <div className="w-8 h-8 rounded-full overflow-hidden border border-accent-purple/30 ring-2 ring-accent-purple/10">
            {avatarConfig.imageUrl ? (
              <img src={avatarConfig.imageUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-accent-purple/10">
                <Sparkles size={12} className="text-accent-purple" />
              </div>
            )}
          </div>
        </Link>
      )}

      {/* Bottom: settings + user avatar */}
      <div className="border-t border-white/[0.06]">
        <div className="px-2 py-2 space-y-0.5">
          {bottomNav.map((item) => renderItem(item, toneAccent.steel))}
        </div>

        {/* User avatar */}
        {!sidebarCollapsed && user && (
          <div className="flex items-center gap-2.5 px-3 pb-3">
            <div className="w-8 h-8 rounded-full bg-accent-amber/20 border border-accent-amber/30 flex items-center justify-center shrink-0">
              <span className="text-xs font-semibold text-accent-amber">
                {user.full_name?.charAt(0).toUpperCase() ?? 'U'}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-text-primary truncate">{user.full_name}</p>
              <p className="text-2xs text-text-tertiary truncate">{user.email}</p>
            </div>
          </div>
        )}

        {/* Collapse button */}
        <div className="px-2 pb-2">
          <button
            onClick={toggleSidebar}
            className="neo-sidebar__item w-full justify-center opacity-60 hover:opacity-100"
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
              {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
      </div>
    </aside>
  )
}
