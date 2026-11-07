import { ImportItem } from '../import.model';
import { buildPendingCsv, pendingCsvFileName } from './pending-csv';

function item(changes: Partial<ImportItem>): ImportItem {
  return {
    id: 'r1',
    importId: 'i1',
    row: 2,
    rawIsbn: '123',
    isbn13: null,
    outcome: 'invalid_isbn',
    bookTitle: null,
    resolution: null,
    pending: true,
    ...changes,
  };
}

/** `Blob.text()` would remove the BOM, so the bytes are decoded keeping it. */
async function read(blob: Blob): Promise<string> {
  return new TextDecoder('utf-8', { ignoreBOM: true }).decode(await blob.arrayBuffer());
}

describe('buildPendingCsv', () => {
  it('writes a header with an ISBN column and a row with its reason in Spanish', async () => {
    const csv = await read(buildPendingCsv([item({ outcome: 'not_found' })]));

    expect(csv).toBe('﻿Fila,ISBN,Motivo\r\n2,123,No encontrado\r\n');
  });

  it('escapes commas, quotes and line breaks', async () => {
    const csv = await read(buildPendingCsv([item({ rawIsbn: 'Uno, "dos"\ntres' })]));

    expect(csv).toContain('2,"Uno, ""dos""\ntres",ISBN incorrecto');
  });
});

describe('pendingCsvFileName', () => {
  it('keeps letters with accents and replaces the rest', () => {
    expect(pendingCsvFileName('Mis libros ñ (1).CSV')).toBe('pendientes-Mis_libros_ñ__1_.csv');
  });
});
