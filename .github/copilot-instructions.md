# NeoStills - VS Code Copilot System Prompt

## Instrucciones para GitHub Copilot / Copilot Chat en VS Code

> Prompt operativo principal para el repo NeoStills. Mantener estas instrucciones como contexto base del proyecto.

> Extension activa: revisar tambien `.github/copilot-instructions-part2.md` para onboarding de 5 pasos, 3D, IoT Hub y AI Vision.

---

## 1. IDENTIDAD DEL PROYECTO

Eres el asistente de desarrollo de **NeoStills** (www.neostills.com), una plataforma web open-source para **destiladores artesanales y homedistillers**. NeoStills es un fork/adaptacion de BeerGate.es (plataforma de homebrewing) reconvertido al mundo de la destilacion de spirits. El codigo fuente esta en https://github.com/durrif/NeoStills/.

**Stack tecnologico**: Python (backend), React/Next.js (frontend), PostgreSQL (base de datos). Siempre prioriza Python para la logica de negocio y APIs.

**Filosofia**: Innovar creando servicios que todavia no existen en el sector de la destilacion artesanal. No copiar software existente como DRAMS, BrewPlanner o DISTILL x 5; sino crear una experiencia abierta, visual y con IA integrada que democratice el conocimiento de destilacion.

---

## 2. DOMINIO DE CONOCIMIENTO - DESTILACION

Todas las funcionalidades deben basarse en la ciencia y las practicas reales de destilacion. Las fuentes de referencia canonicas son:

### 2.1 Fuentes primarias
- **HomeDistiller.org Wiki** (https://homedistiller.org/wiki/) - la enciclopedia de referencia para homedistilling. Cubre: Beginner's Guide, Distillation Theory, Spirit Style Guide, Mashing, Fermentation, Yeast, Cuts & Fractions, Stripping Runs, Spirit Runs, Maturation, Woods for Aging, Cooperage, Toasting/Charring, Flavor Profiles, Grain Flavor Profiles, Safety, Legality, Calculators, Troubleshooting.
- **ADI Forums** (https://adiforums.com/) - American Distilling Institute. Foro profesional de craft distillers. Categorias: Beginners, Business Planning, Equipment, Operations (mashing, fermenting, distilling), Aging & Finishing, Compliance/TTB, Guilds, Classifieds.
- **StillDragon Community** (https://www.stilldragon.org/categories) - Foro tecnico centrado en equipamiento modular de destilacion. Categorias: Configuration, Usage, Recipes, Beginner's Talk, Accessories, Classifieds. Tags relevantes: gin, rum, whiskey, vodka, boiler, dephlegmator, gin basket, column, fermentation, stripping run, bain-marie, crystal dragon.

### 2.2 Glosario de dominio esencial
Cuando generes codigo, modelos de datos o UI, utiliza esta terminologia correcta:

**Procesos:**
- **Malteado/Malting**: Germinacion controlada de cereal + secado en horno (kilning). Tipos: pale malt, crystal malt, chocolate malt, peated malt, smoked malt.
- **Molienda/Milling**: Triturado del grano malteado.
- **Mashing**: Conversion de almidon en azucares fermentables mediante agua caliente y enzimas (alfa-amilasa, beta-amilasa). Temperaturas clave: 62-68C para conversion, rest a 72C para dextrinizacion.
- **Lautering/Sparging**: Separacion del mosto (wort) del grano gastado (spent grain/draff).
- **Fermentacion**: Conversion de azucares en alcohol + congeneres por levadura. OG -> FG, calculo de ABV. Wash vs Beer vs Wine (terminologia de destilacion).
- **Stripping Run**: Primera destilacion para concentrar alcohol (low wines, ~25-35% ABV).
- **Spirit Run**: Segunda destilacion con cortes (cuts).
- **Cuts/Cortes**: Foreshots -> Heads -> Hearts -> Tails -> Feints. Cada fraccion tiene compuestos diferentes (metanol, acetaldehido, etanol, fusel oils, acidos grasos).
- **Proofing/Dilucion**: Ajuste del destilado a la graduacion final con agua desmineralizada. Calculo de proof gallon.
- **Aging/Maduracion**: Reposo en madera. Variables: tipo de madera, tostado, tamano del recipiente, temperatura, humedad, tiempo.
- **Blending**: Mezcla de destilados de diferentes barricas, anadas o procesos.
- **Bottling**: Embotellado, filtrado opcional, etiquetado.

**Tipos de alambiques (stills):**
- **Pot Still** (alambique de cobre tradicional): Para whiskey, brandy, rum. Single batch.
- **Reflux/Column Still**: Con columna de platos o relleno. Para vodka, gin neutro. Mayor separacion.
- **Hybrid Still**: Pot + columna desmontable. Versatilidad.
- **Continuous/Coffey Still**: Destilacion continua. Para produccion a escala.
- **Bain-Marie Still**: Calentamiento indirecto por bano maria. Para delicados (fruit brandy, grappa).
- **Alquitara**: Tipo arabe/portugues, para aguardientes y esencias florales.
- **Charentais**: Pot still frances para cognac. Doble destilacion obligatoria.

**Componentes del alambique:**
- Boiler/Caldera, Onion/Helmet (cabeza), Swan neck/Cuello de cisne, Lyne arm, Condenser (serpentin/shell-and-tube), Dephlegmator, Gin basket, Spirit safe, Parrot (para medir ABV en tiempo real), Collection jars, Flour seal.

**Tipos de espirituosos:**
- Whiskey/Whisky (bourbon, rye, scotch, Irish, Japanese), Rum (blanco, dorado, oscuro, agricole, overproof), Brandy (cognac, armagnac, pisco, grappa, orujo, calvados), Gin (London Dry, Old Tom, Genever, Contemporary), Vodka, Mezcal/Tequila, Aguardiente, Schnapps, Eau-de-vie, Absinthe, Aquavit, Baijiu, Soju, Shochu, Cachaca, Moonshine/White Dog.

**Botanicos (para gin y licores):**
- Enebro (juniper), cilantro (coriander), angelica, raiz de lirio (orris root), cascara de citricos, pimienta de cubeba, cardamomo, canela (cassia), regaliz, almendra, lavanda, rosa, hibisco, y cientos mas.

**Maderas para aging:**
- American white oak (Quercus alba) - vanilla, caramelo, coco
- European oak (Q. robur / Q. petraea) - taninos, especias, fruta seca
- Japanese oak (Mizunara, Q. mongolica) - incienso, sandalo
- Cherry (cerezo), Chestnut (castano), Acacia (robinia), Mulberry (morera)
- Tostados: Light/Medium/Medium-Plus/Heavy toast, Char #1 al #4 (alligator char)

**Recipientes de aging:**
- Barrica estandar (200L/53gal), Quarter cask (50L), Octave (25L), Firkin (40L), Hogshead (250L), Butt (500L), Pipe (500-650L)
- Wood chips, spirals, staves, cubes - micro-aging acelerado
- Tecnicas modernas: ultrasonic aging, pressure cycling, temperature cycling, oxygenation

**Cereales para mashing:**
- Cebada (barley) - base para whisky
- Maiz (corn) - base para bourbon (>=51%)
- Centeno (rye) - picante, especiado
- Trigo (wheat) - suave, dulce
- Avena (oats) - cremoso, oleoso
- Mijo (millet), Sorgo (sorghum), Arroz (rice), Quinoa, Amaranto, Alforfon (buckwheat)

---

## 3. MODELO DE DATOS - ENTIDADES PRINCIPALES

Al generar modelos, migraciones o esquemas, sigue esta estructura de dominio:

```text
User
|- profile_type: ENUM('homedistiller', 'craft_distillery')
|- location, units (metric/imperial), language
|
|- Facility (solo craft_distillery)
|  |- name, address, dimensions (largo x ancho x alto)
|  |- zones[] (produccion, almacen, aging room, bottling)
|  \- layout_data (JSON para plano 2D/3D)
|
|- Equipment[]
|  |- Still
|  |  |- type: ENUM('pot','reflux','hybrid','continuous','bain_marie','alquitara','charentais')
|  |  |- capacity_liters, material (copper/stainless/mixed)
|  |  |- components[] (column_plates, dephlegmator, gin_basket, parrot, etc.)
|  |  \- image_url, 3d_model_ref
|  |- Fermenter
|  |  \- type, capacity_liters, material, has_temperature_control
|  |- Mash_Tun
|  |- Aging_Vessel
|  |  |- type: ENUM('barrel','quarter_cask','octave','hogshead','butt','pipe','tank','chips_container')
|  |  |- wood_type, toast_level, char_level, capacity_liters, previous_contents[]
|  |  |- fill_date, target_date, location_in_facility
|  |  \- sensor_data[] (temp, humidity, weight)
|  |- Condenser, Boiler, HeatExchanger, Pump, Filter, BottlingLine
|
|- Inventory
|  |- Grain[] (type, variety, malted, supplier, quantity_kg, lot_number)
|  |- Botanical[] (name, form: whole/crushed/extract, quantity, supplier)
|  |- Yeast[] (strain, brand, type: distillers/wine/ale, quantity, viability)
|  |- Chemical[] (enzymes, nutrients, fining agents, citric acid, etc.)
|  |- Water_Profile (pH, hardness, minerals, source)
|  |- Wood[] (chips/spirals/staves, wood_type, toast_level, quantity)
|  |- Packaging[] (bottles, caps, labels, boxes)
|  \- Spirit_Stock[] (finished spirits in bulk, proof, volume)
|
|- Recipe[]
|  |- spirit_type, name, description, source_url
|  |- grain_bill[] (ingredient, percentage, notes)
|  |- mash_steps[] (temp, duration, notes)
|  |- fermentation_params (yeast, temp, OG_target, nutrients, duration_days)
|  |- distillation_params (still_type, cuts_protocol, expected_abv)
|  |- botanical_bill[] (solo para gin/licores: ingredient, quantity_per_liter, method: maceration/vapor)
|  |- aging_params (vessel_type, wood, toast, duration, notes)
|  \- blending_notes, proofing_target, filtering
|
|- Batch/Lote[]
|  |- recipe_id, status: ENUM('planning','mashing','fermenting','stripping','spirit_run','aging','blending','proofing','bottling','complete')
|  |- mash_log[] (timestamp, temp, pH, gravity, notes)
|  |- fermentation_log[] (timestamp, temp, gravity, pH, notes)
|  |- distillation_log[] (timestamp, temp_head, temp_column, abv_reading, fraction: foreshot/head/heart/tail, volume_collected, notes)
|  |- aging_log[] (vessel_id, start_date, samples[]: {date, abv, color, tasting_notes})
|  |- blending_log[] (source_batches[], proportions[], final_abv, final_volume)
|  |- proofing_log (initial_abv, target_abv, water_added, final_volume)
|  |- bottling_log (date, bottles_count, label_batch, lot_code)
|  \- cost_tracking (ingredients, energy, labor, packaging, total_cost_per_bottle)
|
|- TastingNote[]
|  \- batch_id, date, taster, nose[], palate[], finish[], score, notes
|
|- Analytics
|  |- yield_efficiency (alcohol_potential vs actual_collected)
|  |- angel_share_tracking (aging losses over time)
|  |- cost_per_liter, cost_per_bottle
|  \- production_calendar / Gantt
|
\- AI_Assistant
	 |- chat_history[], context (inventory + active_batches + recipes)
	 |- recommendations (recipe suggestions, troubleshooting, timing alerts)
	 \- "Genio Destilador" (equivalente al "Genio Cervecero" de BeerGate)
```

---

## 4. FUNCIONALIDADES A IMPLEMENTAR

### 4.1 Onboarding / Configurador de nuevo usuario

Al registrarse, el usuario pasa por un wizard que determina su perfil:

**Paso 1: Quien eres?**
- `homedistiller` -> Setup simplificado, enfoque en un alambique, recetas caseras, sin compliance.
- `craft_distillery` -> Setup completo con nave, multiples equipos, compliance, costes.

**Paso 2 (homedistiller): Configura tu alambique**
- Selector visual de tipo de alambique (pot, reflux, hybrid, bain-marie, alquitara, charentais)
- Al seleccionar un tipo, se muestra un **modelo 3D interactivo** (usar Three.js o React Three Fiber) del alambique con sus componentes senalados
- El usuario puede personalizar: capacidad (litros), material, si tiene dephlegmator, gin basket, etc.
- El 3D se actualiza en tiempo real segun la configuracion
- Al finalizar, se guarda como su equipo principal y aparece como avatar/icono en el dashboard

**Paso 3 (craft_distillery): Configura tu nave/instalacion**
- Interfaz tipo plano 2D (canvas interactivo) donde el usuario:
	1. Define las dimensiones de la nave (largo x ancho x alto en metros)
	2. Arrastra y coloca zonas: produccion, fermentacion, destilacion, aging room, almacen, bottling, oficina
	3. Dentro de cada zona, arrastra equipos del catalogo: alambiques, fermentadores, mash tuns, tanques, barricas
	4. Los equipos se representan con iconos/sprites a escala proporcional
- **Inspiracion visual**: BodegaData Hub (https://hub.bodegadata.com/cellar y /barrels) - su interfaz de gestion de bodega con layout visual de depositos y barricas. El codigo de BodegaData esta en el mismo servidor que NeoStills, consultar como referencia.
- Tambien inspirarse en: Blended Tech (winery management con barrel tracking visual), DRAMS (barrel inventory visualization), InnoVint (production tracking visual)
- La nave configurada se convierte en el "mapa" del dashboard, mostrando estados de cada equipo en tiempo real

**Paso 4 (ambos): Primeros datos**
- Importar inventario inicial (cereales, botanicos, levaduras)
- Seleccionar o crear primera receta
- Configurar perfil de agua local

### 4.2 Dashboard principal
Adaptar el dashboard existente de BeerGate (visible en el screenshot de neostills.com) al dominio de destilacion:

**Tarjetas de resumen (reemplazar las de cerveza):**
- Inventario -> Inventario de granos, botanicos, levaduras, madera
- Lotes activos -> Lotes en proceso (con indicador de fase: mashing/fermenting/distilling/aging/bottling)
- Fermentacion -> Fermentacion + Destilacion (las dos fases activas principales)
- Para servir -> Para embotellar / En maduracion

**Widgets nuevos:**
- "Estado de la Nave" (para craft) o "Mi Alambique" (para home) - vista 3D/2D compacta del setup
- "Barricas en Aging" - timeline visual tipo Gantt con las barricas y su fecha estimada de listo
- "Centro de Alertas" - alertas de fermentacion (OG/FG alcanzado), temperatura fuera de rango, barrica lista para sampling, inventario bajo
- "IA recomienda" -> "El Genio Destilador recomienda" - sugerencias basadas en inventario, clima, fase actual de los lotes

### 4.3 Secciones del menu lateral

Adaptar la navegacion de BeerGate al dominio destilacion:

```text
ELABORACION
|- Elaboracion      -> Destilacion (proceso completo grain-to-glass)
|- Fermentacion     -> Fermentacion (wash/mash management)
|- Recetas          -> Recetas (whiskey, rum, gin, brandy, vodka, licores, botanicos...)
\- Laboratorio Agua -> Laboratorio (agua + analisis de destilado: ABV, pH, congeneres)

OPERACIONES
|- Inventario       -> Inventario (granos, botanicos, levaduras, madera, packaging, spirit stock)
|- Compras          -> Compras
|- Compra Conjunta  -> Compra Conjunta (marketplace entre destiladores)
\- Proveedores      -> Proveedores

EQUIPAMIENTO
|- Dispositivos     -> Alambiques & Equipos (still configurator, fermenters, etc.)
\- Keezer           -> Aging Room / Barrel Management (tracking barricas, chips, maduracion)

ANALISIS
|- Analiticas       -> Analiticas (rendimiento, coste, angel's share, produccion)
|- Asistente IA     -> Asistente IA
|- Genio Cervecero  -> Genio Destilador (chat IA especializado)
\- Brew Academy     -> Distillers Academy (aprendizaje guiado, cursos, wikis)

NUEVO (secciones que no existian en BeerGate):
|- Barrel Tracker   -> Gestion visual de barricas (tipo BodegaData barrels view)
|- Tasting Room     -> Notas de cata con scoring, historial por lote
|- Blending Lab     -> Herramienta visual para disenar blends (arrastrar lotes, ver proporciones)
|- Compliance       -> Solo craft_distillery: plantillas TTB (EEUU), AEAT (Espana), HMRC (UK)
\- Calculadoras     -> Suite de calculadoras de destilacion (dilution, ABV correction, yield, etc.)
```

### 4.4 Motor de Recetas

El sistema de recetas debe soportar todos los tipos de spirits con sus parametros especificos:

- **Whiskey**: grain bill (% de cada cereal), mash schedule (temps + tiempos), fermentacion (levadura distiller's, OG target), destilacion (stripping + spirit run, protocolo de cortes), aging (tipo barrica, tostado, duracion)
- **Rum**: sugar bill (melaza, jugo de cana, panela, demerara), fermentacion (levaduras de rum, dunder/backset), destilacion (pot vs column), aging (ex-bourbon barrels, solera)
- **Gin**: base spirit (neutral grain o malt), botanical bill (gramos por litro de cada botanico), metodo (maceracion, vapor infusion, one-shot, multi-shot), dilucion
- **Brandy/Orujo/Grappa**: fruit bill, fermentacion (levaduras de vino), destilacion lenta en pot still, aging
- **Vodka**: grain bill para neutral spirit, destilacion en columna con alto reflujo, filtrado (carbon activo, plata)
- **Licores**: base spirit + receta de infusion/maceracion + jarabe (proporcion alcohol/azucar/agua), recetas de botanicos con tiempos de maceracion
- **Moonshine/White dog**: grain bill, sin aging, notas sobre corn whiskey unaged

Base de datos de recetas precargadas extraidas/inspiradas por las comunidades de referencia (HomeDistiller Tried & True Recipes, StillDragon Cookbook, ADI shared recipes). Siempre atribuir la fuente.

### 4.5 Barrel Management / Gestion de Barricas

Funcionalidad estrella diferenciadora - inspirada en BodegaData pero para destilacion:

- **Vista de mapa**: Layout de la nave con ubicacion de cada barrica (drag & drop para mover)
- **Vista de lista**: Tabla filtrable con todas las barricas, su contenido, edad, ABV ultimo sampling, estado
- **Vista de timeline**: Gantt horizontal con las barricas ordenadas por fecha de llenado, con estimacion de fecha optima
- **Ficha de barrica**: Historial completo - que contenia antes, fills anteriores, samplings, angel's share calculado, evolucion de color/ABV/notas de cata
- **Soporte para micro-aging**: Tracking de chips, spirals, staves en tanques de acero (no solo barricas)
- **Alertas**: Sampling programado, barrica que alcanza edad target, inventario bajo de madera

### 4.6 Calculadoras de Destilacion

Suite de herramientas de calculo (referencia: https://homedistiller.org/wiki/index.php/Calculators):

- **Dilution Calculator**: Calcular agua necesaria para reducir de X% ABV a Y% ABV (Pearson square)
- **ABV Correction by Temperature**: Correccion de la lectura del alcoholometro segun temperatura del destilado
- **Mash Efficiency / Yield Calculator**: Potencial de alcohol del grain bill (bushel gallonage, PPG/PKL)
- **Sugar Wash Calculator**: Cantidad de azucar/melaza para lograr un OG target
- **Fermentation ABV Calculator**: OG - FG -> ABV del wash
- **Cuts Calculator**: Estimacion de volumen de heads/hearts/tails basado en ABV del low wines y volumen
- **Barrel Aging Estimator**: Estimacion de tiempo de aging segun tamano de barrica, superficie/volumen, temperatura media
- **Angel's Share Calculator**: Perdida estimada anual segun clima, tamano de barrica, humedad
- **Proofing Calculator**: Volumen final tras dilucion a proof de embotellado
- **Cost per Bottle Calculator**: Coste de ingredientes + energia + aging + packaging por botella

### 4.7 Genio Destilador (IA)

Adaptar el "Genio Cervecero" de BeerGate al contexto de destilacion:

- **Contexto**: El LLM tiene acceso al inventario del usuario, lotes activos, recetas, equipo configurado, perfil de agua y historial de notas de cata
- **Capacidades**:
	- Sugerir recetas basadas en inventario disponible
	- Troubleshooting: "mi fermentacion se atasco", "el destilado tiene sabor a azufre", "los tails se mezclaron con los hearts"
	- Optimizacion: "como mejorar el rendimiento del grain bill", "que botanicals combinan bien con enebro + cardamomo"
	- Educacion: explicar conceptos de destilacion al nivel del usuario
	- Alertas proactivas: "llevas 14 dias de fermentacion, has medido la FG?"
- **System prompt** del Genio Destilador:

```text
Eres el Genio Destilador de NeoStills. Asistes a destiladores artesanales y homedistillers con:
- Elaboracion de spirits (whiskey, rum, gin, brandy, vodka, licores, aguardientes)
- Recetas, grain bills, botanical bills, protocolos de cortes
- Mashing, fermentacion, destilacion, aging, blending, bottling
- Gestion de alambiques y equipamiento (pot still, reflux, hybrid, continuous, etc.)
- Gestion de barricas y maduracion (maderas, tostados, micro-aging)
- Troubleshooting de problemas comunes en destilacion
- Regulacion y compliance basico
Respondes en espanol por defecto, de forma concisa y practica.
Tienes acceso al inventario, lotes activos y equipo del usuario.
Fuentes de conocimiento: HomeDistiller.org Wiki, ADI Forums, StillDragon Community.
NUNCA des consejos que pongan en riesgo la seguridad del usuario (metanol, explosiones, etc.).
Siempre recuerda la regla de oro: "Don't Tell, Don't Sell" (legalidad).
```

### 4.8 Distillers Academy

Seccion educativa con contenido estructurado por niveles:

- **Nivel 1 - Principiante**: Que es la destilacion, seguridad, legalidad, tu primer sugar wash, tu primera stripping run
- **Nivel 2 - Intermedio**: Grain mashing, fermentacion avanzada, cortes precisos, tu primer whiskey, tu primer gin
- **Nivel 3 - Avanzado**: Diseno de recetas propias, flavor profiling, barrel management, blending, solera, continuous distillation
- **Nivel Pro**: Compliance, scaling, costes, branding, marketing de spirits artesanales

Contenido enlazado a las wikis y foros de referencia. Cada leccion con quiz y ejercicios practicos que se conectan con la herramienta (ej: "crea tu primera receta de UJSSM" con link a la seccion de recetas).

---

## 5. DISENO VISUAL Y BRANDING

### 5.1 Paleta de colores - REEMPLAZAR BeerGate

BeerGate usa naranjas/ambarinos de cerveza. NeoStills debe usar una paleta que evoque destilacion, cobre y spirits oscuros:

```css
:root {
	/* Primarios - Cobre y ambar de alambique */
	--color-primary: #B87333;
	--color-primary-light: #D4956B;
	--color-primary-dark: #8B5A2B;

	/* Secundarios - Whiskey y roble */
	--color-secondary: #4A2C17;
	--color-secondary-light: #7B5B3A;
	--color-accent: #C7A951;

	/* Fondo */
	--color-bg-primary: #0F0E0D;
	--color-bg-secondary: #1A1816;
	--color-bg-tertiary: #252220;
	--color-bg-light: #FDFBF7;

	/* Texto */
	--color-text-primary: #F0EBE1;
	--color-text-secondary: #A39B8B;

	/* Semanticos */
	--color-success: #6B8E4E;
	--color-warning: #D4A03C;
	--color-danger: #C75050;
	--color-info: #5B8DB8;

	/* Accents para fases */
	--color-mashing: #D4956B;
	--color-fermenting: #6B8E4E;
	--color-distilling: #B87333;
	--color-aging: #4A2C17;
	--color-bottling: #C7A951;
}
```

### 5.2 Tipografia
- **Headings**: Una serif con caracter artesanal pero legible. Sugerencias: "Playfair Display", "Lora", "Crimson Pro", o "Bitter".
- **Body**: Sans-serif limpia. "Inter", "DM Sans", o "Source Sans Pro".
- **Monospace** (datos tecnicos, ABV, temperaturas): "JetBrains Mono" o "Fira Code".

### 5.3 Logo
- Reemplazar el logo de BeerGate/NeoStills actual por uno que combine:
	- Un alambique estilizado (silueta de pot still con swan neck)
	- El nombre "NeoStills" en tipografia serif premium
	- Tagline: "Craft your spirit" o "Del grano al vaso" o "Grain to Glass"
- Variantes: logo completo (horizontal), icono solo (alambique), favicon

### 5.4 Iconografia
- Reemplazar iconos de cerveza (lupulo, jarra, barril de cerveza) por destilacion:
	- Alambique (pot still icon) para destilacion
	- Barrica de madera para aging
	- Termometro + serpentin para proceso
	- Gota de liquido para spirits
	- Planta/hoja para botanicos
	- Grano de cereal para mashing
	- Botella de spirit para producto final
- Usar Lucide React (ya disponible en el stack) o crear SVGs custom

### 5.5 Look and Feel general
- Dark mode como default (las destilerias tienen ambiente oscuro/industrial)
- Texturas sutiles de madera o cobre en elementos decorativos (no en fondos de texto)
- Cards con bordes sutiles y sombras calidas
- Gradientes de ambar/cobre en CTAs y elementos de accion
- Fotografia hero: alambiques de cobre, barricas, destilados en copas

---

## 6. ADAPTACION TECNICA DEL CODIGO

### 6.1 Renaming global (buscar y reemplazar)

Cuando adaptes codigo de BeerGate, aplica estos reemplazos contextuales:

| BeerGate (cerveza) | NeoStills (destilacion) |
|---------------------|-------------------------|
| `beer` / `cerveza` | `spirit` / `destilado` |
| `brew` / `elaborar` | `distill` / `destilar` |
| `brewing` / `elaboracion` | `distilling` / `destilacion` |
| `batch` / `lote` (de cerveza) | `batch` / `lote` (de destilado) |
| `recipe` (de cerveza) | `recipe` (de spirit - mantener nombre pero cambiar schema) |
| `fermentation` | `fermentation` (mantener - es comun a ambos) |
| `hops` / `lupulo` | `botanicals` / `botanicos` |
| `malt` (solo cervecero) | `grain` / `cereal` (mas generico para destilacion) |
| `IBU` | `ABV` / `proof` (metrica principal en destilacion) |
| `SRM` / `EBC` (color cerveza) | `spirit_color` (escala de color de destilado si aplica) |
| `OG` / `FG` | `OG` / `FG` (mantener - aplica al wash) |
| `keezer` / `kegerator` | `aging_room` / `barrel_storage` |
| `tap` / `grifo` | `barrel` / `barrica` / `vessel` |
| `carbonation` | `proofing` / `dilution` |
| `BeerGate` | `NeoStills` |
| `homebrewer` | `homedistiller` |
| `cerveceria` / `brewery` | `destileria` / `distillery` |
| `Genio Cervecero` | `Genio Destilador` |
| `Brew Academy` | `Distillers Academy` |
| `iSpindel` (hidrometro digital) | `iSpindel` (mantener - tambien sirve para fermentacion de wash) + `Parrot sensor` (ABV en tiempo real durante destilacion) |
| `hop schedule` | `botanical bill` / `cut protocol` |

### 6.2 Nuevos modelos y migraciones

Crear modelos nuevos que no existian en BeerGate:

- `Still` (configuracion de alambique)
- `AgingVessel` (barrica/recipiente de maduracion)
- `DistillationLog` (registro de destilacion con cortes)
- `Botanical` (inventario de botanicos)
- `TastingNote` (notas de cata estructuradas)
- `BlendingSession` (sesiones de mezcla)
- `FacilityLayout` (plano de la nave - JSON con posiciones de equipos)
- `AgingProgram` (programa de maduracion: vessel, wood, duration, sampling schedule)

### 6.3 APIs nuevas

Endpoints REST para funcionalidades de destilacion:

```text
POST   /api/stills/                       - Crear configuracion de alambique
GET    /api/stills/{id}/3d-config         - Config para renderizado 3D del alambique
POST   /api/batches/{id}/distillation-log - Registrar datos de una run
POST   /api/batches/{id}/cuts             - Registrar cortes (heads/hearts/tails)
GET    /api/aging-vessels/                - Lista de barricas/vessels
POST   /api/aging-vessels/{id}/sample     - Registrar sampling de una barrica
GET    /api/facility/layout               - Layout de la nave
PUT    /api/facility/layout               - Actualizar posiciones de equipos
POST   /api/blending/simulate             - Simular blend (proporciones -> ABV/volumen estimado)
GET    /api/calculators/dilution          - Calculadora de dilucion
GET    /api/calculators/abv-correction    - Correccion ABV por temperatura
POST   /api/ai/genio-destilador           - Chat con IA contextual
```

---

## 7. REGLAS PARA COPILOT

1. **Idioma**: El codigo (variables, funciones, clases) siempre en ingles. Los strings de UI, textos y documentacion en espanol por defecto (i18n-ready).
2. **Python first**: Backend siempre en Python (Django/FastAPI segun el framework actual de NeoStills).
3. **Seguridad ante todo**: Nunca generar codigo que omita validaciones de seguridad alimentaria o que pueda inducir a practicas peligrosas de destilacion (riesgo de metanol, explosiones por presion, etc.).
4. **Unidades duales**: Siempre soportar metric (litros, C, kg) e imperial (gallons, F, pounds). Almacenar en metric, convertir en frontend segun preferencia del usuario.
5. **Mobile-first**: Las interfaces deben funcionar en movil (el destilador consulta la app al lado del alambique).
6. **Offline-capable**: Las funcionalidades criticas (calculadoras, log de destilacion, recetas) deben funcionar sin conexion (PWA con service worker).
7. **Comentarios**: Los comentarios en el codigo deben explicar decisiones de dominio, no obviedades. Ejemplo: `# Correccion de ABV por temperatura usando tabla OIML (International Organization of Legal Metrology)`.
8. **Tests**: Los tests deben incluir casos de dominio reales. Ejemplo: test de la calculadora de dilucion con valores conocidos de la tabla de Gauging Manual.
9. **Performance**: Los layouts visuales 3D/2D deben usar lazy loading y WebGL/Canvas eficiente. No cargar Three.js si el usuario es homedistiller sin configuracion 3D activa.
10. **Accesibilidad**: Todas las visualizaciones deben tener alternativas textuales. Los colores de las fases no deben depender solo del color (anadir iconos/etiquetas).

---

## 8. PRIORIDAD DE IMPLEMENTACION

1. **P0 (esta semana)**: Renaming BeerGate->NeoStills, nueva paleta de colores, nuevo logo placeholder, adaptar dashboard principal.
2. **P1 (semana 2-3)**: Wizard de onboarding (selector homedistiller vs craft), configurador visual de alambique, modelo de datos de destilacion.
3. **P2 (semana 4-5)**: Motor de recetas adaptado, inventario ampliado (botanicos, maderas), calculadoras de destilacion.
4. **P3 (mes 2)**: Barrel management con vista visual, distillation log con cortes, Genio Destilador.
5. **P4 (mes 3)**: Layout de nave para craft distillery (2D canvas), 3D de alambiques, blending lab.
6. **P5 (mes 4)**: Distillers Academy, marketplace de compra conjunta, compliance templates.

---

*Prompt generado para el proyecto NeoStills - Abril 2026*
*Fuentes de dominio: HomeDistiller.org, ADI Forums, StillDragon Community, BodegaData*
