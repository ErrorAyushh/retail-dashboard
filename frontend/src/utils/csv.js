import { toCSVValue } from './format';

export function downloadCSV(filename, columns, rows) {
  const header = columns.map((c) => toCSVValue(c.label || c.key || '')).join(',');
  const body = rows
    .map((row) =>
      columns
        .map((c) => {
          let val = '';
          if (typeof c.csvAccessor === 'function') {
            val = c.csvAccessor(row);
          } else if (typeof c.accessor === 'function') {
            val = c.accessor(row);
          } else if (typeof c.sortAccessor === 'function') {
            val = c.sortAccessor(row);
          } else if (c.key && row && row[c.key] !== undefined) {
            val = row[c.key];
          }
          if (Array.isArray(val)) {
            val = val.join('; ');
          }
          return toCSVValue(val);
        })
        .join(',')
    )
    .join('\n');
  const csv = header + '\n' + body;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
