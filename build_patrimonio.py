# Genera data/patrimonio_data.js a partir de los shapefiles de patrimonio.
# Ejecutar con el Python de QGIS:
#   "C:\Program Files\QGIS 3.34.15\bin\python-qgis-ltr.bat" build_patrimonio.py
import json
import os
from osgeo import ogr, osr

ogr.UseExceptions()

BASE = os.path.dirname(os.path.abspath(__file__))
SHP_DIR = os.path.join(BASE, 'patrimonio', 'ANEXO_4_1_GDB_Patrimonio_Cultural_Material_SAI',
                       'ANEXO 4.1. GDB_Patrimonio_Cultural_Material_SAI')
FICHAS_REL = 'data/fichas_patrimonio'
FOTOS_REL = 'data/fotos_patrimonio'
PDFS_REL = 'data/pdfs'
CAPAS = [('Urbano', 'Patrimonio_material_cultural_Urbano.shp'),
         ('Rural', 'Patrimonio_material_cultural_Rural.shp')]

wgs84 = osr.SpatialReference()
wgs84.ImportFromEPSG(4326)
wgs84.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)


def buscar_ficha(inmueble, codigo):
    ficha = FICHAS_REL + '/' + inmueble + '.pdf'
    if os.path.isfile(os.path.join(BASE, ficha)):
        return ficha
    pdf = PDFS_REL + '/' + codigo + '.pdf'
    if codigo and os.path.isfile(os.path.join(BASE, pdf)):
        return pdf
    return None


def buscar_foto(inmueble):
    foto = FOTOS_REL + '/' + inmueble + '.jpg'
    return foto if os.path.isfile(os.path.join(BASE, foto)) else None


features = []
for zona, nombre in CAPAS:
    ds = ogr.Open(os.path.join(SHP_DIR, nombre))
    layer = ds.GetLayer()
    src = layer.GetSpatialRef()
    src.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    tr = osr.CoordinateTransformation(src, wgs84)
    for f in layer:
        geom = f.GetGeometryRef().Clone()
        geom.Transform(tr)
        feat = json.loads(f.ExportToJson())
        props = feat['properties']
        props['ZONA'] = zona
        props['FICHA'] = buscar_ficha(props.get('inmueble') or '', props.get('CODIGO') or '')
        props['FOTO'] = buscar_foto(props.get('inmueble') or '')
        features.append({
            'type': 'Feature',
            'id': len(features),
            'geometry': json.loads(geom.ExportToJson(['COORDINATE_PRECISION=8'])),
            'properties': props
        })

fc = {'type': 'FeatureCollection', 'features': features}
out = os.path.join(BASE, 'data', 'patrimonio_data.js')
with open(out, 'w', encoding='utf-8') as fh:
    fh.write('var PATRIMONIO_DATA = ')
    json.dump(fc, fh, ensure_ascii=False, separators=(',', ':'))
    fh.write(';\n')

con_ficha = sum(1 for x in features if x['properties']['FICHA'])
con_foto = sum(1 for x in features if x['properties']['FOTO'])
print('%d predios patrimoniales (%d con ficha, %d con foto) -> %s' % (len(features), con_ficha, con_foto, out))
