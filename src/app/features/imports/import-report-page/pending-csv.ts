import { ImportItem, OUTCOME_LABELS } from '../import.model';

const HEADERS = ['Fila', 'ISBN', 'Motivo'];

function escapeField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** A CSV with the pending rows. The BOM makes Excel read the accents correctly. */
export function buildPendingCsv(items: readonly ImportItem[]): Blob {
  const rows = items.map((item) => [
    String(item.row),
    item.rawIsbn ?? '',
    OUTCOME_LABELS[item.outcome],
  ]);
  const lines = [HEADERS, ...rows].map((row) => row.map(escapeField).join(','));
  return new Blob(['﻿' + lines.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' });
}

export function pendingCsvFileName(importFileName: string): string {
  return `pendientes-${importFileName.replace(/\.csv$/i, '').replace(/[^\p{L}\p{N}_-]/gu, '_')}.csv`;
}
