import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from '@tanstack/react-router'
import { motion } from 'framer-motion'
import {
  type LucideIcon,
  Package,
  Beaker,
  FlaskConical,
  AlertTriangle,
  Thermometer,
  Droplets,
  ArrowRight,
  Activity,
  CheckCircle2,
  Cpu,
  Sparkles,
  Wifi,
  ChevronDown,
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line,
} from 'recharts'
import { useAuthStore } from '@/stores/auth-store'
import { useUIStore } from '@/stores/ui-store'
import { useInventory, useInventoryAlerts } from '@/hooks/use-inventory'
import { useBrewSessions } from '@/hooks/use-brewing'
import { useActiveFermentations, useLatestISpindelReading } from '@/hooks/use-fermentation'
import { cn, daysUntilExpiry, formatDate } from '@/lib/utils'

/** Intenta cargar el PNG; si no existe (404) cae al SVG de respaldo */
const svgFallback = (svgSrc: string) => (e: React.SyntheticEvent<HTMLImageElement>) => {
  const img = e.currentTarget
  if (!img.src.endsWith('.svg')) img.src = svgSrc
}

const card = (i: number) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease: 'easeOut' as const, delay: i * 0.06 },
})

const SPARK_PATTERNS = [
  [0.54, 0.62, 0.58, 0.66, 0.64, 0.7, 0.68],
  [0.32, 0.48, 0.44, 0.58, 0.52, 0.62, 0.74],
  [0.62, 0.58, 0.72, 0.66, 0.7, 0.78, 0.75],
  [0.4, 0.45, 0.43, 0.5, 0.56, 0.55, 0.61],
] as const

const buildSparkline = (pattern: readonly number[], base: number) => {
  const amplitude = Math.max(base, 1.6)
  return pattern.map((value, index) => ({
    x: index,
    v: Number((value * amplitude).toFixed(2)),
  }))
}

// Inline SVG components removed — replaced by premium external SVG assets
// in frontend/public/assets/neostills/ (still-pot-copper.svg, still-column-copper.svg,
// fermenter-copper.svg, barrels-premium.svg). Referenced via <img> tags below.

function AiThinkingOrb() {
  return (
    <div className="orb-monitor shrink-0" aria-hidden="true">
      <div className="orb-monitor__ring" />
      <div className="orb-monitor__core" />
      <div className="orb-monitor__electron" />
    </div>
  )
}

function MicroTrend({ id, data, stroke, fill }: { id: string; data: Array<{ x: number; v: number }>; stroke: string; fill: string }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={fill} stopOpacity={0.38} />
            <stop offset="100%" stopColor={fill} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={stroke} strokeWidth={1.8} fill={`url(#${id})`} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

function FermenterMini({ session }: { session: { id: number; brew_session_name: string; started_at: string } }) {
  const { data: reading } = useLatestISpindelReading(session.id)
  const daysSinceStart = Math.max(1, Math.round((Date.now() - new Date(session.started_at).getTime()) / 86_400_000))
  const gravity = (reading as unknown as { gravity?: number })?.gravity
  const temperature = (reading as unknown as { temperature?: number })?.temperature

  return (
    <Link to="/fermentation" className="block h-full cursor-pointer hover:-translate-y-1 transition-transform">
      <div className="neo-card p-4 h-full relative overflow-hidden transition-all hover:neo-card-glow hover:shadow-glow">
        <div className="flex items-center justify-between gap-2 mb-4">
          <div>
            <p className="text-neo-text-soft !text-[9px] !tracking-[0.18em] uppercase">LIVE FERMENTATION</p>
            <p className="text-sm text-neo-text font-medium truncate mt-1">{session.brew_session_name}</p>
          </div>
          <span className="bg-neo-bg-800 border border-neo-cyan/30 text-neo-cyan px-2.5 py-1 text-[10px] rounded-full flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-neo-cyan animate-pulse" />
            Día {daysSinceStart}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-neo-border/60 bg-neo-bg-900/50 p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-neo-text-muted">
              <Droplets size={11} className="text-neo-copper" /> SG
            </div>
            <div className="mt-2 text-xl font-display font-semibold text-neo-text tabular-nums">{gravity?.toFixed(3) ?? '—'}</div>
          </div>
          <div className="rounded-xl border border-neo-border/60 bg-neo-bg-900/50 p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-neo-text-muted">
              <Thermometer size={11} className="text-neo-copper" /> TEMP
            </div>
            <div className="mt-2 text-xl font-display font-semibold text-neo-cyan tabular-nums drop-shadow-glow">
              {temperature?.toFixed(1) ?? '—'}{temperature ? '°C' : ''}
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}

/* ── KPI card — large still asset on right ── */
interface MetricCardProps {
  to: '/' | '/inventory' | '/brewing' | '/fermentation' | '/keezer' | '/devices'
  label: string
  value: number | string
  note: string
  icon: LucideIcon
  pattern: readonly number[]
  sparkColor: string
  glow?: boolean
  live?: boolean
  assetSrc?: string
  assetFallback?: string
}

function DashboardMetricCard({ to, label, value, note, icon: Icon, pattern, sparkColor, glow = false, live = false, assetSrc, assetFallback }: MetricCardProps) {
  const spark = typeof value === 'number' ? buildSparkline(pattern, value) : buildSparkline(pattern, 4)
  const gradientFill = live ? 'rgba(34, 211, 238, 0.45)' : 'rgba(184, 115, 51, 0.45)'
  const trendId = `metric-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`

  return (
    <Link to={to} className="block h-full">
      <div className={cn(
        'neo-card neo-kpi-card h-full relative overflow-hidden transition-all hover:-translate-y-1 hover:shadow-elevated flex flex-col',
        glow && 'neo-card-glow shadow-glow-lg border-neo-cyan/40'
      )}>
        {/* Premium asset — PNG preferred, SVG fallback */}
        {assetSrc && (
          <>
            <img
              src={assetSrc}
              alt=""
              aria-hidden="true"
              className="neo-kpi-asset"
              {...(assetFallback ? { onError: svgFallback(assetFallback) } : {})}
            />
            {/* Soft mask — keeps left text legible without dimming the still */}
            <div className="neo-kpi-card__mask pointer-events-none" />
          </>
        )}

        <div className="relative z-10 p-5 flex flex-col h-full">
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="text-[11px] uppercase tracking-[0.18em] text-neo-text-muted font-medium">{label}</p>
            <div className={cn(
              'w-7 h-7 rounded-xl border flex items-center justify-center shrink-0',
              live ? 'border-neo-cyan/30 bg-neo-cyan/10' : 'border-neo-copper/30 bg-neo-copper/10',
            )}>
              <Icon size={13} className={cn(live ? 'text-neo-cyan' : 'text-neo-copper')} />
            </div>
          </div>

          <span className={cn(
            'text-[3.2rem] leading-none font-display font-bold mt-3',
            live ? 'text-neo-cyan drop-shadow-glow' : 'text-neo-text'
          )}>{value}</span>

          <p className={cn('text-xs font-medium mt-1.5', live ? 'text-neo-cyan' : 'text-neo-copper')}>{note}</p>

          <div className="mt-auto pt-3">
            <div className="flex items-center justify-between text-[9px] uppercase tracking-[0.14em] text-neo-text-muted mb-1">
              <span>Sparklines</span>
              <span className={cn(live ? 'text-neo-cyan' : 'text-neo-text-soft', 'flex items-center gap-1')}>
                {live && <span className="w-1 h-1 rounded-full bg-neo-cyan inline-block animate-pulse" />}
                {live ? 'LIVE' : '7d'}
              </span>
            </div>
            <div className="h-8">
              <MicroTrend id={trendId} data={spark} stroke={sparkColor} fill={gradientFill} />
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}

/* ── IoT status card ── */
function IotStatusCard() {
  return (
    <Link to="/devices" className="block h-full">
      <div className="neo-card neo-card-glow h-full p-5 relative overflow-hidden transition-all hover:-translate-y-1 hover:shadow-elevated flex flex-col">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[10px] uppercase tracking-[0.22em] text-neo-text-muted">IoT</p>
          <div className="w-7 h-7 rounded-xl border border-neo-cyan/30 bg-neo-cyan/10 flex items-center justify-center shrink-0">
            <Cpu size={13} className="text-neo-cyan" />
          </div>
        </div>
        <p className="text-sm text-neo-text-soft font-medium mt-1">Sensores Online:</p>
        <span className="text-[2.8rem] leading-none font-display font-bold text-neo-cyan drop-shadow-glow mt-1">12/12</span>

        <div className="mt-auto pt-4 space-y-2">
          {[
            { label: 'Temp. columna', value: '92°C', warn: true },
            { label: 'Presión L4', value: '1.8 bar', warn: false },
            { label: 'Flujo', value: '18 L/h', warn: false },
          ].map(({ label, value, warn }) => (
            <div key={label} className="flex items-center justify-between text-[11px]">
              <span className="text-neo-text-soft">{label}</span>
              <span className={cn('font-mono font-medium', warn ? 'text-neo-red' : 'text-neo-cyan')}>{value}</span>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between text-[10px] text-neo-text-muted hover:text-neo-copper transition-colors">
          <span>Ver sensores</span>
          <ArrowRight size={10} />
        </div>
      </div>
    </Link>
  )
}

/* ── Process analysis chart inside Genio Destilador ── */
const ANALYSIS_DATA = [
  { name: 'Lun', value: 58, pred: 62 },
  { name: 'Mar', value: 72, pred: 68 },
  { name: 'Mié', value: 65, pred: 70 },
  { name: 'Jue', value: 88, pred: 80 },
  { name: 'Vie', value: 75, pred: 82 },
  { name: 'Sáb', value: 92, pred: 88 },
  { name: 'Dom', value: 84, pred: 90 },
]

function ProcessAnalysisChart() {
  return (
    <div className="rounded-xl border border-neo-cyan/20 bg-gradient-to-br from-[rgba(7,21,38,0.92)] to-[rgba(4,12,22,0.88)] p-4 shadow-inner">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] font-medium text-neo-text-muted mb-1.5">
        <span className="flex items-center gap-2"><Activity size={12} className="text-neo-cyan drop-shadow-glow" /> Análisis de procesos</span>
        <span className="text-neo-text-soft border border-neo-border/50 rounded px-2.5 py-0.5 flex items-center gap-1 text-[9px]">7 días <ChevronDown size={9} /></span>
      </div>
      <div className="h-28 mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={ANALYSIS_DATA} margin={{ top: 6, right: 6, left: -26, bottom: 2 }}>
            <defs>
              <linearGradient id="genioFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22D3EE" stopOpacity={0.50} />
                <stop offset="100%" stopColor="#22D3EE" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="genioPredFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#D89B63" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#D89B63" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,170,220,0.12)" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: 'rgba(215,229,245,0.72)', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'rgba(215,229,245,0.72)', fontSize: 10 }} axisLine={false} tickLine={false} />
            <Area type="monotone" dataKey="pred" stroke="#D89B63" strokeWidth={1.8} fill="url(#genioPredFill)" strokeDasharray="5 4" isAnimationActive={false} />
            <Area type="monotone" dataKey="value" stroke="#22D3EE" strokeWidth={2.8} fill="url(#genioFill)" isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[10px]">
        <span className="text-neo-text-muted uppercase tracking-wider">Recomendado</span>
        <span className="text-neo-text-muted uppercase tracking-wider">Predicción</span>
        {[
          { label: 'Etapa', pct: '+6.2%' },
          { label: 'Color', pct: '+3.8%' },
          { label: 'Flujo', pct: '+2.1%' },
          { label: 'Tiempo', pct: '+1.0%' },
        ].map(({ label, pct }) => (
          <>
            <div key={`l-${label}`} className="flex items-center gap-2">
              <div className="h-1 rounded-full bg-gradient-to-r from-neo-copper to-neo-cyan flex-1" />
              <span className="text-neo-text-soft w-8 shrink-0">{label}</span>
            </div>
            <span key={`p-${label}`} className="text-neo-green font-mono font-medium">{pct}</span>
          </>
        ))}
      </div>
    </div>
  )
}

/* ── Activity bar chart with legend ── */
const ACTIVITY_DATA = [
  { name: 'Lun', destilacion: 65, fermentacion: 30, maduracion: 20 },
  { name: 'Mar', destilacion: 90, fermentacion: 55, maduracion: 15 },
  { name: 'Mié', destilacion: 110, fermentacion: 40, maduracion: 25 },
  { name: 'Jue', destilacion: 145, fermentacion: 70, maduracion: 30 },
  { name: 'Vie', destilacion: 130, fermentacion: 85, maduracion: 45 },
  { name: 'Sáb', destilacion: 160, fermentacion: 60, maduracion: 50 },
  { name: 'Dom', destilacion: 140, fermentacion: 90, maduracion: 55 },
]

const ACTIVITY_LEGEND = [
  { label: 'Destilación 1', detail: '92°C', color: '#B87333' },
  { label: 'Fermentación 2', detail: '12°C', color: '#22E6FF' },
  { label: 'Fermentación 3', detail: '0°C', color: '#7B5CE6' },
  { label: 'Maduración 4', detail: '60%', color: '#C7A951' },
]

function ActivityChart() {
  const [range, setRange] = useState('7d')

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-3 mb-5">
        <div>
          <p className="text-[9px] uppercase tracking-[0.18em] text-neo-text-muted">ACTIVITY LOG</p>
          <h2 className="text-xl font-display font-semibold text-neo-text">Actividad</h2>
        </div>
        <button
          onClick={() => setRange(range === '7d' ? '30d' : '7d')}
          className="flex items-center gap-1.5 text-[11px] text-neo-text-soft border border-neo-border/50 rounded-lg px-3 py-1.5 hover:border-neo-copper/40 transition-colors"
        >
          Últimos {range === '7d' ? '7 días' : '30 días'}
          <ChevronDown size={11} />
        </button>
      </div>
      <div className="flex gap-4 flex-1">
        <div className="flex-1 min-w-0">
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={ACTIVITY_DATA} margin={{ top: 6, right: 6, left: -18, bottom: 2 }} barGap={4} barSize={14}>
              <defs>
                <linearGradient id="barCopper" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#E3A66E" />
                  <stop offset="100%" stopColor="#A96431" />
                </linearGradient>
                <linearGradient id="barCyan" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22E6FF" />
                  <stop offset="100%" stopColor="#0F8FB8" />
                </linearGradient>
                <linearGradient id="barGold" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F0A35A" />
                  <stop offset="100%" stopColor="#9A7E32" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,170,220,0.12)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: 'rgba(215,229,245,0.72)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'rgba(215,229,245,0.72)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#0D1F32', border: '1px solid rgba(82,183,224,0.35)', borderRadius: 10, fontSize: 11, padding: '8px 12px' }}
                labelStyle={{ color: '#EEF6FF', fontWeight: 500 }}
                cursor={{ fill: 'rgba(34,211,238,0.06)' }}
              />
              <Bar dataKey="destilacion" name="Destilación" fill="url(#barCopper)" radius={[5, 5, 0, 0]} />
              <Bar dataKey="fermentacion" name="Fermentación" fill="url(#barCyan)" radius={[5, 5, 0, 0]} />
              <Bar dataKey="maduracion" name="Maduración" fill="url(#barGold)" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {/* Right legend with bullet + label + detail */}
        <div className="shrink-0 flex flex-col justify-center gap-4 pr-1 min-w-[120px]">
          {ACTIVITY_LEGEND.map(({ label, detail, color }) => (
            <div key={label} className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
              <div className="text-[10px] leading-none">
                <p className="text-neo-text-soft font-medium">{label}</p>
                <p className="text-neo-text-muted mt-0.5">{detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── Barrels — horizontal layout ── */
interface BarrelsPanelProps {
  sessions: Array<{ id: number | string; name: string; phase: string }>
}

const BARREL_DEFAULTS = [
  { label: 'Barrica L1', pct: 2,  unit: '0.0 M.pgur' },
  { label: 'Barrica L2', pct: 23, unit: '23%' },
  { label: 'Barrica L3', pct: 30, unit: '30%' },
  { label: 'Barrica L4', pct: 68, unit: '68%' },
]

function BarrelsPanel({ sessions }: BarrelsPanelProps) {
  const aging = sessions.filter(s => ['aging', 'bottling', 'completed'].includes(s.phase))
  const items = aging.length >= 2
    ? aging.slice(0, 4).map((s, i) => ({
        label: s.name.length > 14 ? s.name.slice(0, 14) + '…' : s.name,
        pct: Math.min(95, 20 + i * 18),
        unit: `${Math.min(95, 20 + i * 18)}%`,
      }))
    : BARREL_DEFAULTS

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <p className="text-[9px] uppercase tracking-[0.18em] text-neo-text-muted">AGING ROOM</p>
          <h2 className="text-xl font-display font-semibold text-neo-text">Barricas</h2>
        </div>
      </div>
      {/* horizontal: barrel image | maturation status */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Barrel illustration — Prompt 7: bigger, more presence */}
        <div className="relative flex-1 min-w-0 rounded-xl border border-neo-border/40 bg-gradient-to-br from-[rgba(7,21,38,0.50)] to-[rgba(4,12,22,0.30)] overflow-hidden flex items-center justify-center p-2">
          <img
            src="/assets/neostills/barrels-hd.png"
            onError={svgFallback('/assets/neostills/barrels.png')}
            alt="Barricas en aging room"
            className="w-full neo-asset-img"
            style={{ maxWidth: 'min(100%, 500px)', filter: 'drop-shadow(0 18px 28px rgba(0,0,0,0.28)) drop-shadow(0 0 16px rgba(184,115,51,0.08))' }}
          />
          <div className="absolute top-2 left-2 bg-neo-bg-850/85 backdrop-blur border border-neo-cyan/40 rounded-full px-2 py-0.5 text-[9px] flex items-center gap-1.5">
            <Wifi size={8} className="text-neo-cyan animate-pulse" />
            <span className="text-neo-cyan font-mono">IoT LIVE</span>
          </div>
        </div>

        {/* Maturation status panel */}
        <div className="w-[155px] shrink-0 flex flex-col gap-1">
          <p className="text-[9px] uppercase tracking-[0.14em] text-neo-text-muted font-semibold mb-1">Estado de maduración</p>
          <div className="space-y-3 flex-1">
            {items.map(({ label, pct, unit }) => (
              <div key={label}>
                <div className="flex items-center justify-between text-[10px] mb-1">
                  <span className="text-neo-text-soft font-medium">{label}</span>
                  <span className="text-neo-text-muted font-mono text-[9px]">{unit}</span>
                </div>
                <div className="h-1.5 rounded-full bg-neo-bg-800 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${pct}%`,
                      background: pct < 5
                        ? 'rgba(184,115,51,0.35)'
                        : 'linear-gradient(to right, #7B4324, #B87333 60%, #C7A951)',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <Link to="/keezer" className="mt-3 flex items-center justify-between text-[10px] text-neo-text-muted hover:text-neo-copper transition-colors">
            <span>Ver Aging Room</span>
            <ArrowRight size={10} />
          </Link>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════════════════════════════════════ */
export default function DashboardPage() {
  useTranslation(['common', 'inventory', 'brewing'])
  const { user, brewery } = useAuthStore()
  const { setActivePage, openAiPanel } = useUIStore()

  useEffect(() => {
    setActivePage('dashboard')
  }, [setActivePage])

  const { data: inventoryData } = useInventory({ page_size: 200 })
  const { data: brewSessions } = useBrewSessions()
  const { data: fermentingSessions } = useBrewSessions('fermenting')
  const { lowStock, expiring } = useInventoryAlerts()
  const { data: activeFermentations } = useActiveFermentations()

  const ingredientCount = inventoryData?.total ?? 0
  const allSessions = Array.isArray(brewSessions) ? brewSessions : []
  const brewCount = allSessions.length
  const fermentingCount = Array.isArray(fermentingSessions) ? fermentingSessions.length : 0
  const lowStockItems = Array.isArray(lowStock.data) ? lowStock.data : []
  const lowStockCount = lowStockItems.length
  const expiringItems = Array.isArray(expiring.data) ? expiring.data : []
  const activeFerms = Array.isArray(activeFermentations) ? activeFermentations : []

  const readyToServe = useMemo(() =>
    allSessions.filter(s => ['aging', 'bottling', 'completed'].includes(s.phase)).length,
  [allSessions])

  const aiRecommendation = useMemo(() => {
    if (expiringItems.length > 0) {
      const names = expiringItems.slice(0, 2).map(i => i.name).join(', ')
      return { text: `He detectado ${names} con prioridad de rotación. Puedo proponerte un lote de aprovechamiento o un ajuste de receta para usarlos a tiempo.`, primary: 'Crear receta', secondary: 'Explorar recetas' }
    }
    if (lowStockCount > 0) {
      return { text: `${lowStockCount} ingredientes están por debajo del mínimo. Puedo preparar una compra técnica para granos, botánicos y levaduras según tus lotes activos.`, primary: 'Lista de compra', secondary: 'Explorar recetas' }
    }
    return { text: 'La operación está estable. Si quieres, preparo un nuevo lote, reviso tu agua de maceración o ajusto el siguiente corte de destilación.', primary: 'Nuevo lote', secondary: 'Explorar recetas' }
  }, [expiringItems, lowStockCount])

  const operatorName = user?.full_name?.split(' ')[0] ?? 'Admin'
  const latestBatchDate = allSessions[0]?.created_at ? formatDate(allSessions[0].created_at) : null

  type Alert = { id: string; type: 'danger' | 'warning' | 'success' | 'info'; title: string; time: string }
  const alerts: Alert[] = useMemo(() => {
    const list: Alert[] = []
    for (const item of expiringItems.slice(0, 2)) {
      const days = daysUntilExpiry(item.expiry_date ?? '')
      list.push({ id: `exp-${item.id}`, type: days <= 0 ? 'danger' : 'warning', title: days <= 0 ? `${item.name} — Caducado` : `${item.name} caduca en ${days}d`, time: 'Ahora' })
    }
    if (lowStockCount > 0) list.push({ id: 'ls', type: 'warning', title: `${lowStockCount} ingredientes — Stock bajo`, time: 'Ahora' })
    if (fermentingCount > 0) list.push({ id: 'fok', type: 'success', title: `${fermentingCount} fermentadores activos — estables`, time: 'Ahora' })
    if (list.length === 0) {
      list.push({ id: 'tc1', type: 'warning', title: 'Temp. Columna 3 High: 92°C', time: 'Ahora' })
      list.push({ id: 'tc2', type: 'warning', title: 'Temp. Columna 3 High: 92°C', time: '5 min' })
      list.push({ id: 'pl4', type: 'warning', title: 'Pressure Sensor L4 Error', time: '12 min' })
      list.push({ id: 'pl5', type: 'warning', title: 'Pressure Sensor L4 Error', time: '20 min' })
    }
    return list
  }, [expiringItems, lowStockCount, fermentingCount])

  const alertColor: Record<Alert['type'], string> = {
    danger: 'text-neo-red', warning: 'text-neo-amber', success: 'text-neo-green', info: 'text-neo-cyan',
  }

  const stats = [
    { icon: Package,      label: 'Inventario',    value: ingredientCount, note: expiringItems.length > 0 ? `${expiringItems.length} críticos` : 'Stock estable', to: '/inventory' as const, pattern: SPARK_PATTERNS[0], sparkColor: '#C79262', assetSrc: '/assets/neostills/still-column.png',       assetFallback: '/assets/neostills/still-column-copper.svg' },
    { icon: Beaker,       label: 'Lotes activos', value: brewCount,       note: brewCount > 0 ? 'En proceso' : 'Sin arranque',                                   to: '/brewing' as const,    pattern: SPARK_PATTERNS[1], sparkColor: '#D1A178', assetSrc: '/assets/neostills/still-pot.png',           assetFallback: '/assets/neostills/still-pot-copper.svg' },
    { icon: FlaskConical, label: 'Fermentación',  value: fermentingCount, note: fermentingCount > 0 ? 'Telemetría en vivo' : 'Sin actividad',                   to: '/fermentation' as const, pattern: SPARK_PATTERNS[2], sparkColor: '#22E6FF', glow: true, live: true, assetSrc: '/assets/neostills/fermenter.png', assetFallback: '/assets/neostills/fermenter-copper.svg' },
    { icon: CheckCircle2, label: 'Para servir',   value: readyToServe,    note: readyToServe > 0 ? 'En maduración' : 'Sin lote final',                          to: '/keezer' as const,     pattern: SPARK_PATTERNS[3], sparkColor: '#B87333', assetSrc: '/assets/neostills/still-pot-sm.png',        assetFallback: '/assets/neostills/still-pot-copper.svg' },
  ]

  return (
    <div className="neo-page-bg min-h-screen p-4 md:p-5 space-y-5">

      {/* Hero header */}
      <motion.section {...card(0)} className="grid xl:grid-cols-[1fr_auto] gap-4 items-end">
        <div>
          <p className="neo-eyebrow">SISTEMA OPERATIVO NEOSTILLS // Monitorización Activa</p>
          <h1 className="neo-hero-title mt-2">
            Bienvenido, <span className="accent">{operatorName}</span>
          </h1>
          <p className="neo-hero-subtitle">
            {brewery?.name ?? 'Tu destilería'} · {latestBatchDate ? `Último lote: ${latestBatchDate}` : 'Sin lotes aún'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          <span className="system-status-chip">
            <span className="iot-pulse-dot" />
            Sensores activos
            <span className="live-value font-mono">12/12</span>
          </span>
          <div className="neo-copper-split transition-all hover:-translate-y-px">
            <Link to="/brewing" className="neo-copper-split__main">
              <span className="text-base font-bold leading-none">+</span>
              Nuevo lote
            </Link>
            <span className="neo-copper-split__divider" />
            <button className="neo-copper-split__chevron" aria-label="Opciones de nuevo lote">
              <ChevronDown size={13} />
            </button>
          </div>
        </div>
      </motion.section>

      {/* KPI cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        {stats.map((stat, i) => (
          <motion.div key={stat.label} {...card(i + 1)} className="h-full">
            <DashboardMetricCard {...stat} />
          </motion.div>
        ))}
        <motion.div {...card(5)} className="h-full">
          <IotStatusCard />
        </motion.div>
      </section>

      {/* AI + New batch + Alerts */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-4">

        {/* Genio Destilador */}
        <motion.div {...card(6)} className="xl:col-span-5 neo-card neo-card-glow p-5 transition-all hover:shadow-glow-lg">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-3">
              <AiThinkingOrb />
              <div>
                <p className="text-[9px] uppercase tracking-[0.18em] text-neo-text-muted">AI CONTROL LAYER</p>
                <h2 className="text-lg font-display font-semibold text-neo-text">El Genio Destilador</h2>
              </div>
            </div>
            <span className="bg-neo-bg-850/80 backdrop-blur border border-neo-copper/30 text-neo-copper px-2.5 py-1 text-[9px] uppercase font-bold tracking-widest rounded-full flex items-center gap-1.5 shadow-glass">
              <Sparkles size={10} />Analizando
            </span>
          </div>
          <p className="text-sm text-neo-text-soft leading-relaxed">{aiRecommendation.text}</p>
          <div className="mt-4">
            <ProcessAnalysisChart />
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={openAiPanel} className="neo-copper-button inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold hover:-translate-y-px transition-all">
              <Sparkles size={13} className="opacity-70" />{aiRecommendation.primary}
            </button>
            <button className="px-4 py-2 rounded-xl text-sm font-medium text-neo-text-soft border border-neo-border hover:bg-white/5 transition-all">
              {aiRecommendation.secondary}
            </button>
          </div>
        </motion.div>

        {/* Create new batch */}
        <motion.div {...card(7)} className="xl:col-span-3 neo-card p-5 relative overflow-hidden flex flex-col">
          <img
            src="/assets/neostills/still-pot.png"
            onError={svgFallback('/assets/neostills/still-pot-copper.svg')}
            alt=""
            aria-hidden="true"
            className="neo-kpi-asset"
            style={{ width: 180, height: 180, right: 12, bottom: 12, opacity: 0.85 }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[rgba(10,23,38,0.97)] via-[rgba(10,23,38,0.65)] to-transparent pointer-events-none" />
          <div className="relative z-10 flex flex-col h-full">
            <p className="text-[9px] uppercase tracking-[0.18em] text-neo-text-muted">PROCESS CONTROL</p>
            <h2 className="text-xl font-display font-semibold text-neo-text mt-1 leading-snug">Crear nuevo lote<br />de producción</h2>
            <p className="text-sm text-neo-text-soft mt-2 leading-relaxed">Define tu receta, parámetros y comienza un nuevo lote.</p>
            <div className="grid grid-cols-3 gap-2 mt-4">
              {['Mashing', 'Cuts', 'Aging'].map((item, i) => (
                <div key={item} className="rounded-xl border border-neo-border/50 bg-neo-bg-900/50 backdrop-blur-md px-2 py-3 text-center">
                  <div className={cn('mx-auto mb-1.5 h-2 w-2 rounded-full', i === 1 ? 'bg-neo-cyan shadow-glow' : 'bg-neo-copper/80')} />
                  <p className="text-[9px] text-neo-text-muted uppercase tracking-[0.12em]">{item}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between gap-3 mt-auto pt-4">
              <span className="bg-neo-bg-850/80 backdrop-blur border border-neo-cyan/30 text-neo-cyan px-2.5 py-1 text-[9px] uppercase tracking-widest rounded-full flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-neo-cyan animate-pulse" />Modo listo
              </span>
              <div className="neo-copper-split hover:-translate-y-px transition-all">
                <Link to="/brewing" className="neo-copper-split__main !py-2 !px-4 text-xs">
                  <span className="font-bold leading-none">+</span>
                  Nuevo lote
                </Link>
                <span className="neo-copper-split__divider" />
                <button className="neo-copper-split__chevron !px-2.5" aria-label="Opciones">
                  <ChevronDown size={11} />
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Centro de alertas */}
        <motion.div {...card(8)} className="xl:col-span-4 neo-card p-5 flex flex-col">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-display font-semibold text-neo-text">Centro de alertas</h2>
            <Link to="/inventory" className="text-[10px] text-neo-copper hover:text-neo-text transition-colors uppercase tracking-[0.1em]">Ver todo</Link>
          </div>
          <div className="space-y-2.5 flex-1">
            {alerts.map(alert => (
              <div key={alert.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-neo-amber/15 bg-neo-amber/5 hover:bg-neo-amber/8 transition-colors cursor-pointer">
                <AlertTriangle size={14} className={alertColor[alert.type]} />
                <p className="text-sm text-neo-text flex-1 min-w-0 truncate">{alert.title}</p>
                <span className="text-[10px] text-neo-text-muted font-mono whitespace-nowrap shrink-0">{alert.time}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Live fermentation (shown only if active) */}
      {activeFerms.length > 0 && (
        <motion.section {...card(9)} className="neo-card p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl border border-neo-cyan/30 bg-neo-cyan/10 flex items-center justify-center">
                <Activity size={16} className="text-neo-cyan drop-shadow-glow" />
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-[0.18em] text-neo-text-muted">IOT MONITOR</p>
                <h2 className="text-lg font-display font-semibold text-neo-text mt-0.5">Fermentación en vivo</h2>
              </div>
            </div>
            <Link to="/fermentation" className="text-xs text-neo-copper hover:text-neo-text flex items-center gap-1 transition-colors">
              Ver todo <ArrowRight size={11} />
            </Link>
          </div>
          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3">
            {activeFerms.map(f => <FermenterMini key={f.id} session={f} />)}
          </div>
        </motion.section>
      )}

      {/* Activity + Barrels */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <motion.div {...card(10)} className="xl:col-span-7 neo-card p-5 flex flex-col">
          <ActivityChart />
        </motion.div>
        <motion.div {...card(11)} className="xl:col-span-5 neo-card p-5 flex flex-col">
          <BarrelsPanel sessions={allSessions} />
        </motion.div>
      </section>

    </div>
  )
}
