import { ApiError } from '../../core/http/api-error';

/** A user a library is shared with, as its owner sees them (see docs/api/libraries.md). */
export interface LibraryMember {
  /** The ID of the user. */
  id: string;
  userId: string;
  name: string;
  email: string;
  /** When they were given access. */
  createdAt: string;
}

/** Limit defined by the backend. */
export const MAX_LIBRARY_MEMBERS = 20;

/** User-facing message for a failed invitation. */
export function inviteErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.statusCode) {
      case 400:
        // The other 400 is a malformed email
        return error.message === 'the owner cannot be a member of the library'
          ? 'Ese es tu email: ya puedes ver esta biblioteca.'
          : 'Introduce un email válido.';
      case 404:
        return error.message === 'library not found'
          ? 'Esta biblioteca ya no existe.'
          : 'No hay ningún usuario con ese email.';
      case 409:
        return error.errorCode === 'LIBRARY MEMBERS LIMIT REACHED'
          ? `No puedes compartir una biblioteca con más de ${MAX_LIBRARY_MEMBERS} personas.`
          : 'Esa persona ya tiene acceso a la biblioteca.';
      case 429:
        return 'Demasiados intentos fallidos. Espera unos minutos y vuelve a probar.';
    }
  }
  return 'No se ha podido compartir la biblioteca. Inténtalo de nuevo.';
}
