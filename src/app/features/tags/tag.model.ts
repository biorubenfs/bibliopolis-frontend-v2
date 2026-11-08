/** Keys of the closed palette defined by the backend (see docs/api/tags.md). */
export const TAG_COLORS = [
  'red',
  'orange',
  'yellow',
  'green',
  'teal',
  'blue',
  'indigo',
  'purple',
  'pink',
  'grey',
] as const;

export type TagColor = (typeof TAG_COLORS)[number];

export interface Tag {
  id: string;
  name: string;
  color: TagColor;
  /** Owner of a personal tag, or null for a global tag that users cannot change. */
  userId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTag {
  name: string;
  color: TagColor;
}

export type UpdateTag = Partial<CreateTag>;

/** Validation limits defined by the backend (see docs/api/tags.md). */
export const TAG_NAME_MIN_LENGTH = 2;
export const TAG_NAME_MAX_LENGTH = 20;
export const MAX_TAGS_PER_USER = 10;
export const MAX_TAGS_PER_LIBRARY = 5;

export interface TagColorStyle {
  /** Spanish name, for the colour picker. */
  label: string;
  background: string;
  text: string;
}

/**
 * Colours of each key. Every text colour has a contrast of at least 6.8:1 on its background
 * (WCAG AA asks for 4.5:1), so the name stays readable. The colour only helps: the name is always
 * shown, because colour alone must not carry the meaning (WCAG 1.4.1).
 */
export const TAG_COLOR_STYLES: Record<TagColor, TagColorStyle> = {
  red: { label: 'Rojo', background: '#f9b4b0', text: '#6e1410' },
  orange: { label: 'Naranja', background: '#ffc999', text: '#6b2e00' },
  yellow: { label: 'Amarillo', background: '#ffe070', text: '#5c4300' },
  green: { label: 'Verde', background: '#a8ddb2', text: '#144220' },
  teal: { label: 'Turquesa', background: '#99ddd2', text: '#00423b' },
  blue: { label: 'Azul', background: '#b3c7ff', text: '#142f70' },
  indigo: { label: 'Índigo', background: '#c4c0ff', text: '#2a2380' },
  purple: { label: 'Morado', background: '#ddb8f2', text: '#52106b' },
  pink: { label: 'Rosa', background: '#f7b5d3', text: '#6e0f3d' },
  grey: { label: 'Gris', background: '#cfcfcb', text: '#2e2f2f' },
};

export function isGlobalTag(tag: Tag): boolean {
  return tag.userId === null;
}

/** Same comparison as the backend: ignores case and repeated spaces, but not accents. */
export function normalizeTagName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es');
}

/** The colour the user has used least in their own tags, so new tags look different. */
export function leastUsedColor(tags: readonly Tag[]): TagColor {
  const uses = new Map<TagColor, number>(TAG_COLORS.map((color) => [color, 0]));
  for (const tag of tags) {
    if (!isGlobalTag(tag)) {
      uses.set(tag.color, (uses.get(tag.color) ?? 0) + 1);
    }
  }
  return TAG_COLORS.reduce((best, color) => (uses.get(color)! < uses.get(best)! ? color : best));
}

/** Sorts by name the way a Spanish reader expects (accents next to their letter). */
export function sortTags(tags: readonly Tag[]): Tag[] {
  return [...tags].sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
}
