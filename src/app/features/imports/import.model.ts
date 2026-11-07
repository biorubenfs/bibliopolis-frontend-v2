import { ApiError } from '../../core/http/api-error';

/** Limits defined by the backend (see docs/api/imports.md). */
export const IMPORT_MAX_ROWS = 200;
export const IMPORT_MAX_FILE_SIZE_MB = 5;
export const IMPORT_MAX_FILE_SIZE_BYTES = IMPORT_MAX_FILE_SIZE_MB * 1024 * 1024;

export type ImportStatus = 'queued' | 'running' | 'completed' | 'failed';

export type ImportItemOutcome =
  | 'queued'
  | 'added'
  | 'already_in_library'
  | 'duplicate_in_file'
  | 'not_found'
  | 'invalid_isbn'
  | 'missing_isbn'
  | 'source_error'
  | 'internal_error';

export type ImportItemResolution = 'dismissed' | 'manual';

export interface ImportCounts {
  total: number;
  processed: number;
  queued: number;
  added: number;
  alreadyInLibrary: number;
  duplicateInFile: number;
  notFound: number;
  invalidIsbn: number;
  missingIsbn: number;
  sourceError: number;
  internalError: number;
  pending: number;
  retryable: number;
}

export interface LibraryImport {
  id: string;
  userId: string;
  libraryId: string;
  fileName: string;
  status: ImportStatus;
  counts: ImportCounts;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
}

export interface ImportItem {
  id: string;
  importId: string;
  row: number;
  rawIsbn: string | null;
  isbn13: string | null;
  outcome: ImportItemOutcome;
  bookTitle: string | null;
  resolution: ImportItemResolution | null;
  pending: boolean;
}

export interface ImportAnalysis {
  columns: { index: number; name: string }[];
  isbnColumns: number[];
  counts: {
    rows: number;
    valid: number;
    invalidIsbn: number;
    missingIsbn: number;
    duplicateInFile: number;
    alreadyInLibrary: number;
  };
  sample: { row: number; isbn: string | null }[];
}

export interface ImportRequest {
  file: File;
  libraryId: string;
  /** Column indexes by order of preference; the backend detects them if they are missing. */
  isbnColumns?: number[];
}

export const OUTCOME_LABELS: Record<ImportItemOutcome, string> = {
  queued: 'En cola',
  added: 'Añadido',
  already_in_library: 'Ya estaba en la biblioteca',
  duplicate_in_file: 'Repetido en el fichero',
  not_found: 'No encontrado',
  invalid_isbn: 'ISBN incorrecto',
  missing_isbn: 'Sin ISBN',
  source_error: 'Fuentes no disponibles',
  internal_error: 'Error al procesarlo',
};

export function isActiveImport(libraryImport: Pick<LibraryImport, 'status'>): boolean {
  return libraryImport.status === 'queued' || libraryImport.status === 'running';
}

/** The backend answers in English: the messages for the user are chosen here. */
export function importErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return 'No se ha podido completar la operación. Inténtalo de nuevo.';
  }

  switch (error.errorCode) {
    case 'INVALID IMPORT FILE':
      return 'No hemos podido leer el fichero. Comprueba que es un CSV con una fila de cabecera y al menos una fila de datos.';
    case 'IMPORT TOO MANY ROWS':
      return `El fichero tiene más de ${IMPORT_MAX_ROWS} filas. Divídelo en varios ficheros e impórtalos por separado.`;
    case 'IMPORT FILE TOO LARGE':
      return `El fichero supera el límite de ${IMPORT_MAX_FILE_SIZE_MB} MB.`;
    case 'IMPORT WITHOUT ISBN COLUMN':
      return 'Elige la columna que contiene el ISBN.';
    case 'IMPORT WITHOUT VALID ISBN':
      return 'Ninguna fila tiene un ISBN válido, así que no hay nada que importar.';
    case 'IMPORT ALREADY ACTIVE':
      return 'Ya tienes una importación en curso. Espera a que termine para empezar otra.';
  }

  switch (error.statusCode) {
    case 0:
      return 'No se ha podido enviar el fichero. Comprueba tu conexión e inténtalo de nuevo.';
    case 403:
    case 404:
      return 'Esa biblioteca ya no está disponible.';
    default:
      return 'No se ha podido completar la operación. Inténtalo de nuevo.';
  }
}
