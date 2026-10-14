var map;
var allLayers = [];
var patrimonioLayers = [];
var activeLayer = null;
var currentFeature = null;

var DESTINO_LABELS = {
  'A': 'Habitacional',
  'B': 'Industrial',
  'C': 'Comercial',
  'D': 'Agropecuario',
  'E': 'Minero',
  'F': 'Cultural',
  'G': 'Recreacional / Deportivo',
  'H': 'Salubridad',
  'I': 'Institucional',
  'J': 'Lote sin construcción',
  'K': 'Educativo',
  'L': 'Religioso',
  'P': 'Pecuario',
  'R': 'Recreación y deporte',
  'S': 'Servicios especiales',
  'T': 'Transporte y comunicaciones'
};

var DEFAULT_STYLE = {
  fillColor: '#1D9E75',
  color: '#ffffff',
  weight: 1,
  fillOpacity: 0.55,
  opacity: 0.9
};

var HIGHLIGHT_STYLE = {
  fillColor: '#0F6E56',
  color: '#111827',
  weight: 2.5,
  fillOpacity: 0.85,
  opacity: 1
};

var PATRIMONIO_STYLE = {
  fillColor: '#D97706',
  color: '#7C2D12',
  weight: 1.5,
  fillOpacity: 0.6,
  opacity: 0.9
};

var PATRIMONIO_HIGHLIGHT_STYLE = {
  fillColor: '#B45309',
  color: '#111827',
  weight: 2.5,
  fillOpacity: 0.85,
  opacity: 1
};

// Predio de la capa normal que también está en el inventario patrimonial:
// conserva el relleno verde con borde naranja.
var PREDIO_PATRIMONIAL_STYLE = {
  fillColor: '#1D9E75',
  color: '#D97706',
  weight: 3,
  fillOpacity: 0.55,
  opacity: 1
};

var PREDIO_PATRIMONIAL_HIGHLIGHT_STYLE = {
  fillColor: '#0F6E56',
  color: '#B45309',
  weight: 4,
  fillOpacity: 0.85,
  opacity: 1
};

var PATRIMONIO_POR_CODIGO = {};
PATRIMONIO_DATA.features.forEach(function(f) {
  PATRIMONIO_POR_CODIGO[f.properties.CODIGO] = f.properties;
});

// Códigos con ficha de caracterización en data/pdfs/ (solo estos se muestran en el visor)
var CODIGOS_CON_PDF = {};
[
  '880010000000000010011000000000',
  '880010000000000030054000000000',
  '880010000000000070018000000000',
  '880010000000000070072000000000',
  '880010000000000130080000000000',
  '880010000000000142128000000000',
  '880010002000000030004000000000',
  '880010002000000110002000000000',
  '880010002000000120046000000000',
  '880010100000000030002000000000',
  '880010100000000190016000000000',
  '880010100000000190017000000000',
  '880010100000000190019000000000',
  '880010100000002710001000000000'
].forEach(function(c) { CODIGOS_CON_PDF[c] = true; });

var CODIGOS_PREDIOS = {};
PREDIOS_DATA.features.forEach(function(f) {
  CODIGOS_PREDIOS[f.properties.CODIGO] = true;
});

// Un predio normal tiene ficha si existe su PDF o su registro patrimonial trae ficha.
function tieneFicha(feature) {
  var pat = PATRIMONIO_POR_CODIGO[feature.properties.CODIGO];
  return !!(CODIGOS_CON_PDF[feature.properties.CODIGO] || (pat && pat.FICHA));
}

function isPatrimonio(feature) {
  return !!(feature && feature.properties && feature.properties.inmueble);
}

// Datos patrimoniales del predio: los propios si viene de la capa patrimonial,
// o los del inventario si es un predio normal con el mismo CODIGO.
function patrimonioDe(feature) {
  if (!feature) return null;
  if (isPatrimonio(feature)) return feature.properties;
  return PATRIMONIO_POR_CODIGO[feature.properties.CODIGO] || null;
}

function defaultStyleFor(feature) {
  if (isPatrimonio(feature)) return PATRIMONIO_STYLE;
  return patrimonioDe(feature) ? PREDIO_PATRIMONIAL_STYLE : DEFAULT_STYLE;
}

function highlightStyleFor(feature) {
  if (isPatrimonio(feature)) return PATRIMONIO_HIGHLIGHT_STYLE;
  return patrimonioDe(feature) ? PREDIO_PATRIMONIAL_HIGHLIGHT_STYLE : HIGHLIGHT_STYLE;
}

function initMap() {
  map = L.map('map').setView([12.5567, -81.7032], 14);

  // Los tiles de openstreetmap.org bloquean ("Access blocked") las páginas abiertas
  // desde el disco (file://), por eso se usa el mapa de calles de Esri.
  var calles = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, HERE, Garmin, USGS, NGA, EPA, USDA, NPS, &copy; OpenStreetMap contributors',
    maxZoom: 19
  }).addTo(map);

  var satelite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
  });

  var etiquetas = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Labels &copy; Esri'
  });

  satelite.on('add', function() { etiquetas.addTo(map); });
  satelite.on('remove', function() { map.removeLayer(etiquetas); });

  var prediosGroup = L.geoJSON(PREDIOS_DATA, {
    filter: tieneFicha,
    style: defaultStyleFor,
    onEachFeature: function(feature, layer) {
      layer.on('click', function() { selectPredio(feature, layer); });
      var pat = patrimonioDe(feature);
      if (pat) layer.bindTooltip('Bien patrimonial ' + pat.inmueble, { sticky: true });
      allLayers.push(layer);
    }
  }).addTo(map);

  // Los patrimoniales que ya están en la capa de predios se muestran con la capa normal.
  var patrimonioGroup = L.geoJSON(PATRIMONIO_DATA, {
    filter: function(feature) { return !CODIGOS_PREDIOS[feature.properties.CODIGO] && !!feature.properties.FICHA; },
    style: PATRIMONIO_STYLE,
    onEachFeature: function(feature, layer) {
      layer.on('click', function() { selectPredio(feature, layer); });
      layer.bindTooltip('Bien patrimonial ' + feature.properties.inmueble, { sticky: true });
      patrimonioLayers.push(layer);
    }
  }).addTo(map);

  L.control.layers({
    'Calles': calles,
    'Satélite': satelite
  }, {
    '<span class="legend-swatch swatch-predio"></span>Predios': prediosGroup,
    '<span class="legend-swatch swatch-patrimonio"></span>Predios patrimoniales': patrimonioGroup
  }, { position: 'topright', collapsed: false }).addTo(map);

  map.on('overlayremove', function(e) {
    if (activeLayer && e.layer.hasLayer(activeLayer)) closePanelDetail();
  });

  var legend = L.control({ position: 'bottomleft' });
  legend.onAdd = function() {
    var div = L.DomUtil.create('div', 'map-legend');
    div.innerHTML =
      '<div><span class="legend-swatch swatch-predio"></span>Predio</div>' +
      '<div><span class="legend-swatch swatch-patrimonio"></span>Predio patrimonial</div>' +
      '<div><span class="legend-swatch swatch-predio-patrimonio"></span>Predio con registro patrimonial</div>';
    return div;
  };
  legend.addTo(map);

  updateStats();
}

function clean(val) {
  return (val && String(val).trim()) ? String(val).trim() : null;
}

function selectPredio(feature, layer) {
  if (activeLayer) {
    activeLayer.setStyle(defaultStyleFor(currentFeature));
  }
  var patrimonial = isPatrimonio(feature);
  var pat = patrimonioDe(feature);
  layer.setStyle(highlightStyleFor(feature));
  layer.bringToFront();
  activeLayer = layer;
  currentFeature = feature;

  var p = feature.properties;
  var codigo = clean(p.CODIGO) || '—';
  var destinoCod = clean(p.R1_Destino);

  var hasData = clean(p.R1_Nombre) || clean(p.R1_Direcci) || clean(p.R2_Matricu) ||
    destinoCod || (p.R1_AreaTer > 0) || (p.R1_AreaCon > 0) || (p.R1_Avaluo > 0);

  document.getElementById('panel-empty').classList.add('hidden');

  var badgeText = pat ? 'Bien patrimonial · ' + pat.inmueble + ' · ' + pat.ZONA : '';
  ['detail-patrimonio', 'nodata-patrimonio'].forEach(function(id) {
    var el = document.getElementById(id);
    el.textContent = badgeText;
    el.classList.toggle('hidden', !pat);
  });
  ['btn-ficha-patrimonio', 'nodata-ficha-patrimonio'].forEach(function(id) {
    document.getElementById(id).classList.toggle('hidden', !(pat && pat.FICHA));
  });

  if (!hasData) {
    document.getElementById('nodata-codigo').textContent = 'Código: ' + codigo;
    document.getElementById('panel-detail').classList.add('hidden');
    document.getElementById('panel-nodata').classList.remove('hidden');
    return;
  }
  document.getElementById('panel-nodata').classList.add('hidden');

  var nombre = clean(p.R1_Nombre) || ('Predio ' + p.CODIGO);
  var matricula = clean(p.R2_Matricu) || '—';
  var direccion = clean(p.R1_Direcci) || '—';
  var destino = (destinoCod && DESTINO_LABELS[destinoCod]) ? DESTINO_LABELS[destinoCod] : (destinoCod || '—');
  var areaT = (p.R1_AreaTer > 0) ? Number(p.R1_AreaTer).toLocaleString('es-CO') + ' m²' : '—';
  var areaC = (p.R1_AreaCon > 0) ? Number(p.R1_AreaCon).toLocaleString('es-CO') + ' m²' : '—';

  var avaluoText;
  if (p.R1_Avaluo > 0) {
    var fmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
    avaluoText = fmt.format(p.R1_Avaluo);
  } else {
    avaluoText = '—';
  }

  document.getElementById('detail-nombre').textContent = nombre;
  document.getElementById('detail-codigo').textContent = 'Código: ' + codigo;
  document.getElementById('detail-matricula').textContent = 'Matrícula: ' + matricula;
  document.getElementById('detail-direccion').textContent = direccion;
  document.getElementById('detail-area-terreno').textContent = areaT;
  document.getElementById('detail-area-construccion').textContent = areaC;
  document.getElementById('detail-uso').textContent = destino;
  document.getElementById('detail-avaluo').textContent = avaluoText;

  cargarFoto(patrimonial ? p.FOTO : 'data/fotos/' + codigo + '.jpg');

  var btnPdf = document.getElementById('btn-pdf');
  if (patrimonial) {
    btnPdf.textContent = p.FICHA ? 'Ver ficha de caracterización' : 'Ficha de caracterización no disponible';
    btnPdf.disabled = !p.FICHA;
    document.getElementById('btn-ficha-patrimonio').classList.add('hidden');
  } else {
    btnPdf.textContent = 'Ver ficha de caracterización';
    btnPdf.disabled = false;
  }
  btnPdf.classList.toggle('btn-pdf-patrimonio', patrimonial);

  document.getElementById('panel-detail').classList.remove('hidden');
}

function cargarFoto(src) {
  var fotoBox = document.getElementById('detail-foto-box');
  var fotoEmpty = document.getElementById('detail-foto-empty');
  var foto = document.getElementById('detail-foto');

  if (!src) {
    foto.removeAttribute('src');
    fotoBox.classList.add('hidden');
    fotoEmpty.classList.remove('hidden');
    return;
  }

  foto.onerror = function() {
    fotoBox.classList.add('hidden');
    fotoEmpty.classList.remove('hidden');
  };
  foto.onload = function() {
    fotoEmpty.classList.add('hidden');
    fotoBox.classList.remove('hidden');
  };
  foto.src = src;
}

function openFichaPatrimonio() {
  var pat = patrimonioDe(currentFeature);
  if (pat && pat.FICHA) {
    window.open(encodeURI(pat.FICHA), '_blank');
  }
}

function openPdf() {
  if (isPatrimonio(currentFeature)) {
    openFichaPatrimonio();
    return;
  }
  if (currentFeature) {
    var codigo = currentFeature.properties.CODIGO;
    window.open('data/pdfs/' + codigo + '.pdf', '_blank');
  }
}

function closePanelDetail() {
  if (activeLayer) {
    activeLayer.setStyle(defaultStyleFor(currentFeature));
  }
  activeLayer = null;
  currentFeature = null;
  document.getElementById('panel-detail').classList.add('hidden');
  document.getElementById('panel-nodata').classList.add('hidden');
  document.getElementById('panel-empty').classList.remove('hidden');
}

function updateStats() {
  document.getElementById('stat-count').textContent =
    allLayers.length + ' predios · ' + patrimonioLayers.length + ' patrimoniales';
}

initMap();
