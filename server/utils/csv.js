/** Escape a cell value, neutralising spreadsheet formula injection. */
function cell(value) {
  if (value === null || value === undefined) return '';
  let text = value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[",\n\r]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

/** columns: [{ key, label }] */
export function toCsv(rows, columns) {
  const header = columns.map((c) => cell(c.label)).join(',');
  const lines = rows.map((row) => columns.map((c) => cell(typeof c.value === 'function' ? c.value(row) : row[c.key])).join(','));
  return `\uFEFF${[header, ...lines].join('\r\n')}\r\n`;
}
