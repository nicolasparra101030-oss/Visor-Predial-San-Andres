# Visor Predial · San Andrés

Visor web cartográfico para consultar la información catastral y patrimonial de los predios del municipio de San Andrés (código DANE `88001`), Archipiélago de San Andrés, Providencia y Santa Catalina.

Es una aplicación *cliente puro*: HTML + CSS + JavaScript sobre [Leaflet](https://leafletjs.com/), sin backend, sin dependencias de build y desplegable en cualquier hosting estático.

## Qué incluye

- Mapa interactivo con los predios como polígonos.
- Panel lateral con propietario, matrícula inmobiliaria, dirección, áreas, destino económico y avalúo.
- Acceso a la ficha de caracterización en PDF de cada predio.
- Capa de predios patrimoniales (urbano y rural) con fichas de inventario y fotografías.

## Ejecutar localmente

```bash
# desde la raíz del repositorio
python -m http.server 8000
# abrir http://localhost:8000
```

También puede abrirse `index.html` directamente en el navegador.

## Estructura

| Ruta | Descripción |
|---|---|
| `index.html`, `style.css`, `app.js` | Aplicación del visor |
| `data/predios_data.js` | Predios (GeoJSON embebido como `PREDIOS_DATA`) |
| `data/predioss.geojson` | Mismo contenido en GeoJSON puro, para uso en SIG |
| `data/patrimonio_data.js` | Capa de patrimonio generada por `build_patrimonio.py` |
| `data/pdfs/`, `data/fichas_patrimonio/` | Fichas PDF |
| `data/fotos/`, `data/fotos_patrimonio/` | Fotografías |
| `build_patrimonio.py` | Genera `patrimonio_data.js` desde los shapefiles de patrimonio (requiere GDAL/OGR, p. ej. el Python de QGIS) |
| `preparar_fichas_patrimonio.py` | Prepara las fichas PDF de patrimonio |

Los insumos fuente pesados (`patrimonio/`: geodatabases y anexos) no se versionan; ver `.gitignore`.

## Documentación técnica

Toda la documentación está en [`DOCUMENTACION_TECNICA.md`](DOCUMENTACION_TECNICA.md): arquitectura, modelo de datos, detalle de implementación, limitaciones conocidas y hoja de ruta sugerida.

## Datos y privacidad

Los datos catastrales incluyen nombres de propietarios y matrículas. Antes de publicar el visor o este repositorio de forma abierta, la entidad debe validar su tratamiento conforme a la normativa de protección de datos personales (ver sección 12 de la documentación técnica).
