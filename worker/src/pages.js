function escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const STYLE = `
:root{--blue:#3E6AE1;--dark:#171A20;--gray:#393C41;--ash:#F4F4F4}
*{box-sizing:border-box}
body{margin:0;font-family:'Noto Sans Devanagari',-apple-system,Arial,sans-serif;
  color:var(--dark);background:#fff;display:flex;min-height:100vh;align-items:center;
  justify-content:center}
.card{width:340px;padding:32px}
h1{font-weight:500;font-size:22px;margin:0 0 24px}
label{display:block;font-size:14px;color:var(--gray);margin:16px 0 4px}
input{width:100%;height:40px;border:1px solid #D0D1D2;border-radius:4px;padding:0 12px;
  font:inherit}
button{width:100%;height:40px;margin-top:24px;background:var(--blue);color:#fff;border:0;
  border-radius:4px;font:inherit;font-weight:500;cursor:pointer;
  transition:background-color .33s}
.err{color:#c0392b;font-size:14px;margin-top:12px}
.summary{max-width:560px;padding:32px}
table{border-collapse:collapse;width:100%;margin-top:16px}
td,th{border-bottom:1px solid #EEE;padding:8px;text-align:right;font-size:14px}
`;

function shell(title, inner) {
  return `<!doctype html><html lang="hi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500&display=swap" rel="stylesheet">
<style>${STYLE}</style></head><body>${inner}</body></html>`;
}

export function loginPage({ error } = {}) {
  return shell('लॉगिन', `<div class="card">
<h1>विहार सूचना — अपलोड लॉगिन</h1>
<form action="/login" method="post">
  <label for="u">उपयोगकर्ता नाम</label>
  <input id="u" name="username" autocomplete="off" required>
  <label for="p">पासवर्ड</label>
  <input id="p" name="password" type="password" required>
  <button type="submit">लॉगिन करें</button>
  ${error ? `<div class="err">${escHtml(error)}</div>` : ''}
</form></div>`);
}

export function resultPage({ totals, geocodeFailures }) {
  const rows = (geocodeFailures || [])
    .map((f) => `<tr><td>${escHtml(f.zone)}</td><td>${escHtml(f.serial)}</td><td>${escHtml(f.city)}</td><td>${escHtml(f.district)}</td></tr>`)
    .join('');
  return shell('अपलोड सफल', `<div class="summary">
<h1>अपलोड सफल</h1>
<p>समूह: ${escHtml(totals.groups)} • सदस्य: ${escHtml(totals.members)} • नक्शे पर: ${escHtml(totals.mapped)} • असफल: ${escHtml(totals.geocodeFailed)}</p>
<h2 style="font-size:16px;font-weight:500">नक्शे पर नहीं (मैन्युअल सुधार करें)</h2>
<table><thead><tr><th>अंचल</th><th>क्र.</th><th>शहर</th><th>जिला</th></tr></thead>
<tbody>${rows || '<tr><td colspan="4">कोई नहीं</td></tr>'}</tbody></table>
<p style="margin-top:24px"><a href="/">नया अपलोड</a></p>
</div>`);
}

/**
 * Upload form page (authenticated). Optional error is shown escaped.
 * @param {string} [error]
 * @returns {string}
 */
export function uploadForm(error) {
  return `<!doctype html><html lang="hi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>अपलोड</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500&display=swap" rel="stylesheet">
<style>body{font-family:'Noto Sans Devanagari',Arial,sans-serif;color:#171A20;
display:flex;min-height:100vh;align-items:center;justify-content:center}
.card{width:360px;padding:32px}h1{font-weight:500}
input[type=file]{margin:16px 0}button{height:40px;background:#3E6AE1;color:#fff;border:0;
border-radius:4px;padding:0 24px;font:inherit;font-weight:500;cursor:pointer}
.err{color:#c0392b}</style></head><body><div class="card">
<h1>एक्सेल अपलोड करें</h1>
<form action="/upload" method="post" enctype="multipart/form-data">
<input type="file" name="file" accept=".xlsx" required><br>
<button type="submit">अपलोड व प्रकाशित करें</button>
${error ? `<p class="err">${escHtml(error)}</p>` : ''}
</form><p><a href="/logout">लॉगआउट</a></p></div></body></html>`;
}
