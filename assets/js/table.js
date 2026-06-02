/** Escape HTML special chars to prevent XSS from data values. */
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function membersHtml(members) {
  return members.map((m, i) =>
    `<div class="${i === 0 ? 'member-head' : ''}">${esc(m)}</div>`).join('');
}

function contactsHtml(list) {
  return list.map((c) => {
    const phone = (c.phone || '').replace(/\s+/g, '');
    const tel = phone ? ` <a href="tel:${esc(phone)}">${esc(phone)}</a>` : '';
    return `<div>${esc(c.name)}${tel}</div>`;
  }).join('');
}

/**
 * Render one table row per record into tbody, inserting zone-header rows on
 * zone changes. Clears existing content first. Shows an empty-state row when
 * records is empty.
 * @param {object[]} records - sorted array of vihar group records
 * @param {HTMLTableSectionElement} tbody - target <tbody> element
 */
export function renderRows(records, tbody) {
  tbody.innerHTML = '';
  if (!records.length) {
    tbody.innerHTML = '<tr><td class="empty" colspan="11">कोई डेटा उपलब्ध नहीं</td></tr>';
    return;
  }
  let lastZone = null;
  for (const r of records) {
    if (r.zone !== lastZone) {
      lastZone = r.zone;
      const zh = document.createElement('tr');
      zh.className = 'zone-head';
      zh.innerHTML = `<td colspan="11">${esc(r.zone)}</td>`;
      tbody.appendChild(zh);
    }
    const tr = document.createElement('tr');
    tr.className = 'data-row';
    tr.innerHTML = [
      esc(r.serial), esc(r.groupType), membersHtml(r.members), esc(r.thana ?? ''),
      esc(r.viharRoute), esc(r.place), esc(r.city), esc(r.district),
      esc(r.km ?? ''), contactsHtml(r.viharKarmi), contactsHtml(r.activePersons),
    ].map((c) => `<td>${c}</td>`).join('');
    tbody.appendChild(tr);
  }
}

/**
 * Populate a <select> with "सभी अंचल" plus one option per unique zone from
 * records, preserving insertion order.
 * @param {object[]} records - vihar group records
 * @param {HTMLSelectElement} select - target <select> element
 */
export function populateZones(records, select) {
  const zones = [...new Set(records.map((r) => r.zone))];
  select.innerHTML = '';
  const all = document.createElement('option');
  all.value = ''; all.textContent = 'सभी अंचल';
  select.appendChild(all);
  for (const z of zones) {
    const o = document.createElement('option');
    o.value = z; o.textContent = z;
    select.appendChild(o);
  }
}
