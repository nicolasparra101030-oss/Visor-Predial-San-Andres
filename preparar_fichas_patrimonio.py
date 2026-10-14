# Copia las fichas de inventario patrimonial (ANEXO 4.3) a data/fichas_patrimonio
# y extrae la fotografía de fachada ("7. Fotografía general") a data/fotos_patrimonio.
# Requiere PyMuPDF (pip install pymupdf). Ejecutar antes de build_patrimonio.py:
#   python preparar_fichas_patrimonio.py
import glob
import os
import shutil

import fitz

BASE = os.path.dirname(os.path.abspath(__file__))
ORIGEN = os.path.join(BASE, 'patrimonio', 'ANEXO_4_3_FICHAS_DE_INVENTARIO_DE_BIENES_CULTURALES_INMUEBLES_URBANO',
                      'POT 2023 - URBANO')
FICHAS = os.path.join(BASE, 'data', 'fichas_patrimonio')
FOTOS = os.path.join(BASE, 'data', 'fotos_patrimonio')


def extraer_foto(pdf_path, destino):
    """Guarda la imagen más grande de la ficha (la fotografía de fachada). Devuelve True si había foto."""
    doc = fitz.open(pdf_path)
    mejor = None
    for page in doc:
        for info in page.get_image_info(xrefs=True):
            x0, y0, x1, y1 = info['bbox']
            if info['xref'] and info['width'] > 200 and info['height'] > 150:
                area = (x1 - x0) * (y1 - y0)
                if not mejor or area > mejor[0]:
                    mejor = (area, info['xref'])
    if not mejor:
        return False
    pix = fitz.Pixmap(doc, mejor[1])
    if pix.n - pix.alpha >= 4:
        pix = fitz.Pixmap(fitz.csRGB, pix)
    if pix.alpha:
        pix = fitz.Pixmap(pix, 0)
    pix.save(destino, jpg_quality=85)
    return True


os.makedirs(FICHAS, exist_ok=True)
os.makedirs(FOTOS, exist_ok=True)
fichas = fotos = 0
for pdf in glob.glob(os.path.join(ORIGEN, '*.pdf')):
    inmueble = os.path.splitext(os.path.basename(pdf))[0]
    shutil.copy2(pdf, os.path.join(FICHAS, inmueble + '.pdf'))
    fichas += 1
    if extraer_foto(pdf, os.path.join(FOTOS, inmueble + '.jpg')):
        fotos += 1

print('%d fichas copiadas, %d fotos de fachada extraídas' % (fichas, fotos))
