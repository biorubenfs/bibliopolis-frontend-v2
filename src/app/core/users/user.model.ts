export type UserRole = 'regular' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  /** Base64-encoded PNG; may be an empty string when it could not be generated. */
  avatar: string;
  createdAt: string;
  updatedAt: string;
}
