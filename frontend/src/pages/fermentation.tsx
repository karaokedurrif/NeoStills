// frontend/src/pages/fermentation.tsx — NeoStills v3 Fermentation Digital Twin
import { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FlaskConical, Thermometer, Droplets, Plus, Activity,
  AlertTriangle, TrendingDown, Calendar, Wifi, WifiOff,
  Battery, Clock, ChevronRight, Grid3X3, Box,
} from 'lucide-react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'
import * as THREE from 'three'

import { useUIStore } from '@/stores/ui-store'
import { useBrewSessions, useFermentationData } from '@/hooks/use-brewing'
import {
  useActiveFermentations,
  useLatestISpindelReading,
  useFermentationWebSocket,
} from '@/hooks/use-fermentation'
import { GravityChart } from '@/components/brewing/gravity-chart'
import {
  FermenterTwin,
  FermenterStatusIcon,
  type FermenterTwinData,
  type FermenterStatus,
} from '@/components/fermentation/fermenter-twin'
import { FERMENTER_CATALOG, type FermenterSpec } from '@/data/fermenters'
import { AddFermentationModal } from '@/components/fermentation/add-fermentation-modal'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { BrewSession, ISpindelReading } from '@/lib/types'

/* ══════════════════════════════════════════════════════════════════
   3D FERMENTATION ROOM — industrial stainless steel tank hall
   ══════════════════════════════════════════════════════════════════ */
interface FermentTank3DData {
  id: string
  name: string
  capacity: number
  type: 'conical' | 'bucket' | 'carboy' | 'unitank' | 'pressure' | 'unknown'
  status: 'active' | 'idle' | 'attention' | 'healthy' | 'alert'
  fill: number
  temperature: number | null
  gravity: number | null
  abv: number | null
  beerName: string | null
}

const FERM_STATUS_COLORS: Record<string, string> = {
  active:    '#4ADE80',
  idle:      '#555',
  attention: '#FBBF24',
  healthy:   '#60A5FA',
  alert:     '#EF4444',
}

/* — single vertical stainless-steel tank ——————————— */
function FermentTank3D({
  data,
  position,
  onClick,
  selected,
}: {
  data: FermentTank3DData
  position: [number, number, number]
  onClick: () => void
  selected: boolean
}) {
  const [hovered, setHovered] = useState(false)
  const liquidRef = useRef<THREE.Mesh>(null)

  // Scale by capacity — root-law so large tanks aren't huge
  const scale   = Math.pow(data.capacity / 30, 0.33)
  const radius  = Math.min(1.3, Math.max(0.42, 0.52 * scale))
  const height  = Math.min(5.5, Math.max(2.0, 2.6 * scale))
  const conical = data.type === 'conical' || data.type === 'pressure'

  const fillPct = data.fill
  const statusColor = FERM_STATUS_COLORS[data.status] ?? '#555'

  useFrame((state) => {
    if (liquidRef.current && data.status === 'active') {
      const mat = liquidRef.current.material as THREE.MeshStandardMaterial
      mat.emissiveIntensity = 0.12 + Math.sin(state.clock.elapsedTime * 2.8) * 0.07
    }
  })

  return (
    <group
      position={[position[0], position[1] + height / 2, position[2]]}
      onClick={onClick}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      {/* Body */}
      <mesh castShadow>
        <cylinderGeometry args={[radius, radius, height, 32]} />
        <meshStandardMaterial color="#C4C4C4" metalness={0.85} roughness={0.18} envMapIntensity={0.9} />
      </mesh>

      {/* Top dome */}
      <mesh position={[0, height / 2, 0]} castShadow>
        <sphereGeometry args={[radius, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#D2D2D2" metalness={0.9} roughness={0.15} />
      </mesh>

      {/* Conical bottom */}
      {conical ? (
        <mesh position={[0, -height / 2 - 0.28, 0]} castShadow>
          <coneGeometry args={[radius, 0.56, 32]} />
          <meshStandardMaterial color="#B8B8B8" metalness={0.85} roughness={0.2} />
        </mesh>
      ) : (
        <mesh position={[0, -height / 2 - 0.04, 0]}>
          <cylinderGeometry args={[radius * 0.92, radius * 0.92, 0.08, 32]} />
          <meshStandardMaterial color="#B0B0B0" metalness={0.8} roughness={0.25} />
        </mesh>
      )}

      {/* 3 support legs */}
      {[0, 120, 240].map((deg, i) => {
        const r = (deg * Math.PI) / 180
        const legY = conical ? -height / 2 - 0.56 - 0.25 : -height / 2 - 0.25
        return (
          <mesh key={i} position={[Math.cos(r) * radius * 0.72, legY, Math.sin(r) * radius * 0.72]} castShadow>
            <cylinderGeometry args={[0.033, 0.033, 0.5, 6]} />
            <meshStandardMaterial color="#888" metalness={0.78} roughness={0.3} />
          </mesh>
        )
      })}

      {/* Weld seams */}
      {[-0.28, 0.28].map((f, i) => (
        <mesh key={i} position={[0, f * height, 0]}>
          <torusGeometry args={[radius + 0.004, 0.009, 6, 32]} />
          <meshStandardMaterial color="#9A9A9A" metalness={0.9} roughness={0.15} />
        </mesh>
      ))}

      {/* Manhole */}
      <mesh position={[0, height / 2 + 0.21, 0]}>
        <cylinderGeometry args={[0.19, 0.19, 0.07, 16]} />
        <meshStandardMaterial color="#AAA" metalness={0.95} roughness={0.1} />
      </mesh>
      {/* Airlock tube */}
      <mesh position={[0.08, height / 2 + 0.26, 0]}>
        <cylinderGeometry args={[0.022, 0.022, 0.14, 8]} />
        <meshStandardMaterial color="#C8C8C8" metalness={0.8} roughness={0.25} />
      </mesh>
      {/* Airlock bubble */}
      <mesh position={[0.08, height / 2 + 0.36, 0]}>
        <sphereGeometry args={[0.04, 10, 10]} />
        <meshStandardMaterial color="#AACCDD" metalness={0.2} roughness={0.1} transparent opacity={0.7} />
      </mesh>

      {/* Valve */}
      <group position={[radius + 0.07, -height / 4, 0]} rotation={[0, 0, Math.PI / 2]}>
        <mesh>
          <cylinderGeometry args={[0.04, 0.04, 0.17, 8]} />
          <meshStandardMaterial color="#A0A0A0" metalness={0.9} roughness={0.15} />
        </mesh>
        <mesh position={[0, 0.1, 0]}>
          <cylinderGeometry args={[0.065, 0.065, 0.024, 12]} />
          <meshStandardMaterial color="#B83333" metalness={0.6} roughness={0.4} />
        </mesh>
      </group>

      {/* Sight glass */}
      <mesh position={[radius + 0.01, 0.12, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 0.22, 16]} />
        <meshStandardMaterial color="#558899" metalness={0.2} roughness={0.1} transparent opacity={0.55} />
      </mesh>

      {/* Liquid fill */}
      {fillPct > 0 && (
        <mesh ref={liquidRef} position={[0, -height / 2 + (height * fillPct) / 2, 0]}>
          <cylinderGeometry args={[radius * 0.94, radius * 0.94, height * fillPct, 32]} />
          <meshStandardMaterial
            color={statusColor}
            transparent opacity={0.45}
            emissive={statusColor}
            emissiveIntensity={0.12}
          />
        </mesh>
      )}

      {/* Temperature LED */}
      <mesh position={[radius + 0.1, height * 0.28, 0]}>
        <sphereGeometry args={[0.055, 8, 8]} />
        <meshStandardMaterial
          color={data.temperature != null && data.temperature > 26 ? '#EF4444' : data.temperature != null && data.temperature > 22 ? '#FBBF24' : statusColor}
          emissive={data.temperature != null && data.temperature > 26 ? '#EF4444' : data.temperature != null && data.temperature > 22 ? '#FBBF24' : statusColor}
          emissiveIntensity={1.4}
          toneMapped={false}
        />
      </mesh>

      {/* Selection ring */}
      {(selected || hovered) && (
        <mesh position={[0, -height / 2 + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[radius + 0.14, radius + 0.27, 32]} />
          <meshBasicMaterial color="#B87333" transparent opacity={0.8} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Persistent IoT label */}
      <Html
        position={[0, -height / 2 - (conical ? 0.88 : 0.38), radius + 0.18]}
        center distanceFactor={8} transform occlude={false}
      >
        <div className="bg-[#0F0F0F]/90 border border-[#333] rounded px-2 py-0.5 text-[10px] whitespace-nowrap pointer-events-none select-none">
          <span className="text-[#B87333] font-mono font-bold">{data.name}</span>
          <span className="text-[#555] mx-1">·</span>
          <span className="text-[#ccc] font-mono">{data.capacity}L</span>
          {data.temperature != null && (
            <>
              <span className="text-[#555] mx-1">·</span>
              <span className="text-[#4ADE80] font-mono">{data.temperature.toFixed(1)}°C</span>
            </>
          )}
        </div>
      </Html>

      {/* Hover HUD */}
      {hovered && (
        <Html position={[0, height / 2 + 1.0, 0]} center>
          <div className="bg-[#1A1816]/95 border border-[#B87333] rounded-lg px-4 py-3 text-xs whitespace-nowrap backdrop-blur-sm min-w-[170px] shadow-lg">
            <p className="text-[#B87333] font-bold text-sm mb-2">{data.name}</p>
            <div className="space-y-1 text-[#E5E5E5]">
              <p className="flex justify-between gap-4">
                <span className="text-[#888]">Capacidad</span>
                <span className="font-mono">{data.capacity}L</span>
              </p>
              {data.temperature != null && (
                <p className="flex justify-between gap-4">
                  <span className="text-[#888]">Temperatura</span>
                  <span className="font-mono text-[#4ADE80]">{data.temperature.toFixed(1)}°C</span>
                </p>
              )}
              {data.gravity != null && (
                <p className="flex justify-between gap-4">
                  <span className="text-[#888]">Densidad</span>
                  <span className="font-mono text-[#FBBF24]">{data.gravity.toFixed(3)}</span>
                </p>
              )}
              {data.abv != null && (
                <p className="flex justify-between gap-4">
                  <span className="text-[#888]">ABV est.</span>
                  <span className="font-mono text-[#C084FC]">{data.abv.toFixed(1)}%</span>
                </p>
              )}
              <p className="flex justify-between gap-4 mt-1 pt-1 border-t border-[#333]">
                <span className="text-[#888]">Estado</span>
                <span style={{ color: statusColor }}>{data.status}</span>
              </p>
              {data.beerName && (
                <p className="flex justify-between gap-4">
                  <span className="text-[#888]">Lote</span>
                  <span className="text-[#ccc]">{data.beerName}</span>
                </p>
              )}
            </div>
          </div>
        </Html>
      )}
    </group>
  )
}

/* — Industrial concrete hall floor + walls ——————————— */
function FermentationHall({ tankCount }: { tankCount: number }) {
  const cols = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(tankCount))))
  const rows = Math.ceil(tankCount / cols)
  const W = cols * 3.2 + 4
  const D = rows * 4.5 + 4

  return (
    <group>
      {/* Epoxy-sealed concrete floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[W + 2, D + 2]} />
        <meshStandardMaterial color="#2A2A27" roughness={0.88} metalness={0.06} />
      </mesh>

      {/* Floor drain channel */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <planeGeometry args={[W - 1, 0.22]} />
        <meshStandardMaterial color="#1E1E1C" roughness={0.95} />
      </mesh>

      {/* Walls */}
      <mesh position={[0, 3.8, -(D / 2 + 1)]} receiveShadow>
        <boxGeometry args={[W + 2, 7.6, 0.28]} />
        <meshStandardMaterial color="#3A3835" roughness={0.9} metalness={0.05} />
      </mesh>
      <mesh position={[-(W / 2 + 1), 3.8, 0]} receiveShadow>
        <boxGeometry args={[0.28, 7.6, D + 2]} />
        <meshStandardMaterial color="#3A3835" roughness={0.9} metalness={0.05} />
      </mesh>
      <mesh position={[W / 2 + 1, 3.8, 0]} receiveShadow>
        <boxGeometry args={[0.28, 7.6, D + 2]} />
        <meshStandardMaterial color="#3A3835" roughness={0.9} metalness={0.05} />
      </mesh>

      {/* Ceiling beams */}
      {Array.from({ length: Math.ceil(D / 3) + 1 }, (_, i) => (
        <mesh key={i} position={[0, 7.5, -D / 2 + i * 3]} castShadow>
          <boxGeometry args={[W + 2, 0.2, 0.25]} />
          <meshStandardMaterial color="#2E2C28" roughness={0.85} metalness={0.1} />
        </mesh>
      ))}

      {/* Floor tank circles */}
      {Array.from({ length: tankCount }, (_, i) => {
        const col = i % cols
        const row = Math.floor(i / cols)
        const x = (col - (cols - 1) / 2) * 3.2
        const z = (row - (rows - 1) / 2) * 4.5
        return (
          <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.006, z]}>
            <ringGeometry args={[0.88, 1.0, 32]} />
            <meshBasicMaterial color="#B87333" transparent opacity={0.2} />
          </mesh>
        )
      })}
    </group>
  )
}

/* — Industrial pipe header running along ceiling ——————— */
function PipeSystem({ positions }: { positions: [number, number, number][] }) {
  if (positions.length === 0) return null
  const xs = positions.map(p => p[0])
  const minX = Math.min(...xs); const maxX = Math.max(...xs)
  const zs  = positions.map(p => p[2])
  const minZ = Math.min(...zs); const maxZ = Math.max(...zs)
  const midX = (minX + maxX) / 2
  const midZ = (minZ + maxZ) / 2
  const spanX = maxX - minX + 2
  const spanZ = maxZ - minZ + 2

  return (
    <group>
      {/* Main header X */}
      <mesh position={[midX, 6.1, midZ]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.055, 0.055, spanX, 8]} />
        <meshStandardMaterial color="#999" metalness={0.88} roughness={0.15} />
      </mesh>
      {/* Main header Z */}
      <mesh position={[midX, 6.0, midZ]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, spanZ, 8]} />
        <meshStandardMaterial color="#999" metalness={0.88} roughness={0.15} />
      </mesh>
      {/* Drops to each tank */}
      {positions.map((pos, i) => (
        <mesh key={i} position={[pos[0], 3.5, pos[2]]} castShadow>
          <cylinderGeometry args={[0.025, 0.025, 5.5, 6]} />
          <meshStandardMaterial color="#AAA" metalness={0.85} roughness={0.18} />
        </mesh>
      ))}
    </group>
  )
}

/* — Industrial overhead lights ——————————————————————— */
function OverheadLights({ positions }: { positions: [number, number, number][] }) {
  return (
    <>
      {positions.map((pos, i) => (
        <group key={i} position={[pos[0], 7.0, pos[2]]}>
          <mesh>
            <boxGeometry args={[0.5, 0.1, 0.18]} />
            <meshStandardMaterial color="#E8E8E0" emissive="#FFEECC" emissiveIntensity={0.6} />
          </mesh>
          <pointLight intensity={1.2} color="#FFEECC" distance={9} decay={2} castShadow />
        </group>
      ))}
    </>
  )
}

/* — Full 3D room canvas ——————————————————————————————— */
interface FermentationRoom3DProps {
  tanks: FermentTank3DData[]
  selectedId: string | null
  onSelect: (id: string) => void
}

function FermentationRoom3DScene({ tanks, selectedId, onSelect }: FermentationRoom3DProps) {
  const cols = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(tanks.length))))

  // Compute grid positions
  const positions: [number, number, number][] = tanks.map((_, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    return [(col - (cols - 1) / 2) * 3.2, 0, (row - Math.ceil(tanks.length / cols / 2)) * 4.5]
  })

  const lightPositions: [number, number, number][] = positions.filter((_, i) => i % 2 === 0)

  return (
    <>
      <fog attach="fog" args={['#1A1816', 18, 45]} />
      <color attach="background" args={['#1A1816']} />

      {/* Ambient + sky */}
      <hemisphereLight args={['#445566', '#221A14', 0.5]} />
      <ambientLight intensity={0.3} color="#FFDDCC" />

      <FermentationHall tankCount={tanks.length} />
      <PipeSystem positions={positions} />
      <OverheadLights positions={lightPositions} />

      {/* Tanks */}
      {tanks.map((tank, i) => (
        <FermentTank3D
          key={tank.id}
          data={tank}
          position={positions[i]!}
          onClick={() => onSelect(tank.id)}
          selected={tank.id === selectedId}
        />
      ))}

      {/* Ambient room label */}
      <Html position={[0, 6.6, -(Math.ceil(Math.sqrt(tanks.length)) * 2.5)]} center distanceFactor={14} transform>
        <div className="bg-[#0F0F0F]/80 border border-[#4ADE80]/30 rounded px-3 py-1 text-[11px] whitespace-nowrap pointer-events-none">
          <span className="text-[#4ADE80]">SALA FERMENTACIÓN</span>
          <span className="text-[#555] mx-2">|</span>
          <span className="text-[#60A5FA] font-mono">{tanks.filter(t => t.status === 'active').length} activos</span>
          <span className="text-[#555] mx-2">|</span>
          <span className="text-[#ccc] font-mono">{tanks.length} fermentadores</span>
        </div>
      </Html>

      <OrbitControls
        target={[0, 1.5, 0]}
        minDistance={4}
        maxDistance={32}
        maxPolarAngle={Math.PI / 2.1}
      />
    </>
  )
}

export function FermentationRoom3D({ tanks, selectedId, onSelect }: FermentationRoom3DProps) {
  return (
    <div className="w-full rounded-xl overflow-hidden border border-white/10" style={{ height: 420, position: 'relative' }}>
      <Canvas
        shadows
        camera={{ position: [0, 8, 14], fov: 52 }}
        gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}
      >
        <FermentationRoom3DScene tanks={tanks} selectedId={selectedId} onSelect={onSelect} />
      </Canvas>
      {/* Overlay hint */}
      <div className="absolute bottom-3 left-3 text-[10px] text-[#666] pointer-events-none select-none">
        Arrastra · Scroll = zoom · Click en fermentador para detalles
      </div>
    </div>
  )
}

/* ── Helpers ───────────────────────────────────────────────────── */
function daysBetween(from: string, to?: string): number {
  const d1 = new Date(from)
  const d2 = to ? new Date(to) : new Date()
  return Math.max(0, Math.floor((d2.getTime() - d1.getTime()) / 86400000))
}

function inferStatus(session: BrewSession, reading?: ISpindelReading | null): FermenterStatus {
  if (!reading) return 'idle'
  if (session.phase === 'fermenting') {
    if (reading.temperature && (reading.temperature < 14 || reading.temperature > 28)) return 'attention'
    return 'active'
  }
  if (session.phase === 'aging') return 'healthy'
  return 'idle'
}

/* ── Fermenter Selector (empty state) ──────────────────────────── */
function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 gap-4"
    >
      <div className="w-20 h-20 rounded-2xl bg-accent-amber/10 flex items-center justify-center">
        <FlaskConical size={40} className="text-accent-amber/60" />
      </div>
      <div className="text-center space-y-1">
        <h2 className="text-lg font-display font-semibold text-text-primary">
          Sin fermentaciones activas
        </h2>
        <p className="text-sm text-text-secondary max-w-md">
          Inicia un lote desde la página de elaboración y avanza hasta la fase de fermentación
          para ver el monitor digital aquí.
        </p>
      </div>
      <Button
        size="sm"
        className="bg-accent-amber/10 text-accent-amber border border-accent-amber/20 hover:bg-accent-amber/20 mt-2"
      >
        <Plus size={14} className="mr-1.5" />
        Ir a Elaboración
      </Button>
    </motion.div>
  )
}

/* ── Detail Panel ──────────────────────────────────────────────── */
function DetailPanel({ session, fermenter }: { session: BrewSession; fermenter: FermenterSpec }) {
  const { data: points = [], isLoading } = useFermentationData(session.id)
  const [liveReading, setLiveReading] = useState<ISpindelReading | null>(null)

  // Wire iSpindel WebSocket for live updates
  const handleLiveReading = useCallback((reading: ISpindelReading) => {
    setLiveReading(reading)
  }, [])
  useFermentationWebSocket(Number(session.id), handleLiveReading)

  const lastPoint = points[points.length - 1]
  // Prefer live reading over last recorded point
  const currentGravity = liveReading?.gravity ?? lastPoint?.gravity
  const currentTemp = liveReading?.temperature ?? lastPoint?.temperature
  const days = session.fermentation_start ? daysBetween(session.fermentation_start) : session.wash_date ? daysBetween(session.wash_date) : 0

  const predictedFG = session.planned_fg ?? (session.planned_og ? session.planned_og * 0.75 : null)
  const estDaysLeft = predictedFG && currentGravity
    ? Math.max(0, Math.round(((currentGravity - predictedFG) / 0.002) * 1))
    : null

  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-4"
    >
      {/* Session info header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-display font-bold text-text-primary">{session.name}</h2>
          <p className="text-xs text-text-secondary">
            {fermenter.name} · {fermenter.brand} · {fermenter.capacity_liters}L
          </p>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-accent-amber/15 text-accent-amber border border-accent-amber/20">
          {session.phase}
        </span>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            icon: Calendar,
            label: 'Día',
            value: `${days}`,
            sub: session.phase === 'fermenting' ? `de ~${estDaysLeft ? days + estDaysLeft : '?'}` : undefined,
            color: 'text-accent-amber',
          },
          {
            icon: Droplets,
            label: 'Densidad',
            value: currentGravity ? currentGravity.toFixed(3) : '—',
            sub: liveReading ? '🔴 LIVE' : 'SG',
            color: 'text-amber-400',
          },
          {
            icon: Thermometer,
            label: 'Temperatura',
            value: currentTemp?.toFixed(1) ?? '—',
            sub: '°C',
            color: 'text-blue-400',
          },
          {
            icon: TrendingDown,
            label: 'ABV estimada',
            value: session.actual_og && currentGravity
              ? ((session.actual_og - currentGravity) * 131.25).toFixed(1)
              : '—',
            sub: '%',
            color: 'text-accent-hop',
          },
        ].map(({ icon: Icon, label, value, sub, color }) => (
          <div key={label} className="glass-card rounded-xl border border-white/10 p-4">
            <div className="flex items-center gap-1.5 text-text-muted text-[10px] mb-2">
              <Icon className={cn('h-3 w-3', color)} />
              {label}
            </div>
            <p className={cn('text-2xl font-mono font-bold', color)}>
              {value}
              {sub && <span className="text-xs ml-1 text-text-muted">{sub}</span>}
            </p>
          </div>
        ))}
      </div>

      {/* AI Analysis placeholder */}
      {(lastPoint || liveReading) && (
        <div className="glass-card rounded-xl border border-accent-hop/15 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Activity size={14} className="text-accent-hop" />
            <span className="text-xs font-semibold text-accent-hop uppercase tracking-wider">
              Análisis AI
            </span>
            {liveReading && (
              <span className="ml-auto flex items-center gap-1 text-[10px] text-accent-hop">
                <Wifi size={10} />
                iSpindel en vivo
              </span>
            )}
          </div>
          <p className="text-sm text-text-secondary leading-relaxed">
            {currentGravity && currentGravity > 1.020
              ? 'La fermentación está activa. La densidad desciende a buen ritmo. Mantén la temperatura estable.'
              : currentGravity && currentGravity > 1.010
              ? 'Fermentación avanzada. Considera un descanso de diacetilo subiendo 2°C durante 48h.'
              : 'La densidad está cerca del objetivo. Toma una lectura manual para confirmar FG.'}
            {predictedFG && (
              <span className="block mt-1 text-text-tertiary text-xs">
                FG predicha: {predictedFG.toFixed(3)} · Estimado {estDaysLeft ?? '?'} días restantes
              </span>
            )}
          </p>
        </div>
      )}

      {/* Gravity Chart */}
      <div className="glass-card rounded-xl border border-white/10 p-4 space-y-2">
        <h3 className="text-sm font-semibold text-text-secondary flex items-center gap-2">
          <TrendingDown size={14} className="text-accent-amber" />
          Evolución de densidad y temperatura
        </h3>
        {isLoading ? (
          <div className="h-60 animate-pulse bg-bg-elevated rounded-lg" />
        ) : points.length === 0 ? (
          <p className="text-text-muted text-sm py-12 text-center">
            Sin datos todavía. Conecta tu iSpindel o añade puntos manualmente.
          </p>
        ) : (
          <GravityChart data={points} height={280} />
        )}
      </div>
    </motion.div>
  )
}

/* ── Main Page ─────────────────────────────────────────────────── */
export default function FermentationPage() {
  const { setActivePage } = useUIStore()
  useEffect(() => setActivePage('fermentation'), [setActivePage])

  const { data: sessions = [], isLoading } = useBrewSessions('fermenting')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [viewMode, setViewMode] = useState<'3d' | 'classic'>('3d')

  const activeId = selectedId ?? sessions[0]?.id ?? null
  const selectedSession = sessions.find((s: BrewSession) => s.id === activeId)

  // Build digital twin data for each fermenting session
  const twinsData: FermenterTwinData[] = sessions.map((s: BrewSession, i: number) => {
    const fermenter = FERMENTER_CATALOG[i % FERMENTER_CATALOG.length]!
    const days = s.fermentation_start ? daysBetween(s.fermentation_start) : s.wash_date ? daysBetween(s.wash_date) : 0
    return {
      fermenter,
      beerName: s.name,
      style: s.notes ?? undefined,
      dayNumber: days,
      totalDays: 14,
      currentGravity: s.actual_og ? s.actual_og - (days * 0.003) : undefined,
      originalGravity: s.actual_og ?? undefined,
      finalGravity: s.planned_fg ?? (s.actual_og ? s.actual_og * 0.75 : undefined),
      temperature: 19.5 + Math.random() * 2 - 1,
      targetTemp: 20,
      deviceOnline: true,
      deviceBattery: 78 - i * 10,
      deviceRssi: -45 - i * 8,
      lastSync: new Date(Date.now() - (2 + i * 3) * 60000).toISOString(),
      status: 'active' as FermenterStatus,
    }
  })

  // Add empty fermenter slots
  const usedFermenters = twinsData.length
  const emptySlots: FermenterTwinData[] = FERMENTER_CATALOG
    .slice(usedFermenters, usedFermenters + Math.max(0, 3 - usedFermenters))
    .map(f => ({
      fermenter: f,
      status: 'idle' as FermenterStatus,
    }))

  const allTwins = [...twinsData, ...emptySlots]

  // Build 3D data from twins
  const tanks3D = allTwins.map((twin, i) => {
    const session = i < sessions.length ? sessions[i] : null
    const gravity = twin.currentGravity
    const og = twin.originalGravity
    const abv = og && gravity ? (og - gravity) * 131.25 : null
    return {
      id: session?.id ?? `empty-${i}`,
      name: twin.fermenter.name.replace(/\s+\d+L.*/, '').substring(0, 16),
      capacity: twin.fermenter.capacity_liters,
      type: twin.fermenter.type,
      status: twin.status,
      fill: twin.status === 'idle' ? 0 : twin.status === 'healthy' ? 0.92 : 0.87,
      temperature: twin.temperature ?? null,
      gravity: gravity ?? null,
      abv,
      beerName: twin.beerName ?? null,
    }
  })

  const selectedFermenter = selectedId
    ? FERMENTER_CATALOG[sessions.findIndex((s: BrewSession) => s.id === selectedId) % FERMENTER_CATALOG.length] ?? null
    : sessions.length > 0
    ? FERMENTER_CATALOG[0] ?? null
    : null

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold amber-text">Fermentación</h1>
          <p className="text-sm text-text-muted mt-0.5">
            {sessions.length > 0
              ? `${sessions.length} lote${sessions.length > 1 ? 's' : ''} en fermentación`
              : 'Monitor digital de fermentación'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center bg-bg-elevated border border-white/10 rounded-lg p-0.5 gap-0.5">
            <button
              onClick={() => setViewMode('3d')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                viewMode === '3d' ? 'bg-accent-amber/20 text-accent-amber' : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              <Box size={12} /> 3D
            </button>
            <button
              onClick={() => setViewMode('classic')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                viewMode === 'classic' ? 'bg-accent-amber/20 text-accent-amber' : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              <Grid3X3 size={12} /> Tarjetas
            </button>
          </div>
          <Button
            size="sm"
            onClick={() => setShowAddModal(true)}
            className="bg-accent-amber/10 text-accent-amber border border-accent-amber/20 hover:bg-accent-amber/20"
          >
            <Plus size={14} className="mr-1.5" />
            Añadir manual
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="glass-card rounded-xl h-48 animate-pulse bg-bg-elevated" />
          ))}
        </div>
      ) : sessions.length === 0 && viewMode === 'classic' ? (
        <EmptyState />
      ) : viewMode === '3d' ? (
        /* ── 3D Room View ── */
        <div className="space-y-4">
          {sessions.length === 0 ? (
            <div className="glass-card rounded-xl border border-white/10 p-4">
              <FermentationRoom3D
                tanks={tanks3D}
                selectedId={activeId}
                onSelect={(id) => {
                  const idx = tanks3D.findIndex(t => t.id === id)
                  if (idx >= 0 && idx < sessions.length && sessions[idx]) {
                    setSelectedId(sessions[idx]!.id)
                  }
                }}
              />
              <p className="text-text-muted text-sm text-center mt-4">
                No hay lotes activos. Inicia uno desde Elaboración.
              </p>
            </div>
          ) : (
            <FermentationRoom3D
              tanks={tanks3D}
              selectedId={activeId}
              onSelect={(id) => {
                const idx = tanks3D.findIndex(t => t.id === id)
                if (idx >= 0 && idx < sessions.length && sessions[idx]) {
                  setSelectedId(sessions[idx]!.id)
                }
              }}
            />
          )}

          {/* Detail panel below 3D */}
          <AnimatePresence>
            {selectedSession && selectedFermenter && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
              >
                <DetailPanel session={selectedSession} fermenter={selectedFermenter} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : (
        /* ── Classic Card View ── */
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.5fr] gap-6">
          {/* Left: Fermenter grid */}
          <div className="space-y-3">
            <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-2">
              <FlaskConical size={12} />
              Fermentadores activos
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
              {allTwins.map((twin, i) => (
                <FermenterTwin
                  key={twin.beerName ?? twin.fermenter.id}
                  data={twin}
                  selected={
                    twin.beerName
                      ? sessions[i]?.id === activeId
                      : false
                  }
                  onClick={() => {
                    if (i < sessions.length && sessions[i]) {
                      setSelectedId(sessions[i]!.id)
                    }
                  }}
                />
              ))}
            </div>
          </div>

          {/* Right: Detail panel */}
          <div>
            {selectedSession && selectedFermenter ? (
              <DetailPanel session={selectedSession} fermenter={selectedFermenter} />
            ) : (
              <div className="glass-card rounded-xl border border-white/10 p-8 flex items-center justify-center">
                <p className="text-text-tertiary text-sm">
                  Selecciona un fermentador para ver los detalles
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Manual Reading Modal */}
      <AddFermentationModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        session={selectedSession}
      />
    </div>
  )
}
