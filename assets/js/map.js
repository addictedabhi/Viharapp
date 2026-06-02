export function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Returns only records that have lat/lng coordinates. */
export function mappable(records) {
  return records.filter((r) => r.lat != null && r.lng != null);
}

/** Returns records that are missing lat/lng (geocode failed). */
export function failedList(records) {
  return records.filter((r) => r.lat == null || r.lng == null);
}

/** Builds escaped HTML for a Leaflet popup from a single record. */
export function popupHtml(r) {
  const contacts = (r.activePersons || []).map((c) => {
    const phone = (c.phone || '').replace(/\s+/g, '');
    return `${esc(c.name)}${phone ? ` <a href="tel:${esc(phone)}">${esc(phone)}</a>` : ''}`;
  }).join('<br>');
  return `<div class="popup">
    <strong>${esc((r.members || [])[0] || '')}</strong>
    ${r.members && r.members.length > 1 ? ` (+${r.members.length - 1})` : ''}<br>
    ${esc(r.place)}, ${esc(r.city)}<br>${esc(r.district)}
    ${r.km != null ? `<br>किमी: ${esc(r.km)}` : ''}
    ${r.viharRoute ? `<br>${esc(r.viharRoute)}` : ''}
    ${contacts ? `<br>${contacts}` : ''}
  </div>`;
}

// Wires Leaflet (window.L) + markercluster. Called from map.html.
export function buildMap(records, { L, elId = 'map' }) {
  const map = L.map(elId).setView([23.5, 78.5], 5); // India
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18, attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map);

  const cluster = L.markerClusterGroup();
  const byId = new Map();
  for (const r of mappable(records)) {
    const color = r.groupType === 'साध्वी' ? '#c0392b' : '#3E6AE1';
    const marker = L.circleMarker([r.lat, r.lng], {
      radius: 7, color, fillColor: color, fillOpacity: 0.9, weight: 1,
    }).bindPopup(popupHtml(r));
    cluster.addLayer(marker);
    byId.set(`${r.zone}|${r.serial}`, { r, marker });
  }
  map.addLayer(cluster);
  return { map, cluster, byId };
}

export function filterMarkers(state, matched) {
  const ids = new Set(matched.map((r) => `${r.zone}|${r.serial}`));
  state.cluster.clearLayers();
  for (const [id, { marker }] of state.byId) {
    if (ids.has(id)) state.cluster.addLayer(marker);
  }
}
