# NeoStills — VS Code Copilot System Prompt · PARTE 2

## Extensión del prompt anterior — Post-onboarding, 3D, IoT, AI Vision

> Este documento extiende `NeoStills_Copilot_Prompt.md` (Parte 1). Pégalo también en `.github/copilot-instructions-part2.md`.
> La Parte 1 cubre: identidad, dominio, modelo de datos general, renaming, paleta. Esta Parte 2 cubre: wizard de onboarding corregido, configurador 3D de equipos, módulos de producción detallados, IoT Hub, AI Vision.

---

## 9. ONBOARDING — WIZARD DE 5 PASOS (corregido)

El onboarding actual se queda estancado en "Revisión final". Hay que rediseñarlo como un **wizard lineal de 5 pasos** donde cada paso avanza solo cuando se completan sus requisitos mínimos.

### 9.1 Estructura del wizard

```
Paso 01 → Perfil de operación        (homedistiller | craft_distillery)
Paso 02 → Equipo y espacio           (registro de alambiques + fermentadores + nave si craft)
Paso 03 → Primeros datos             (agua local, starter pack, receta ejemplo)
Paso 04 → Integraciones IoT          (opcional: añadir sensores, iSpindel, Parrot, etc.)
Paso 05 → Revisión final             (resumen editable → "Entrar al panel")
```

Cada paso tiene:
- **Estado** en el store global (Zustand/Redux): `pending | active | completed | skipped`
- **Validación** propia antes de permitir avanzar
- **Panel lateral derecho** "Snapshot operativo" que se va rellenando en tiempo real
- **Botones**: `Volver` (paso anterior) y `Continuar` (valida + avanza)
- **Skip opcional** para pasos 03 y 04 (no bloquean la entrada a la app)

### 9.2 Ruta y componentes

```
/app/onboarding/
 page.tsx                        # Layout del wizard (izq: pasos, der: snapshot)
 _components/
   ├── WizardShell.tsx             # Contenedor con progreso
   ├── StepProfile.tsx             # Paso 01
   ├── StepEquipment.tsx           # Paso 02 (con sub-tabs: stills, fermenters, nave)
   ├── StepFirstData.tsx           # Paso 03
   ├── StepIoTHub.tsx              # Paso 04
   ├── StepReview.tsx              # Paso 05
   ├── SnapshotPanel.tsx           # Panel lateral de resumen
   └── StillConfigurator3D.tsx     # Configurador 3D (detalle en sección 10)
 _store/
    └── onboarding-store.ts         # Zustand store con el estado completo
```

### 9.3 Paso 02 — Equipo y espacio (el más complejo)

Este paso cambia según `profile_type`:

**Si `homedistiller`:**
- Tab 1 — **Alambiques**: El usuario puede añadir **N alambiques** (botón "+ Añadir alambique"). Cada uno abre el `StillConfigurator3D` en un modal.
- Tab 2 — **Fermentadores**: Similar, N fermentadores con su configurador simplificado.
- Tab 3 — **Aging (opcional)**: Lista de barricas/recipientes iniciales (puede estar vacío).

**Si `craft_distillery`:**
- Tab 1 — **Nave**: Canvas 2D donde introduce dimensiones (m² + alto) y dibuja zonas (producción, aging room, bottling).
- Tab 2 — **Alambiques**: Mismo configurador pero además con campo "ubicación en la nave" (dropdown de zonas).
- Tab 3 — **Fermentadores + Mash tuns**.
- Tab 4 — **Barricas y tanques de aging** (con posición en layout, inspirado en BodegaData).

**Validación mínima para avanzar**: al menos 1 alambique configurado. El resto es opcional.

### 9.4 Schema del store de onboarding

```typescript
// _store/onboarding-store.ts
interface OnboardingState {
  currentStep: 1 | 2 | 3 | 4 | 5;
  completedSteps: Set<number>;

  profile: {
    type: 'homedistiller' | 'craft_distillery' | null;
    units: 'metric' | 'imperial';
    language: 'es' | 'en';
  };

  facility: {
    name?: string;
    dimensions?: { length_m: number; width_m: number; height_m: number };
    zones: Zone[];  // solo craft
  } | null;

  stills: StillConfig[];        // array — N alambiques permitidos
  fermenters: FermenterConfig[]; // array — N fermentadores permitidos
  mashTuns: MashTunConfig[];
  agingVessels: AgingVesselConfig[];

  firstData: {
    waterProfile?: WaterProfile;
    starterInventory?: InventoryItem[];
    firstRecipe?: string;  // template id
  };

  iot: {
    connectedDevices: IoTDevice[];
    hubEnabled: boolean;
  };

  // Acciones
  setProfile: (p: Partial<Profile>) => void;
  addStill: (s: StillConfig) => void;
  updateStill: (id: string, s: Partial<StillConfig>) => void;
  removeStill: (id: string) => void;
  addFermenter: (f: FermenterConfig) => void;
  // ... etc
  goToStep: (n: number) => void;
  validateStep: (n: number) => { valid: boolean; errors: string[] };
  submitOnboarding: () => Promise<void>;  // POST a /api/onboarding/complete
}
```

### 9.5 Backend — endpoint de finalización

```python
# backend/app/api/onboarding.py
from fastapi import APIRouter, Depends
from app.models import User, Still, Fermenter, Facility
from app.schemas.onboarding import OnboardingSubmission

router = APIRouter(prefix="/api/onboarding", tags=["onboarding"])

@router.post("/complete")
async def complete_onboarding(
    payload: OnboardingSubmission,
    user: User = Depends(get_current_user),
    db = Depends(get_db),
):
    """
    Materializa el snapshot del wizard en la DB:
    - Actualiza User.profile_type, units, language
    - Crea Facility (si craft)
    - Crea N Still records con su config 3D
    - Crea N Fermenter, MashTun, AgingVessel
    - Inicializa inventario con starter pack
    - Registra dispositivos IoT
    - Marca user.onboarding_completed = True
    """
    async with db.begin():
        user.profile_type = payload.profile.type
        user.units = payload.profile.units
        user.language = payload.profile.language

        if payload.profile.type == "craft_distillery" and payload.facility:
            facility = Facility(
                owner_id=user.id,
                name=payload.facility.name,
                dimensions=payload.facility.dimensions,
                zones=payload.facility.zones,
            )
            db.add(facility)

        for still_config in payload.stills:
            db.add(Still(
                owner_id=user.id,
                config_3d=still_config.to_3d_config(),
                **still_config.dict(exclude={"id"})
            ))

        for fermenter_config in payload.fermenters:
            db.add(Fermenter(owner_id=user.id, **fermenter_config.dict()))

        # ... resto de entidades

        user.onboarding_completed = True

    return {"status": "ok", "redirect": "/app/dashboard"}
```

---

## 10. CONFIGURADOR 3D DE ALAMBIQUES — Componentes React

Núcleo diferenciador de NeoStills. El usuario construye **su** alambique componente a componente y lo ve en 3D rotable en tiempo real.

### 10.1 Stack técnico

- **React Three Fiber** (`@react-three/fiber`) — wrapper de Three.js para React
- **Drei** (`@react-three/drei`) — helpers (OrbitControls, Environment, Text3D, useGLTF)
- **Three.js** — motor 3D base
- **Zustand** — estado del configurador
- **Leva** (opcional) — panel de debug de parámetros

### 10.2 Estructura de componentes

```
components/still-configurator/
 StillConfigurator3D.tsx         # Componente raíz
 StillCanvas.tsx                 # <Canvas> de React Three Fiber
 parts/
   ├── Boiler.tsx                  # Caldera (cilindro con lenticular bottom)
   ├── Helmet.tsx                  # Cabeza/onion/alembic head
   ├── SwanNeck.tsx                # Cuello de cisne (curva paramétrica)
   ├── LyneArm.tsx                 # Brazo de lyne
   ├── Column.tsx                  # Columna de platos (reflux)
   │   └── ColumnPlate.tsx         # Un plato individual (para bubble cap / sieve)
   ├── Dephlegmator.tsx            # Deflemador (shell-and-tube vertical)
   ├── Condenser.tsx               # Condensador (serpentín o shell-and-tube)
   ├── GinBasket.tsx               # Cesta para vapor infusion
   ├── Parrot.tsx                  # Pico de loro con alcoholímetro
   ├── SpiritSafe.tsx              # Caja de muestras
   └── Heater.tsx                  # Base de calentamiento (gas/eléctrica/vapor)
 panels/
   ├── TypeSelector.tsx            # Selector de tipo base (pot/reflux/hybrid/...)
   ├── DimensionsPanel.tsx         # Capacidad, altura, material
   ├── ComponentsPanel.tsx         # Checklist de componentes opcionales
   └── PreviewControls.tsx         # Rotar, zoom, exportar imagen
 hooks/
    ├── useStillConfig.ts           # Zustand store del config
    └── useGLTFExport.ts            # Exportar modelo a GLB para guardar
```

### 10.3 Componente raíz

```tsx
// StillConfigurator3D.tsx
'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import { Suspense } from 'react';
import { useStillConfig } from './hooks/useStillConfig';
import { TypeSelector } from './panels/TypeSelector';
import { DimensionsPanel } from './panels/DimensionsPanel';
import { ComponentsPanel } from './panels/ComponentsPanel';
import { StillAssembly } from './StillAssembly';

export function StillConfigurator3D({ onSave }: { onSave: (cfg: StillConfig) => void }) {
  const config = useStillConfig();

  return (
    <div className="grid grid-cols-[1fr_400px] gap-4 h-[700px]">
      {/* Canvas 3D a la izquierda */}
      <div className="relative rounded-xl overflow-hidden bg-neutral-950 border border-neutral-800">
        <Canvas camera={{ position: [2.5, 1.8, 2.5], fov: 45 }} shadows>
          <Suspense fallback={null}>
            <Environment preset="warehouse" />
            <ambientLight intensity={0.4} />
            <directionalLight
              position={[5, 5, 5]}
              intensity={1.2}
              castShadow
              shadow-mapSize={[2048, 2048]}
            />
            <StillAssembly config={config} />
            <ContactShadows
              position={[0, -0.01, 0]}
              opacity={0.6}
              scale={4}
              blur={2}
              far={4}
            />
            <OrbitControls
              enablePan={false}
              minDistance={1.5}
              maxDistance={6}
              minPolarAngle={Math.PI / 6}
              maxPolarAngle={Math.PI / 2.1}
            />
          </Suspense>
        </Canvas>
        <PreviewControls />
      </div>

      {/* Paneles de configuración a la derecha */}
      <div className="flex flex-col gap-3 overflow-y-auto pr-2">
        <TypeSelector />
        <DimensionsPanel />
        <ComponentsPanel />
        <button
          onClick={() => onSave(config.toSaveable())}
          className="mt-auto btn-primary"
        >
          Guardar este alambique
        </button>
      </div>
    </div>
  );
}
```

### 10.4 Componente de ensamblaje dinámico

```tsx
// StillAssembly.tsx — compone las piezas según la config
import { Boiler } from './parts/Boiler';
import { Helmet } from './parts/Helmet';
import { SwanNeck } from './parts/SwanNeck';
import { Column } from './parts/Column';
import { Dephlegmator } from './parts/Dephlegmator';
import { Condenser } from './parts/Condenser';
import { GinBasket } from './parts/GinBasket';
import { Parrot } from './parts/Parrot';

export function StillAssembly({ config }) {
  const { type, capacity_liters, material, components } = config;

  // Altura calculada a partir de capacidad (relación volumen/alto tipica)
  const boilerHeight = Math.cbrt(capacity_liters / 1000) * 0.8;

  return (
    <group position={[0, 0, 0]}>
      {/* Base calentamiento */}
      <Heater type={config.heater_type} />

      {/* Caldera */}
      <Boiler
        position={[0, 0.1, 0]}
        height={boilerHeight}
        radius={boilerHeight * 0.55}
        material={material}
      />

      {/* Cabeza — varía según tipo de alambique */}
      {type === 'pot' && (
        <>
          <Helmet position={[0, 0.1 + boilerHeight, 0]} style="onion" material={material} />
          <SwanNeck from={[0, 0.1 + boilerHeight + 0.4, 0]} to={[0.8, 1.3, 0]} material={material} />
        </>
      )}

      {type === 'reflux' && (
        <Column
          position={[0, 0.1 + boilerHeight, 0]}
          height={1.2}
          plates={components.column_plates ?? 4}
          material={material}
        />
      )}

      {type === 'hybrid' && (
        <>
          <Column position={[0, 0.1 + boilerHeight, 0]} height={0.6} plates={2} material={material} />
          <SwanNeck from={[0, 0.1 + boilerHeight + 0.6, 0]} to={[0.8, 1.3, 0]} material={material} />
        </>
      )}

      {type === 'charentais' && (
        <Helmet style="charentais-bulb" /* ... */ />
      )}

      {/* Componentes opcionales */}
      {components.dephlegmator && <Dephlegmator position={[0, 1.4, 0]} material={material} />}
      {components.gin_basket && <GinBasket position={[0, 0.8, 0]} />}
      <Condenser position={[1.1, 1.0, 0]} style={components.condenser_type ?? 'shell_tube'} material={material} />
      {components.parrot && <Parrot position={[1.4, 0.3, 0]} />}
    </group>
  );
}
```

### 10.5 Ejemplo de pieza con material cobre realista

```tsx
// parts/Boiler.tsx
import { useRef } from 'react';
import * as THREE from 'three';

const COPPER_MATERIAL = {
  color: '#B87333',
  metalness: 0.9,
  roughness: 0.35,
  envMapIntensity: 1.2,
};

const STAINLESS_MATERIAL = {
  color: '#C8CBD0',
  metalness: 0.95,
  roughness: 0.25,
};

export function Boiler({ position, height, radius, material }) {
  const matProps = material === 'copper' ? COPPER_MATERIAL : STAINLESS_MATERIAL;

  return (
    <group position={position}>
      {/* Cuerpo cilíndrico */}
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[radius, radius, height, 64, 1]} />
        <meshStandardMaterial {...matProps} />
      </mesh>
      {/* Tapa esférica superior */}
      <mesh position={[0, height / 2, 0]} castShadow>
        <sphereGeometry args={[radius, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2.2]} />
        <meshStandardMaterial {...matProps} />
      </mesh>
      {/* Fondo toriesferico */}
      <mesh position={[0, -height / 2, 0]} rotation={[Math.PI, 0, 0]} castShadow>
        <sphereGeometry args={[radius, 64, 32, 0, Math.PI * 2, 0, Math.PI / 3]} />
        <meshStandardMaterial {...matProps} />
      </mesh>
      {/* Remaches decorativos opcionales (si material=copper) */}
      {material === 'copper' && <BoilerRivets radius={radius} height={height} />}
    </group>
  );
}
```

### 10.6 Exportación y persistencia

Al guardar, la config se serializa como JSON y se envía al backend. Opcionalmente se genera una **miniatura PNG** (captura del canvas) y un **modelo GLB** del alambique para reutilizar en el dashboard.

```tsx
// hooks/useGLTFExport.ts
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter';

export function useGLTFExport() {
  return async (scene: THREE.Scene): Promise<Blob> => {
    const exporter = new GLTFExporter();
    return new Promise((resolve, reject) => {
      exporter.parse(
        scene,
        (result) => resolve(new Blob([result as ArrayBuffer], { type: 'model/gltf-binary' })),
        (err) => reject(err),
        { binary: true }
      );
    });
  };
}
```

El GLB se sube al storage (S3/MinIO) y la URL se guarda en `Still.model_glb_url`. El dashboard lo renderiza en miniatura con `<StillThumbnail url={still.model_glb_url} />`.

---

## 11. MÓDULO DE PRODUCCIÓN — MALTEADO + FERMENTACIÓN DE WASH

### 11.1 Malteado de cereales

Módulo nuevo que no existe en BeerGate (los brewers compran malta, los destiladores muchas veces maltean ellos mismos).

**Ruta**: `/app/production/malting`

**Entidades**:
```python
# backend/app/models/malting.py
class MaltingBatch(Base):
    __tablename__ = "malting_batches"
    id: UUID
    owner_id: UUID
    grain_type: str  # 'barley', 'rye', 'wheat', 'corn', 'oats', 'millet', 'sorghum', 'buckwheat', 'quinoa'
    grain_variety: str  # 'Maris Otter', 'Golden Promise', 'Pearl', etc.
    quantity_kg: float
    source_supplier: str
    status: Enum['steeping', 'germination', 'kilning', 'complete']

    # Pasos del malteado
    steeping_log: JSON  # [{start, end, water_temp, changes}]
    germination_log: JSON  # [{day, temp, humidity, rootlet_length_mm, notes}]
    kilning_log: JSON  # [{step, temp_c, duration_h, notes}]

    # Resultado
    final_moisture_pct: float
    diastatic_power: Optional[int]  # Lintner
    malt_type_result: str  # 'pale', 'crystal_60L', 'chocolate', 'peated', 'smoked'

    started_at: datetime
    completed_at: Optional[datetime]
```

**UI — Pasos del malteado**:
1. **Remojo (steeping)**: Timer de 24-72h con cambios de agua cada 8-12h. Registro de temperatura del agua.
2. **Germinación**: 4-7 días a 15-18°C con humedad alta. El usuario registra diariamente longitud de la raíz (el cereal está listo cuando la radícula mide 3/4 del tamaño del grano).
3. **Secado/Kilning**: Rampa de temperatura (50-65°C suave, luego 80-110°C para pale malt, hasta 200°C+ para tostados). Cada perfil de temperatura produce un tipo distinto de malta.
4. **Perfiles predefinidos** seleccionables: Pale Malt, Munich, Vienna, Crystal, Chocolate, Black Patent, Peated (con humo de turba), Smoked (haya, manzano, roble).

**IA asistente en esta fase**:
- Recomendación de perfil de kilning según el spirit objetivo (peated para scotch, chocolate para stout-whiskey...)
- Alerta si la humedad de germinación está fuera de rango
- Cálculo de mermas esperadas (malting loss típico 20-25%)

### 11.2 Fermentación del wash (distiller's wash)

Diferencia clave con cerveza: **el wash para destilación se optimiza para rendimiento alcohólico, no para sabor estable**. El brew de cerveza está diseñado para beberse; el wash para destilarse.

**Tipos de wash soportados**:
- **All-grain mash wash** (whiskey): mash tradicional + on-grain o off-grain fermentation
- **Sugar wash** (moonshine, base para vodka/gin): azúcar + nutrientes + TPW (turbo yeast)
- **Molasses wash** (rum): melaza + dunder/backset, fermentación lenta con levadura de rum
- **Fruit mash** (brandy/eau-de-vie): fruta triturada + levadura + (opcional) enzimas pectolíticas
- **Agave wash** (mezcal/tequila-style)
- **Grape/wine base** (brandy/cognac/armagnac)
- **Rice wash** (shochu, baijiu)

**Parámetros por tipo de wash**:
```python
# backend/app/schemas/wash.py
class WashRecipe(BaseModel):
    wash_type: Literal['all_grain', 'sugar', 'molasses', 'fruit', 'agave', 'grape', 'rice']
    target_og: float         # ej. 1.085 para whiskey, 1.100 para rum
    target_abv: float        # calculado: (OG-FG)*131.25
    target_ph: float         # 3.8-4.2 para sugar wash, 4.5-5.2 para grain wash
    fermentation_temp_c: float
    expected_duration_days: int
    yeast_strain: str
    nutrient_schedule: List[NutrientAddition]

    # Específicos por tipo
    grain_bill: Optional[List[GrainItem]]        # all_grain
    mash_schedule: Optional[List[MashStep]]      # all_grain
    sugar_source: Optional[str]                   # sugar
    backset_pct: Optional[float]                 # molasses (dunder)
    fruit_bill: Optional[List[FruitItem]]        # fruit
    pectolytic_enzyme: Optional[bool]            # fruit
```

**Integración iSpindel** (ya existente en BeerGate): el hidrómetro flotante sigue siendo útil aquí. Además añadir soporte para el **Tilt Hydrometer** y **RAPT Pill** (densidad + temperatura por Bluetooth/WiFi).

---

## 12. MÓDULO DE DESTILACIÓN — Runs y Cortes

### 12.1 Lifecycle de una run

Cada batch pasa por 1 o 2 destilaciones:

```
Wash → [Stripping Run] → Low Wines (25-35% ABV) → [Spirit Run con cortes] → Hearts (70-80% ABV)
```

Para vodka/neutral: múltiples reflux runs hasta 95% ABV. Para rum: a veces single run en pot still. El sistema debe soportar todas las variantes.

### 12.2 Distillation Log en tiempo real

Interfaz optimizada para usar **junto al alambique**, en móvil/tablet:

**Ruta**: `/app/production/batches/[id]/distillation`

**Layout**:
- **Reloj activo** arriba (tiempo desde inicio de la run)
- **Gráfica en vivo** de temperatura (head + column + condenser) + ABV del destilado
- **Panel de fracción actual** con dropdown: Foreshots → Heads → Hearts → Tails
- **Botón grande "Switch Cut"** que marca en el timeline el cambio de fracción
- **Registro manual o automático** del ABV (si hay Parrot con sensor IoT, automático)
- **Registro de jars**: el usuario asocia cada "jar" físico (tarro de recolección) a una fracción y volumen
- **Notas rápidas** con chips predefinidos: "olor a acetona (foreshots)", "sabor dulce (hearts)", "sabor a cartón mojado (tails)"

**Datos capturados**:
```python
class DistillationRun(Base):
    batch_id: UUID
    run_type: Literal['stripping', 'spirit', 'gin_vapor_run', 'reflux_vodka']
    still_id: UUID              # cuál alambique se usó
    started_at, ended_at: datetime
    wash_volume_l: float
    wash_abv_start: float

    # Time-series (puede venir de sensor IoT o manual)
    telemetry: List[DistillationDataPoint]
    # cada DataPoint: {timestamp, t_head_c, t_column_c, t_condenser_c, abv_current, heating_power_w}

    # Cortes
    cuts: List[Cut]
    # cada Cut: {fraction, start_time, end_time, volume_ml, abv, jar_ids[], notes}

    # Resumen post-run
    total_collected_ml: float
    hearts_volume_ml: float
    hearts_avg_abv: float
    yield_efficiency_pct: float   # vs potencial teórico
```

### 12.3 Calculadora de cortes asistida

Antes de empezar, el sistema sugiere dónde hacer los cortes basado en:
- Volumen de wash y ABV
- Tipo de alambique (pot vs reflux)
- Ratio de reflujo si aplica
- Velocidad de destilación

Durante la run, la IA (ver sección 15) puede sugerir en tiempo real: "Los últimos 3 puntos de ABV muestran caída acelerada + temperatura subiendo rápido → probablemente estás entrando en tails, considera cortar".

---

## 13. RECETAS DE SPIRITS, LICORES Y BOTÁNICOS

### 13.1 Motor de recetas extensible

Una receta es un **grafo dirigido acíclico de operaciones**:

```
[Grain bill] → [Mash] → [Ferment] → [Strip] → [Spirit run] → [Age] → [Blend] → [Proof] → [Bottle]
```

Cada operación tiene inputs, parámetros y outputs. El motor valida que los outputs de una etapa sean compatibles con los inputs de la siguiente.

```python
# backend/app/models/recipe.py
class Recipe(Base):
    id: UUID
    name: str
    spirit_category: str  # 'whiskey', 'rum', 'gin', 'brandy', 'vodka', 'liqueur', 'eau_de_vie'
    subcategory: Optional[str]  # 'bourbon', 'single_malt_scotch', 'london_dry_gin', etc.
    difficulty: Literal['beginner', 'intermediate', 'advanced', 'expert']
    source: Optional[str]  # 'HomeDistiller Tried & True', 'StillDragon Cookbook', 'user'
    source_url: Optional[str]
    operations: List[RecipeOperation]  # el DAG serializado
    expected_output: RecipeOutput  # volumen esperado, ABV final, tiempo total
    cost_estimate_per_liter: Optional[Decimal]

class RecipeOperation(Base):
    recipe_id: UUID
    step_order: int
    operation_type: str  # 'mash', 'ferment', 'distill', 'age', 'blend', 'proof', 'bottle', 'macerate', 'vapor_infuse'
    params: JSON  # parámetros específicos de la operación
    expected_duration_hours: float
    expected_input: JSON
    expected_output: JSON
```

### 13.2 Tipos de operaciones soportadas

Cada `operation_type` tiene un schema validado. Ejemplos:

```python
# Macerate (para gin infusionado, licores, limoncello, etc.)
class MacerateParams(BaseModel):
    base_spirit_abv: float
    botanicals: List[BotanicalDose]   # {ingredient, grams_per_liter, timing}
    duration_hours: int
    temperature_c: Optional[float]    # ambiente por defecto
    light_exposure: Literal['dark', 'indirect', 'sunlight']  # para absenta, arancello, etc.
    shake_schedule: Optional[str]     # 'daily', 'every_3_days'

# Vapor infusion (gin tipo Bombay Sapphire)
class VaporInfuseParams(BaseModel):
    botanicals: List[BotanicalDose]
    basket_position: Literal['in_helmet', 'in_lyne_arm', 'in_column']
    run_abv_start: float

# Age (maduración)
class AgeParams(BaseModel):
    vessel_type: Literal['barrel_new', 'barrel_refill', 'cask_ex_bourbon', 'cask_ex_sherry',
                         'cask_ex_port', 'chips', 'spirals', 'staves', 'cubes']
    wood_type: Literal['american_white_oak', 'european_oak', 'japanese_mizunara',
                       'cherry', 'chestnut', 'acacia', 'mulberry']
    toast_level: Literal['light', 'medium', 'medium_plus', 'heavy']
    char_level: Optional[Literal['char_1', 'char_2', 'char_3', 'char_4_alligator']]
    vessel_size_liters: float
    duration_months: int
    expected_angel_share_pct_per_year: float

    # Técnicas modernas (ver sección 14)
    ultrasonic_aging: bool = False
    pressure_cycling: bool = False
    temperature_cycling: bool = False
    oxygenation_schedule: Optional[List[OxygenationEvent]] = None

# Blend
class BlendParams(BaseModel):
    source_batches: List[BlendSource]  # {batch_id, volume_l, proportion_pct}
    target_abv: Optional[float]
    target_volume_l: Optional[float]
    resting_days_after_blend: int = 7

# Proof (dilución final)
class ProofParams(BaseModel):
    target_abv: float
    water_source: Literal['distilled', 'RO', 'spring', 'local']
    filtration: Optional[Literal['charcoal', 'silver', 'cold_chill', 'none']]
```

### 13.3 Biblioteca de recetas precargadas

Al instalar, se carga una biblioteca base inspirada en comunidades de referencia:

**Whiskey / Whisky**:
- UJSSM (Uncle Jesse's Simple Sour Mash) — HomeDistiller classic
- All-grain Bourbon (51% corn, 30% rye, 19% malted barley)
- Single Malt Scotch estilo Islay (con turba)
- Irish pot still whiskey
- Rye Whiskey (51-100% rye)
- Japanese-style malt whisky (levadura sake + mizunara aging)

**Rum**:
- Dunder Rum (con backset)
- White rum (charcoal filtered)
- Aged Demerara
- Rhum Agricole (jugo de caña)
- Jamaican high-ester style

**Gin**:
- London Dry (10 botánicos clásicos)
- Plymouth style
- Contemporary gin (cítrico forward)
- Old Tom (edulcorado)
- Navy Strength (57%+)
- Genever (malt wine base)

**Brandy / Eau-de-vie**:
- Cognac-style doble destilación charentais
- Armagnac-style single column
- Calvados (sidra destilada)
- Grappa / orujo
- Williams pear eau-de-vie
- Kirschwasser (cerezas)

**Vodka**:
- Neutral grain vodka (95%+ reflux)
- Potato vodka
- Polish rye vodka

**Licores y botánicos**:
- Limoncello
- Crema de orujo
- Pacharán
- Absenta (con alambique de gin)
- Ratafía
- Arancello
- Crema de café
- Amaretto casero
- Aquavit (alcaravea + eneldo)
- Akvavit danés

### 13.4 Base de datos de botánicos

```python
class Botanical(Base):
    id: UUID
    name_es: str
    name_en: str
    name_latin: str
    category: Literal['juniper', 'citrus', 'spice', 'root', 'floral', 'herb',
                      'seed', 'bark', 'bean', 'fruit', 'bitter']
    flavor_profile: List[str]  # ['piney', 'citrus', 'peppery', ...]
    typical_dose_g_per_l: Tuple[float, float]  # rango típico
    infusion_method: List[str]  # ['maceration', 'vapor', 'boiling', 'percolation']
    pairs_well_with: List[UUID]  # FK a otros botánicos con afinidad

    notes: str  # notas de uso, sustitutos
```

La vista UI es un **catálogo tipo Pinterest** con foto, filtros por categoría/perfil, y un constructor de "botanical bill" drag-and-drop.

---

## 14. AGING — Maderas, Barricas y Técnicas Modernas

### 14.1 Maderas y tostados

Cada barrica/chip/spiral tiene una combinación de:
- **Especie de madera**: >15 opciones (roble americano, europeo, mizunara japonés, cerezo, castaño, acacia, morera, mezquite, pino...)
- **Tostado**: Light / Medium / Medium+ / Heavy (sin combustión)
- **Carbonizado**: Char #1 (15s) / #2 (30s) / #3 (45s) / #4 Alligator (55s+) — solo con combustión
- **Uso previo**: Virgen, ex-Bourbon, ex-Sherry (Oloroso/PX/Fino), ex-Port, ex-Wine, ex-Rum, ex-Tequila...

### 14.2 Tamaños de recipiente

```python
BARREL_SIZES = {
    'mini_cask_1L': 1,
    'mini_cask_3L': 3,
    'mini_cask_5L': 5,
    'octave': 25,
    'quarter_cask': 50,
    'firkin': 40,
    'small_barrel_100L': 100,
    'standard_200L': 200,          # ASB / American Standard Barrel
    'hogshead_250L': 250,
    'puncheon_450L': 450,
    'butt_500L': 500,
    'port_pipe_550L': 550,
    'madeira_pipe_650L': 650,
    'foudre_5000L': 5000,          # gran tina
    'tank_stainless_chips': None,  # acero inox con chips/staves
}
```

El ratio **superficie madera / volumen líquido** es clave — barricas pequeñas maduran más rápido. El sistema calcula y muestra este ratio al seleccionar una barrica.

### 14.3 Técnicas modernas de aging acelerado

Diferenciador claro vs software de destilería tradicional — NeoStills soporta técnicas de **aging innovador** que están empezando a usar craft distilleries:

| Técnica | Descripción | Parámetros |
|---------|-------------|------------|
| **Ultrasonic aging** | Ondas ultrasónicas rompen estructuras moleculares del etanol simulando años de aging | Frecuencia (kHz), potencia (W), duración (h), ciclos |
| **Pressure cycling** | Ciclos de presión + vacío fuerzan intercambio madera-líquido | Presión máx (bar), presión mín, ciclos/día, duración |
| **Temperature cycling** | Ciclos térmicos 15°C ↔ 35°C simulan cambios estacionales | Temp max, temp min, ciclos/día |
| **Oxygenation programada** | Inyección controlada de O2 o aire por micro-porosidad | Caudal (ml/min), schedule |
| **Rotating barrels** | Rotación motorizada de la barrica para mayor contacto | RPM, duración, descansos |
| **Micro-oxigenation** | Membranas de difusión de O2 controlada (como en enología) | ppm/mes target |
| **Sonic aging** | Vibración audible (música, bajas frecuencias) — experimental | Frec dominante, dB |
| **Light spectrum aging** | Exposición controlada a UV/IR — experimental | Longitud onda, lumens |

Cada técnica se registra como `AgingProgram` con sus parámetros y se visualiza en el timeline de la barrica. Si hay IoT (bomba de presión controlada por ESP32, termostato, etc.), los eventos se registran automáticamente.

### 14.4 Barrel Tracker — Integración con BodegaData

El sistema comparte infraestructura Docker con BodegaData (ambos en `docker-edge-apps`). Esto permite:

- **Reutilizar el layout engine** de BodegaData para visualizar barricas en la nave (https://hub.bodegadata.com/cellar y /barrels son la referencia visual)
- **Compartir la DB de tipos de madera** si tiene sentido
- **Módulo compartido** `barrel-layout-engine` que se publica como paquete interno npm/pip y se consume desde ambos proyectos

**Arquitectura sugerida** (monorepo o packages compartidos):

```
docker-edge-apps/
 apps/
   ├── bodegadata-hub/         # proyecto existente
   └── neostills/              # este proyecto
 packages/
   ├── barrel-layout-engine/   # visualización 2D/3D de barricas (react + three)
   │   ├── src/
   │   │   ├── CellarView.tsx
   │   │   ├── BarrelRack.tsx
   │   │   ├── BarrelDetail.tsx
   │   │   ├── hooks/useBarrelDragDrop.ts
   │   │   └── types.ts
   │   └── package.json
   ├── wood-database/          # catálogo compartido de maderas
   └── iot-device-protocols/   # MQTT topics, schemas comunes
 docker-compose.yml
```

El paquete `barrel-layout-engine` expone componentes React agnósticos al dominio:

```tsx
import { CellarView, BarrelRack } from '@edge-apps/barrel-layout-engine';

// En NeoStills:
<CellarView
  facility={facility}
  vessels={agingVessels}
  onVesselClick={(v) => openBarrelDetail(v.id)}
  onVesselMove={(id, newPos) => updateVesselPosition(id, newPos)}
  renderVesselLabel={(v) => `${v.spirit_type} · ${v.age_months}mo · ${v.abv}%`}
  theme="neostills"  // copper/amber
/>

// En BodegaData, mismo componente con theme="bodegadata"
```

### 14.5 Vistas del Barrel Tracker

1. **Mapa de la nave** (layout view) — heredado de BodegaData
2. **Timeline horizontal** — barricas ordenadas por fecha de llenado, con marcador de fecha target
3. **Tabla filtrable** — todas las barricas con columnas configurables
4. **Ficha individual** — historial completo: fills anteriores, samplings, angel's share calculado, evolución de color/ABV
5. **Vista 3D de la aging room** — opcional, inmersiva, con cada barrica rendereada a escala

---

## 15. BLENDING & BOTTLING

### 15.1 Blending Lab

Herramienta visual interactiva para diseñar blends:

**Ruta**: `/app/production/blending-lab`

**UI**:
- Panel izquierdo: lista de **fuentes disponibles** (batches en aging listos o en stock) con chips arrastrables
- Canvas central: visualización tipo "vaso mezclador" con las proporciones
- Panel derecho: **resultado calculado en tiempo real** (ABV final, volumen, coste por litro, perfil de flavor estimado)
- Deslizadores para ajustar porcentaje de cada fuente
- Botones de preset: "Mezcla igualitaria", "Estilo cognac XO (30%-50%-20%)", etc.

**Cálculos**:
```python
def calculate_blend(sources: List[BlendSource]) -> BlendResult:
    total_volume = sum(s.volume_l for s in sources)
    weighted_abv = sum(s.abv * s.volume_l for s in sources) / total_volume
    weighted_age = sum(s.age_months * s.volume_l for s in sources) / total_volume
    # "Age of the Youngest Spirit" — regla legal europea
    youngest_age = min(s.age_months for s in sources)

    return BlendResult(
        total_volume_l=total_volume,
        abv=weighted_abv,
        legal_age=youngest_age,  # edad declarable en etiqueta
        average_age=weighted_age,
        cost_per_liter=weighted_cost(sources),
    )
```

**Simulador de perfil de flavor** (IA): dado el perfil de cada fuente (notas de cata previas), estima el perfil del blend usando embeddings de texto + modelo de mezcla.

### 15.2 Bottling

Registro de sesiones de embotellado:

```python
class BottlingSession(Base):
    id: UUID
    source_batch_id: UUID  # o blend_id
    date: datetime
    bottles_count: int
    bottle_size_ml: int  # 50 (mini), 200, 375, 500, 700, 750, 1000, 1500, 1750, 3000 (jero)
    final_abv: float
    lot_code: str  # generado automáticamente o custom
    label_batch: Optional[str]
    cork_type: Literal['natural_cork', 'synthetic', 'screw_cap', 't_cork', 'wax_seal']
    has_tamper_seal: bool
    filtration_applied: Optional[str]
    cold_chill_filtered: bool  # típico en whisky/gin económico, no en premium
    caramel_color_added: bool  # legal en scotch, para consistencia de color
    notes: str
```

**Generador de etiquetas**: templates personalizables con los datos del lote + QR que apunta a `/public/bottle/[lot_code]` — página pública con la historia completa del lote (grain-to-glass transparency).

---

## 16. IoT HUB — Integración de dispositivos novedosa

Aquí está la innovación real. NeoStills no solo soporta dispositivos existentes como iSpindel — crea un **hub IoT unificado** para todo el proceso de destilación.

### 16.1 Dispositivos soportados (nativos + DIY + comerciales)

| Fase | Dispositivo | Tipo | Protocolo | Qué mide |
|------|-------------|------|-----------|----------|
| Malteado | SensorPush HT1 | Comercial | BLE | Temp + humedad de germinación |
| Malteado | NeoMalt (DIY ESP32) | Propio | WiFi/MQTT | Temp, humedad, control de volteo automático |
| Fermentación | iSpindel | DIY/Comercial | WiFi | Gravidad + temp |
| Fermentación | Tilt Hydrometer | Comercial | BLE | Gravidad + temp |
| Fermentación | RAPT Pill | Comercial | WiFi | Gravidad + temp + presión |
| Fermentación | Plaato Airlock | Comercial | WiFi | Actividad fermentativa por CO2 |
| Destilación | **NeoParrot** (DIY) | Propio | WiFi/MQTT | ABV continuo con sensor densidad + temp |
| Destilación | Termopares K-type | DIY/ESP32 | MQTT | Temp en multiples puntos (head, column, condenser, reflux return) |
| Destilación | Flow meter | Comercial | 4-20mA | Caudal de condensación |
| Destilación | Pressure transducer | Comercial | I2C/analog | Presión de columna |
| Aging | Sensor de peso bajo barrica | DIY | LoRaWAN | Angel's share en tiempo real |
| Aging | TempHumidity logger | Comercial | Zigbee | Condiciones de rickhouse |
| Aging | **NeoBarrel** (DIY) | Propio | LoRaWAN | Temp interior barrica + extracción por color (fotodiodo) |
| General | Cámaras IP | Comercial | RTSP | Vigilancia + AI Vision (sección 17) |
| General | Smart plugs | Comercial | WiFi/Zigbee | Control de bombas, resistencias, etc. |

### 16.2 Arquitectura del Hub IoT

```

                    NeoStills IoT Hub                         │
                                                              │
  ┌──────────┐     ┌──────────┐     ┌───────────┐           │
  │ BLE      │     │ Zigbee   │     │ LoRaWAN   │           │
  │ Scanner  │     │ Coordin. │     │ Gateway   │           │
  └────┬─────┘     └────┬─────┘     └─────┬─────┘           │
       │                │                  │                  │
       └────────────────┼──────────────────┘                  │
                        ▼                                     │
              ┌──────────────────┐                            │
              │   MQTT Broker    │ ← ESP32 DIY devices        │
              │   (Mosquitto)    │ ← iSpindel, NeoParrot      │
              └────────┬─────────┘                            │
                       │                                       │
                       ▼                                       │
         ┌─────────────────────────────┐                      │
         │  Device Registry + Router    │                      │
         │  (Python — FastAPI + asyncio)│                      │
         └──────────────┬──────────────┘                      │
                        │                                       │
      ┌─────────────────┼─────────────────┐                   │
      ▼                 ▼                 ▼                   │
  ┌────────┐      ┌──────────┐     ┌──────────┐              │
  │TimeScale│     │ Postgres │     │  Redis   │              │
  │ (series)│     │ (device  │     │ (live    │              │
  │         │     │  config) │     │  state)  │              │
  └────────┘      └──────────┘     └──────────┘              │
                                                              │

                         │
                         ▼
                  WebSocket → UI en vivo
```

### 16.3 Device Discovery & Pairing

**Ruta**: `/app/settings/iot/devices`

- **Modo descubrimiento**: Botón "Buscar dispositivos cerca" → escanea BLE, consulta MQTT topics, Zigbee network
- **Auto-configuración**: Al detectar un iSpindel conocido, crea un perfil automático
- **Manual**: Formulario para añadir IP manualmente (para termopares vía ESP32 custom)
- **Firmware management**: OTA updates para los dispositivos DIY propios (NeoMalt, NeoParrot, NeoBarrel)

### 16.4 Topic taxonomy MQTT

```
neostills/
 users/{user_id}/
   ├── devices/{device_id}/
   │   ├── telemetry    → datos cada N segundos
   │   ├── status       → online/offline/error
   │   ├── config       → configuración actual
   │   └── commands     → comandos al dispositivo (OTA, reset, calibrate)
   ├── batches/{batch_id}/
   │   └── events       → eventos agregados del proceso
   └── alerts           → alertas consolidadas
```

### 16.5 Live dashboard por batch

Cuando un batch está activo, el dashboard muestra:
- Todos los sensores asociados al batch en tiempo real
- Gráficas multi-serie (WebSocket stream)
- Alertas configurables por umbral ("si T_head > 96°C, notificar")
- Heat map de la nave con estado de todos los dispositivos

### 16.6 Novedad: Hub como producto físico opcional

Aprovechando tu experiencia con BeerGate Puck + Cerebro (ver `BeerGate_Hardware_Guide.md`), ofrecer un **NeoStills Hub** físico:
- Hardware: Orange Pi 5B + antenas BLE/Zigbee/LoRa + MQTT broker embebido
- Ejecuta el backend IoT localmente (edge computing), la nube solo sincroniza
- Mismo ecosistema de skills que BeerGate Puck pero orientado a destilación
- Se vende como kit (~300€) o como parte del producto white-label para craft distilleries

---

## 17. AI + AI VISION — Asistente en el proceso

### 17.1 Genio Destilador — LLM local/cloud híbrido

Ver sección 4.7 de la Parte 1. Aquí se amplía con capacidades nuevas:

**Modos de operación**:
- **Coach mode**: Antes de empezar un lote, revisa la receta y sugiere ajustes según inventario/clima
- **Copilot mode**: Durante una run, recibe telemetría en tiempo real y avisa de desvíos
- **Review mode**: Tras un batch, analiza logs y sugiere mejoras para el siguiente
- **Troubleshooting mode**: Chat reactivo ante problemas ("el wash huele a huevo podrido")

**Context injection**: El LLM recibe en cada prompt:
```json
{
  "user_profile": {...},
  "current_batch": {...},
  "active_equipment": [...],
  "recent_telemetry": [...],
  "inventory_snapshot": {...},
  "recent_notes": [...],
  "relevant_recipe_context": {...}
}
```

**Knowledge base**: RAG sobre corpus curado de HomeDistiller wiki + selección de threads de ADI y StillDragon + documentación interna.

### 17.2 AI Vision — Visión por computador aplicada

Esta es la innovación más novedosa. Usar modelos de visión para **"ver" el proceso de destilación** y extraer información que hoy requiere ojo humano experto.

#### 17.2.1 Detección de cortes por color del destilado

- Cámara IP (o webcam USB) apuntando a los **collection jars** bajo el parrot
- Modelo de visión entrenado para detectar:
  - Turbidez (típica de foreshots/heads)
  - Cambios de color sutiles (entrada de tails = amarillento)
  - Formación de "perlas" (blebbing) en la superficie → indicador visual clave
  - Densidad de la "serpiente" de alcohol en el parrot → correlaciona con ABV
- **Salida**: sugerencia automatizada "detecté blebbing característico de heart→tail, considera cortar"

#### 17.2.2 Lectura automática del alcoholímetro/parrot

- Cámara fija sobre el parrot
- OCR + detección de menisco con modelo custom (YOLOv8 fine-tuned)
- Registro automático del ABV cada 30 segundos → elimina la necesidad de un sensor IoT custom si el usuario solo tiene cámara

#### 17.2.3 Análisis de color de destilado/spirit envejecido

- El usuario saca una muestra en un vial estándar y la fotografía
- Modelo estima color en escala Lovibond/SRM/custom
- Compara contra muestras anteriores del mismo lote → **gráfica de evolución de color** durante el aging
- Detección de turbidez/floculación no deseada

#### 17.2.4 Inspección visual de barricas

- Cámara con flash apuntada a la tapa de la barrica
- Detección de leaks (manchas de humedad)
- Detección de hongos superficiales
- Estimación de nivel por sonido (tapping) + visión combinados → angel's share sin abrir

#### 17.2.5 Reconocimiento de botánicos

- El usuario fotografía un ingrediente → el modelo identifica si es enebro, cilantro, angélica, etc.
- Útil para homedistillers que compran botánicos a granel sin etiquetar
- Base: modelo fine-tuned sobre dataset de botánicos (crear dataset propio con ~50 especies)

#### 17.2.6 Lectura de hidrómetros analógicos

- Si el usuario no tiene iSpindel, puede fotografiar el hidrómetro flotante en el wash
- Visión detecta el menisco y la graduación, registra el valor
- Corrección automática por temperatura si se fotografía también el termómetro

### 17.3 Stack técnico para AI Vision

```python
# backend/app/ai_vision/
 models/
   ├── abv_parrot_reader.py        # YOLOv8 custom
   ├── color_estimator.py          # CNN regresor a RGB/Lovibond
   ├── cut_detector.py             # Clasificador foreshots/heads/hearts/tails
   ├── botanical_classifier.py     # ResNet50 fine-tuned
   └── hydrometer_reader.py
 pipelines/
   ├── live_distillation.py        # Loop continuo durante una run
   └── batch_inspection.py          # Procesado bajo demanda
 training/                        # Scripts de entrenamiento (Python + PyTorch)
 serving/
    ├── fastapi_endpoints.py
    └── onnx_runtime.py              # Inferencia optimizada
```

**Deployment**:
- **Cloud**: Modelos en GPU server, API REST
- **Edge**: ONNX Runtime en el NeoStills Hub físico → inferencia local sin enviar imágenes fuera
- **Hybrid**: El usuario elige (privacidad vs recursos)

### 17.4 Endpoints AI Vision

```
POST /api/ai-vision/analyze/parrot
  body: { image: base64, batch_id: UUID, run_id: UUID }
  response: { abv: float, temp_c: float, confidence: float, timestamp }

POST /api/ai-vision/analyze/cut-detection
  body: { image: base64, jar_sequence_number: int, batch_id: UUID }
  response: {
    suggested_cut: 'foreshots' | 'heads' | 'hearts' | 'tails',
    confidence: float,
    visual_markers: ['blebbing', 'turbid', 'clear'],
    reasoning: str  # texto del LLM explicando
  }

POST /api/ai-vision/analyze/spirit-color
  body: { image: base64, vessel_id: UUID, sampling_date: date }
  response: { color_rgb, lovibond, srm, turbidity_ntu, evolution_chart_data }

POST /api/ai-vision/identify/botanical
  body: { image: base64 }
  response: { top_matches: [{name, confidence, botanical_id}] }

WS /ws/ai-vision/live/{run_id}
  stream: frames en vivo desde cámara IP del proceso
  emits: { timestamp, detections, suggestions }
```

---

## 18. ROADMAP DE IMPLEMENTACIÓN REVISADO

**P0 — Sprint 1 (esta semana)**:
- Fix wizard de onboarding (sección 9): 5 pasos, soporte N alambiques + N fermentadores
- Esqueleto de `StillConfigurator3D` con tipo pot (el más simple) funcionando

**P1 — Sprint 2-3**:
- Configurador 3D completo: todos los tipos de still + componentes opcionales
- Modelo de datos de `MaltingBatch`, `WashRecipe`, `DistillationRun` (Python/FastAPI)
- Dashboard adaptado al aspecto copper/dark (ver mockup Gemini)

**P2 — Sprint 4-6**:
- Motor de recetas con DAG de operaciones
- Biblioteca precargada (mínimo 15 recetas: UJSSM, bourbon, gin London Dry, rum, grappa, limoncello...)
- Módulo de fermentación con iSpindel
- Distillation log con cortes

**P3 — Sprint 7-9**:
- Barrel Tracker con integración `@edge-apps/barrel-layout-engine`
- Blending Lab interactivo
- Bottling + generador de etiquetas con QR
- Técnicas modernas de aging (ultrasonic, pressure cycling)

**P4 — Sprint 10-12**:
- IoT Hub: MQTT broker, device registry, BLE/Zigbee/LoRa
- Firmware NeoParrot y NeoBarrel DIY (ESP32 + schematics)
- Live dashboard por batch con WebSocket

**P5 — Sprint 13-15**:
- AI Vision: modelos parrot reader + cut detector (MVP)
- Genio Destilador context-aware
- Compliance templates (AEAT España primero)

**P6 — Mes 5+**:
- Distillers Academy
- NeoStills Hub físico (hardware kit)
- Marketplace compra conjunta
- White-label para craft distilleries

---

## 19. REGLAS ADICIONALES PARA COPILOT

Complementan las reglas de la Parte 1:

1. **3D performance**: Lazy-cargar React Three Fiber solo cuando el usuario entra al configurador. Usar `next/dynamic` con `ssr: false`.
2. **IoT resilience**: Toda integración IoT debe funcionar con "device offline" como estado de primera clase. Los datos se cachean localmente (Redis) y se sincronizan al reconectar.
3. **AI Vision privacidad**: Las imágenes nunca se guardan en cloud por defecto. Flag explícito en configuración del usuario para habilitar almacenamiento.
4. **Edge-first**: El NeoStills Hub físico debe poder operar sin conexión a internet durante ≥72h (almacenamiento local + sync diferida).
5. **Compartir con BodegaData**: Antes de crear un componente de visualización de barricas, verificar si `@edge-apps/barrel-layout-engine` ya lo tiene. Si no, crearlo ahí (no en neostills directamente) para reutilización.
6. **MQTT idempotencia**: Todos los handlers de mensajes MQTT deben ser idempotentes (mismo mensaje 2 veces = mismo estado final).
7. **Seguridad IoT**: TLS obligatorio en MQTT (mosquitto con certificados), tokens rotados cada 30 días, devices con certificado propio.
8. **Time-series**: Usar TimescaleDB (extensión de PostgreSQL) para telemetría. Retention policies: raw data 30 días, agregados 1h 1 año, agregados 1d forever.
9. **Model versioning**: Todos los modelos de AI Vision versionados (MLflow o DVC). Cada inferencia registra `model_version` para auditabilidad.
10. **Docker Compose en monorepo**: Todos los servicios definidos en `docker-edge-apps/docker-compose.yml`. Desarrollo con `docker compose up neostills-web neostills-api mosquitto timescaledb`.

---

*Prompt Parte 2 — Abril 2026 · NeoStills*
*Extensión que cubre: onboarding, 3D, producción detallada, IoT Hub, AI Vision*
*Complementa y no reemplaza a `NeoStills_Copilot_Prompt.md` (Parte 1)*
