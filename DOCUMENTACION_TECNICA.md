# Documentación Técnica — Visor Predial San Andrés

## 1. Resumen ejecutivo

El **Visor Predial · San Andrés** es una aplicación web cartográfica de tipo *cliente puro* (sin backend, sin build step, sin dependencias de servidor) que permite consultar información catastral de los predios del municipio de San Andrés (código DANE `88001`), publicada para la Gobernación del Archipiélago. El usuario navega un mapa interactivo, selecciona un predio dibujado como polígono y consulta en un panel lateral sus datos catastrales (nombre del propietario, matrícula inmobiliaria, dirección, áreas, destino económico y avalúo), con la posibilidad de abrir la ficha de caracterización en PDF asociada.

Todo el sistema se compone de **3 archivos de código** (`index.html`, `style.css`, `app.js`) y **2 archivos de datos** (`predios_data.js` y `predioss.geojson`, ambos de ~2.3 MB), más una carpeta de fichas PDF. No usa frameworks (React, Vue, etc.), no usa gestor de paquetes (npm/yarn) ni bundler (Webpack/Vite): es HTML/CSS/JS servido tal cual.

---

## 2. Objetivo funcional

Ofrecer una herramienta de consulta pública/interna que traduzca la base catastral (típicamente un shapefile o geodatabase de origen IGAC/Catastro Multipropósito) en un visor accesible desde cualquier navegador, sin necesidad de software SIG (ArcGIS, QGIS) para el usuario final.

---

## 3. Arquitectura general

```
┌─────────────────────────────────────────────────────────┐
│                       Navegador                          │
│                                                           │
│  index.html  ──carga──▶  leaflet.css / leaflet.js (CDN)  │
│      │                                                    │
│      ├──carga──▶ data/predios_data.js  (var PREDIOS_DATA)│
│      │                                                    │
│      └──carga──▶ app.js                                  │
│                     │                                     │
│                     ├─ initMap()  → crea mapa Leaflet     │
│                     ├─ L.geoJSON(PREDIOS_DATA) → polígonos│
│                     ├─ selectPredio() → pinta panel        │
│                     └─ openPdf() → window.open(pdf)        │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
              data/pdfs/<CODIGO>.pdf (fichas)
```

No existe capa de servidor propia: el "backend" es un archivo estático (`predios_data.js`) generado offline a partir de la fuente catastral y servido junto con el HTML. Esto convierte al visor en desplegable en **cualquier hosting estático** (GitHub Pages, S3, Netlify, IIS, Apache) sin necesidad de base de datos ni API.

---

## 4. Stack tecnológico

| Componente | Tecnología | Origen |
|---|---|---|
| Motor de mapas | [Leaflet 1.9.4](https://leafletjs.com/) | CDN `unpkg.com` |
| Capa base (basemap) | OpenStreetMap tiles (`{s}.tile.openstreetmap.org`) | Servicio público OSM |
| Lógica de aplicación | JavaScript vanilla (ES5/ES6, sin módulos) | `app.js` |
| Estilos | CSS puro con variables (`:root`) | `style.css` |
| Datos geoespaciales | GeoJSON (`FeatureCollection` de polígonos) | `predios_data.js` / `predioss.geojson` |
| Documentos anexos | PDF estáticos | `data/pdfs/*.pdf` |

No hay `package.json`, no hay transpilación, no hay linter configurado, no hay tests. Es intencionalmente minimalista: **cero dependencias de build**.

---

## 5. Estructura del proyecto

```
visor_SA/
├── index.html                 # Shell de la app: header, mapa, panel lateral
├── style.css                  # Sistema visual (layout, tipografía, componentes)
├── app.js                     # Toda la lógica de interacción
└── data/
    ├── predios_data.js        # GeoJSON envuelto en `var PREDIOS_DATA = {...}`
    ├── predioss.geojson       # Mismo dataset en formato .geojson "puro"
    └── pdfs/
        ├── 880010000000000070018000000000.pdf
        ├── 880010000000000070072000000000.pdf
        ├── 880010000000000142128000000000.pdf
        └── 880010100000002710001000000000.pdf
```

### ¿Por qué existen `predios_data.js` y `predioss.geojson` a la vez?

Ambos contienen exactamente el mismo `FeatureCollection`. La diferencia es el envoltorio:

- `predioss.geojson` es el **export crudo** (probablemente desde ArcGIS/QGIS), útil como fuente de verdad / respaldo, y para volver a abrirlo en herramientas SIG.
- `predios_data.js` es el mismo contenido **envuelto como asignación a una variable JS** (`var PREDIOS_DATA = {...}`) y cargado con `<script src="data/predios_data.js">`.

Esta segunda forma es una técnica deliberada para evitar el problema clásico de **CORS/`fetch` bloqueado al abrir `index.html` directamente desde el sistema de archivos** (`file://`). Un `fetch('data/predioss.geojson')` falla en Chrome/Edge bajo el protocolo `file://` porque XHR/fetch a recursos locales está restringido por política de seguridad del navegador. Envolver el JSON como variable global y cargarlo con una etiqueta `<script>` evita ese problema por completo, porque los `<script>` no están sujetos a la misma restricción. Esto permite que el visor funcione **haciendo doble clic en `index.html`**, sin levantar un servidor local — a costa de duplicar 2.3 MB de datos en el repositorio.

---

## 6. Modelo de datos

### 6.1 Formato

`FeatureCollection` estándar GeoJSON, con geometrías tipo `Polygon` (un anillo exterior por predio, coordenadas en WGS84 lon/lat).

### 6.2 Volumetría real (medida sobre el dataset actual)

- **884 features** (predios) en total.
- **263 features** tienen atributos catastrales poblados (nombre, dirección, avalúo, etc.).
- Los **621 restantes** son geometrías con propiedades vacías (campos `" "` o `0`), es decir, predios presentes en la cartografía pero sin cruce/actualización con el registro alfanumérico catastral (situación típica en procesos de conservación catastral incompletos).
- Solo **4 fichas PDF** existen en `data/pdfs/`, frente a 884 predios — ver limitación en sección 11.

### 6.3 Origen de los campos (estructura IGAC "Registro 1 / Registro 2")

Los prefijos `R1_` y `R2_` en las propiedades corresponden al estándar de intercambio catastral colombiano:

- **`R1_*`** — *Registro 1: datos del predio* (nivel predio/propietario):
  `R1_Nombre`, `R1_Direcci` (dirección), `R1_Destino` (código de destino económico), `R1_AreaTer` (área de terreno), `R1_AreaCon` (área construida), `R1_Avaluo`, `R1_TipoDoc`/`R1_NoDocum` (documento del propietario), `R1_Vigenci` (vigencia catastral).
- **`R2_*`** — *Registro 2: datos de la construcción/unidad* (nivel construcción, hasta 3 sub-registros: base, `_1`, `_2`):
  `R2_Matricu` (matrícula inmobiliaria), `R2_Habitac` (habitaciones), `R2_Baños`, `R2_Locales`, `R2_Pisos`, `R2_Estrato`, `R2_Destino`, `R2_ZonaFis`/`R2_ZonaEco` (zonas geoeconómicas para avalúo).

Otros campos relevantes fuera de R1/R2:

| Campo | Descripción |
|---|---|
| `CODIGO` | Número Predial Nacional (NPN) — clave usada para vincular el predio con su ficha PDF |
| `MANZANA_CO` | Código de manzana catastral |
| `CODIGO_ANT` | Código predial anterior (histórico) |
| `PH` | Indicador de Propiedad Horizontal (`Sí`/`No`) |
| `Cond` | Condición del predio (`Privado`, etc.) |
| `AREA_HA` / `HA` | Área en hectáreas calculada desde geometría |
| `Shape_Area` / `Shape_Le_*` | Métricas geométricas (área/perímetro) calculadas por el SIG de origen |
| `GLOBALID` / `GLOBALID_S` | Identificadores GUID de la geodatabase origen (ArcGIS) |
| `USUARIO_LO` / `FECHA_LOG` | Auditoría de captura/edición (usuario y timestamp epoch) |

### 6.4 Diccionario de destino económico (`app.js`)

`app.js` mantiene localmente un diccionario `DESTINO_LABELS` que traduce el código de una letra del campo `R1_Destino` a una etiqueta legible:

```js
var DESTINO_LABELS = {
  'A': 'Habitacional', 'B': 'Industrial', 'C': 'Comercial',
  'D': 'Agropecuario', 'E': 'Minero', 'F': 'Cultural',
  'G': 'Recreacional / Deportivo', 'H': 'Salubridad',
  'I': 'Institucional', 'J': 'Lote sin construcción',
  'K': 'Educativo', 'L': 'Religioso', 'P': 'Pecuario',
  'R': 'Recreación y deporte', 'S': 'Servicios especiales',
  'T': 'Transporte y comunicaciones'
};
```

Esta tabla corresponde a la codificación estándar de destinos económicos usada en catastro colombiano (resoluciones IGAC).

---

## 7. Detalle de implementación

### 7.1 `index.html` — Shell de la aplicación

Estructura semántica mínima:

- `<header>`: título del visor + subtítulo institucional + contador de predios (`#stat-count`).
- `<main>`: contenedor flex con dos zonas:
  - `#map` (65% del ancho): contenedor donde Leaflet inyecta el canvas del mapa.
  - `#panel` (35% del ancho): panel lateral con dos estados mutuamente excluyentes controlados por clase `.hidden`:
    - `#panel-empty`: estado inicial (icono + mensaje "Selecciona un predio...").
    - `#panel-detail`: ficha de datos del predio seleccionado (oculta hasta que se hace clic en un polígono).

Carga de scripts al final del `<body>` (Leaflet CDN → datos → lógica), lo que garantiza que el DOM ya existe cuando `app.js` ejecuta `initMap()` sin necesitar un listener de `DOMContentLoaded`.

### 7.2 `style.css` — Sistema visual

- Paleta definida por variables CSS en `:root` (`--primary: #1D9E75` verde institucional, `--text`, `--muted`, `--border`, `--bg`).
- Layout basado en Flexbox: `body` en columna (header + main), `main` en fila (mapa + panel), altura 100vh sin scroll de página (`overflow: hidden` en `body`), dejando el scroll únicamente dentro del panel (`#panel { overflow-y: auto }`).
- Sin framework CSS (Bootstrap/Tailwind): todo el diseño (tabla de datos, caja de avalúo, botones) está escrito a mano con selectores de clase simples.
- Estado vacío/detalle alternado con la clase utilitaria `.hidden { display: none }`.

### 7.3 `app.js` — Lógica de la aplicación

Módulo único en el ámbito global (sin IIFE ni módulos ES), con las siguientes responsabilidades:

**a) Inicialización del mapa (`initMap`)**

```js
map = L.map('map').setView([12.5567, -81.7032], 14);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {...}).addTo(map);
L.geoJSON(PREDIOS_DATA, {
  style: DEFAULT_STYLE,
  onEachFeature: function(feature, layer) {
    layer.on('click', function() { selectPredio(feature, layer); });
    allLayers.push(layer);
  }
}).addTo(map);
```

- Centro fijo en las coordenadas de la isla de San Andrés (`12.5567, -81.7032`), zoom inicial 14.
- Cada uno de los 884 polígonos se registra con un listener de `click` propio (no delegación de eventos), y se guarda una referencia en el arreglo global `allLayers` — usado únicamente para contar cuántos predios se cargaron (`updateStats`).

**b) Estilado de polígonos por estado**

Dos objetos de estilo predefinidos:

```js
DEFAULT_STYLE   = { fillColor:'#1D9E75', color:'#fff', weight:1, fillOpacity:0.55, opacity:0.9 }
HIGHLIGHT_STYLE = { fillColor:'#0F6E56', color:'#111827', weight:2.5, fillOpacity:0.85, opacity:1 }
```

El estado de "seleccionado" se gestiona con una única variable `activeLayer`: al hacer clic en un nuevo predio, se restaura el estilo por defecto del anterior (`activeLayer.setStyle(DEFAULT_STYLE)`) antes de aplicar `HIGHLIGHT_STYLE` al nuevo — patrón simple de selección única, sin soporte multi-selección.

**c) Saneamiento de datos (`clean`)**

```js
function clean(val) {
  return (val && String(val).trim()) ? String(val).trim() : null;
}
```

Dado que ~70% de los predios (621/884) tienen campos vacíos representados como `" "` (espacio) en vez de `null`/ausentes —artefacto típico de exports desde geodatabases Esri, donde los campos de texto no admiten NULL real—, esta función normaliza esos espacios en blanco a `null`, permitiendo aplicar de forma consistente el patrón `clean(x) || '—'` para mostrar un guion cuando el dato no existe, en lugar de una celda en blanco ambigua.

**d) Selección y render del panel (`selectPredio`)**

Al hacer clic sobre un polígono:

1. Reestablece el estilo del predio previamente activo.
2. Aplica `HIGHLIGHT_STYLE` al nuevo y lo guarda como `activeLayer` / `currentFeature`.
3. Extrae y formatea los atributos:
   - **Nombre**: `R1_Nombre` saneado, o fallback `"Predio " + CODIGO` si no hay nombre.
   - **Áreas**: formateadas con `Number.toLocaleString('es-CO')` + sufijo `m²`, solo si el área es `> 0`.
   - **Avalúo**: formateado con `Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })` — produce montos tipo `$ 1.560.000`.
   - **Destino**: traducido vía `DESTINO_LABELS`, con fallback al código crudo si no está en el diccionario.
4. Escribe los valores en el DOM vía `textContent` (no `innerHTML` — evita inyección de HTML/XSS a partir de datos del GeoJSON).
5. Alterna las clases `.hidden` entre `#panel-empty` y `#panel-detail`.

**e) Apertura de ficha PDF (`openPdf`)**

```js
function openPdf() {
  if (currentFeature) {
    var codigo = currentFeature.properties.CODIGO;
    window.open('data/pdfs/' + codigo + '.pdf', '_blank');
  }
}
```

Construye la ruta del PDF concatenando directamente el `CODIGO` (Número Predial Nacional) del predio activo con la carpeta `data/pdfs/`. **No verifica previamente si el archivo existe**: si el PDF no está presente, el navegador simplemente abre una pestaña con error 404. Dado que solo 4 de 884 predios tienen PDF real, este botón fallará silenciosamente (sin feedback al usuario) en la gran mayoría de los casos.

**f) Contador de predios (`updateStats`)**

Actualiza `#stat-count` con `allLayers.length + ' predios'` tras la carga inicial — es un conteo estático de features cargadas, no un contador de features visibles/filtradas (no hay filtros implementados).

---

## 8. Flujo de interacción del usuario

```
Carga de página
   │
   ▼
initMap() ejecuta al final de app.js (top-level call)
   │
   ├─ Crea mapa Leaflet centrado en San Andrés
   ├─ Añade tiles de OpenStreetMap
   ├─ Dibuja 884 polígonos desde PREDIOS_DATA
   └─ Actualiza contador "884 predios"
   │
   ▼
Usuario hace clic en un polígono
   │
   ├─ selectPredio(feature, layer)
   │     ├─ Resalta el polígono (HIGHLIGHT_STYLE)
   │     ├─ Popula el panel derecho con datos catastrales
   │     └─ Muestra #panel-detail / oculta #panel-empty
   │
   ▼
Usuario pulsa "Ver ficha de caracterización"
   │
   └─ openPdf() → abre data/pdfs/<CODIGO>.pdf en pestaña nueva
   │
   ▼
Usuario pulsa "Cerrar"
   │
   └─ closePanelDetail() → restaura estilo del polígono,
      limpia selección, vuelve a mostrar #panel-empty
```

---

## 9. Decisiones de diseño técnico destacables

1. **Cero backend / cero build** → despliegue trivial en cualquier hosting estático; costo cero de mantenimiento de infraestructura, pero también cero capacidad de lógica server-side (autenticación, búsqueda indexada, actualización incremental de datos).
2. **Datos embebidos como variable JS** en vez de `fetch` a `.geojson` → prioriza que el visor funcione abriendo el archivo localmente (`file://`) sin necesitar un servidor HTTP, a costa de tener que regenerar/duplicar `predios_data.js` cada vez que cambien los datos fuente.
3. **`textContent` en vez de `innerHTML`** al pintar el panel → previene XSS por datos catastrales maliciosos/corruptos, buena práctica de seguridad aunque no esté documentada explícitamente en el código.
4. **Selección única con reseteo manual de estilo** en vez de usar una capa `L.geoJSON` con `style` dinámico por función → funciona bien a esta escala (884 features) pero no escalaría bien a decenos de miles sin usar canvas rendering o clustering.
5. **Sin dependencia de claves de API** (Leaflet + OSM son 100% gratuitos/sin API key) → simplifica despliegue pero hereda las limitaciones de uso razonable ("fair use") de los tiles públicos de OpenStreetMap.

---

## 10. Rendimiento y escalabilidad

- El payload de datos (`predios_data.js`, 2.3 MB) se descarga completo en cada carga de página, sin paginación ni carga diferida (lazy loading) por viewport/zoom.
- Leaflet renderiza los 884 polígonos vía SVG (renderer por defecto), lo cual es aceptable a esta escala, pero empezaría a degradar el rendimiento de interacción (paneo/zoom) si el dataset creciera a varios miles de predios sin cambiar a `L.Canvas` como renderer o introducir clustering/simplificación geométrica por nivel de zoom.
- No hay índice espacial en cliente: la búsqueda de un predio por código/nombre no está implementada (no hay caja de búsqueda en la UI actual).

---

## 11. Limitaciones conocidas del estado actual

| Limitación | Detalle |
|---|---|
| **Cobertura de fichas PDF** | Solo 4 de 884 predios (0.45%) tienen ficha PDF disponible; el resto producirá una pestaña con error 404 al pulsar "Ver ficha de caracterización" sin mensaje de error visible para el usuario. |
| **Datos catastrales incompletos** | 621 de 884 geometrías (70%) no tienen atributos alfanuméricos cruzados (nombre, avalúo, matrícula vacíos), mostrando "—" en casi todos los campos del panel. |
| **Sin buscador** | No existe forma de localizar un predio por código, matrícula o dirección; solo navegación visual sobre el mapa. |
| **Sin autenticación/roles** | Todo el dataset (incluidos nombres de propietarios y documentos de identidad en `R1_TipoDoc`/`R1_NoDocum`) es público para quien acceda a la URL — a considerar si se publica en internet abierto, dado que contiene datos personales. |
| **Duplicación de datos** | `predios_data.js` y `predioss.geojson` deben mantenerse sincronizados manualmente; no hay script de generación automatizado incluido en el repositorio. |
| **Sin manejo de errores de red** | Si el tile server de OSM o el script de datos fallan en cargar, no hay mensaje de error visible — el mapa simplemente queda vacío o roto. |

---

## 12. Consideraciones de privacidad

El dataset incluye, para los predios con atributos poblados, el **tipo y número de documento de identidad del propietario** (`R1_TipoDoc`, `R1_NoDocum`) además de su nombre completo. Al estar embebidos directamente en un archivo JS servido de forma estática y sin control de acceso, estos datos son accesibles por cualquiera con la URL del visor o del archivo `predios_data.js`/`predioss.geojson`. Si el visor se publica en un dominio de acceso público, se recomienda evaluar si esta exposición cumple la normativa de tratamiento de datos personales aplicable (Ley 1581 de 2012 en Colombia), o si esos campos deben excluirse del export antes de publicar.

---

## 13. Roadmap técnico sugerido (no implementado)

- Buscador de predios por código/matrícula/dirección (filtro sobre `allLayers`/`PREDIOS_DATA`).
- Completar la cobertura de fichas PDF o mostrar un estado deshabilitado del botón cuando no exista ficha para el `CODIGO` seleccionado.
- Migrar el renderer de Leaflet a `L.Canvas` o introducir `Leaflet.markercluster`/simplificación geométrica si el dataset crece.
- Automatizar la generación de `predios_data.js` a partir de `predioss.geojson` (o de la fuente SIG original) con un script de build, eliminando la sincronización manual.
- Evaluar anonimización/enmascaramiento de documentos de identidad antes de publicar el visor en un entorno de acceso público.
- Añadir manejo de errores visible (toast/mensaje) cuando falle la carga de tiles, datos o PDF.

---

## 14. Resumen de archivos

| Archivo | Líneas / Tamaño | Rol |
|---|---|---|
| `index.html` | 57 líneas | Estructura DOM y carga de dependencias |
| `style.css` | ~204 líneas | Sistema visual completo |
| `app.js` | 123 líneas | Toda la lógica: mapa, selección, formateo, panel, PDF |
| `data/predios_data.js` | 2.3 MB / 884 features | Dataset catastral embebido como variable JS |
| `data/predioss.geojson` | 2.3 MB / 884 features | Mismo dataset en GeoJSON puro (fuente/respaldo) |
| `data/pdfs/*.pdf` | 4 archivos | Fichas de caracterización predial (cobertura parcial) |

---

## Capa de predios patrimoniales

- **Datos:** `data/patrimonio_data.js` (`var PATRIMONIO_DATA = {...}`), generado con `build_patrimonio.py` a partir de `Patrimonio_material_cultural_Urbano.shp` (126) y `Patrimonio_material_cultural_Rural.shp` (141) del ANEXO 4.1, reproyectados de MAGNA-SIRGAS Origen Nacional a WGS84. Mismo esquema R1/R2 que los predios, más `inmueble` (U-n / R-n), `ZONA`, `FICHA` y `FOTO`.
- **Fichas:** `data/fichas_patrimonio/U-n.pdf` (copia del ANEXO 4.3). Se abren con "Ver ficha de caracterización". Los rurales no tienen ficha y el botón aparece deshabilitado.
- **Fotos de fachada:** `data/fotos_patrimonio/U-n.jpg`, extraídas de la sección "7. Fotografía general" de cada ficha (95 de 126; las demás no traen foto).
- **Visualización:** polígonos naranja (`#D97706`, borde `#7C2D12`), con insignia "Bien patrimonial" en el panel, leyenda y control para activar/desactivar cada capa.
- **Predios en ambas capas (6):** se muestran con la capa normal (relleno verde, borde naranja), con la insignia patrimonial y botón a la ficha patrimonial si existe.
- **Mapa base de calles:** Esri World Street Map. Los tiles de openstreetmap.org y CARTO bloquean las páginas abiertas con doble clic (`file://`).
- **Regenerar:**
  1. `python preparar_fichas_patrimonio.py` (requiere `pip install pymupdf`)
  2. `"C:\Program Files\QGIS 3.34.15\bin\python-qgis-ltr.bat" build_patrimonio.py`

## Filtro de predios con ficha

El visor solo dibuja los predios que tienen una ficha asociada:

- **Capa de predios:** se muestran los códigos con PDF en `data/pdfs/` (lista `CODIGOS_CON_PDF` en `app.js`) y los que además figuran en el inventario patrimonial con `FICHA`.
- **Capa patrimonial:** solo los bienes con campo `FICHA` diligenciado.

Al agregar un PDF nuevo en `data/pdfs/`, debe añadirse su código a `CODIGOS_CON_PDF` en `app.js`.
