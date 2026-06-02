const HEADER = ['Zone','Serial','GroupType','Members','Thana','ViharRoute','Place','City','District','KM','ViharKarmi','ActivePersons','Lat','Lng'];

function contactsCell(list) {
  return (list || []).flatMap((c) => [c.name, c.phone].filter((x) => x != null && x !== '')).join('\n');
}

/** Converts an array of vihar records to a 2-D array suitable for SheetJS aoa_to_sheet.
 * @param {object[]} records
 * @returns {Array<Array<any>>} array-of-arrays with header row first
 */
export function recordsToAoa(records) {
  const rows = [HEADER.slice()];
  for (const r of records) {
    rows.push([
      r.zone, r.serial, r.groupType, (r.members || []).join('\n'), r.thana ?? '',
      r.viharRoute || '', r.place || '', r.city || '', r.district || '', r.km ?? '',
      contactsCell(r.viharKarmi), contactsCell(r.activePersons),
      r.lat ?? '', r.lng ?? '',
    ]);
  }
  return rows;
}

/** Builds and downloads a .xlsx file using the SheetJS CDN global (window.XLSX).
 * @param {object[]} records
 * @param {string} [filename]
 */
export function downloadExcel(records, filename = 'vihar-suchna.xlsx') {
  const ws = window.XLSX.utils.aoa_to_sheet(recordsToAoa(records));
  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, ws, 'Vihar');
  window.XLSX.writeFile(wb, filename);
}

/** Builds and downloads a Hindi PDF using the pdfMake CDN global (window.pdfMake).
 * Requires the NotoDeva font registered by noto-vfs.js (Task 9.0).
 * @param {object[]} records
 * @param {{ uploadedAt?: string }|null} meta
 */
export function downloadPdf(records, meta) {
  const body = [['अंचल', 'क्र.', 'नाम', 'स्थान', 'शहर', 'जिला']];
  for (const r of records) {
    body.push([r.zone, String(r.serial), (r.members || []).join(', '),
      r.place || '', r.city || '', r.district || '']);
  }
  const doc = {
    defaultStyle: { font: 'NotoDeva', fontSize: 8 },
    pageOrientation: 'landscape',
    content: [
      { text: 'विहार सूचना', fontSize: 14, margin: [0, 0, 0, 8] },
      meta ? { text: `अंतिम अपडेट: ${meta.uploadedAt || ''}`, fontSize: 8, margin: [0, 0, 0, 8] } : {},
      { table: { headerRows: 1, widths: ['*', 'auto', '*', '*', 'auto', 'auto'], body } },
    ],
  };
  window.pdfMake.createPdf(doc).download('vihar-suchna.pdf');
}
