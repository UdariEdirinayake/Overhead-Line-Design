// Minimal RFC-compliant CSV parser and writer
export const CSV = {
  parse(text) {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;
    const pushField = () => { row.push(field); field = ''; };
    const pushRow = () => { rows.push(row); row = []; };
    const s = text.replace(/\r\n/g, '\n');
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (inQuotes) {
        if (c === '"') {
          if (s[i + 1] === '"') { field += '"'; i++; }
          else inQuotes = false;
        } else field += c;
      } else {
        if (c === '"') inQuotes = true;
        else if (c === ',') pushField();
        else if (c === '\n') { pushField(); pushRow(); }
        else field += c;
      }
    }
    if (field.length || row.length) { pushField(); pushRow(); }
    // drop trailing empty line (single empty field from trailing newline)
    while (rows.length && rows[rows.length - 1].length <= 1 && (rows[rows.length - 1][0] === '' || rows[rows.length - 1][0] === undefined)) rows.pop();
    return rows;
  },

  // parse into array of objects using first row as header
  parseObjects(text) {
    const rows = CSV.parse(text);
    if (!rows.length) return [];
    const header = rows[0].map(h => h.trim());
    return rows.slice(1).map(r => {
      const obj = {};
      header.forEach((h, idx) => { obj[h] = (r[idx] ?? '').trim(); });
      return obj;
    });
  },

  stringify(rows) {
    return rows.map(r => r.map(f => {
      f = String(f ?? '');
      if (/[",\n]/.test(f)) return '"' + f.replace(/"/g, '""') + '"';
      return f;
    }).join(',')).join('\n');
  },

  objectsToCsv(objs, header) {
    if (!header) header = objs.length ? Object.keys(objs[0]) : [];
    const rows = [header, ...objs.map(o => header.map(h => o[h] ?? ''))];
    return CSV.stringify(rows);
  }
};;
