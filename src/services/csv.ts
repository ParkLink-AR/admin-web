import { Platform } from 'react-native';

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

function escapeCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  // Quoted when it has a separator, a quote or a line break; quotes doubled.
  return /[",;\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** The rows as CSV text: a header line, then one line per row. */
export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const lines = [columns.map((c) => escapeCell(c.header)).join(',')];
  for (const row of rows) lines.push(columns.map((c) => escapeCell(c.value(row))).join(','));
  return lines.join('\r\n');
}

/**
 * Downloads the rows as a CSV file (for accounting: bookings, payments, settlements). With a
 * UTF-8 BOM so Excel shows accents right. Web only -- this panel runs in a browser.
 */
export function downloadCsv<T>(filename: string, rows: T[], columns: CsvColumn<T>[]): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  const blob = new Blob(['﻿' + toCsv(rows, columns)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Centavos as a plain decimal number for a spreadsheet ("1234.50"). */
export function centavosToDecimal(centavos: number | null | undefined): string {
  return centavos === null || centavos === undefined ? '' : (centavos / 100).toFixed(2);
}
