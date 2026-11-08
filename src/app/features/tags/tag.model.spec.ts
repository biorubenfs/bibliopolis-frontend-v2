import { Tag, TagColor, leastUsedColor, normalizeTagName, sortTags } from './tag.model';

function tag(name: string, color: TagColor = 'red', userId: string | null = 'u1'): Tag {
  return { id: name, name, color, userId, createdAt: '', updatedAt: '' };
}

describe('tag model', () => {
  it('normalizes names like the backend: case and spaces, but not accents', () => {
    expect(normalizeTagName('  Novela   NEGRA ')).toBe('novela negra');
    expect(normalizeTagName('Ficción')).not.toBe(normalizeTagName('Ficcion'));
  });

  it('picks the first colour of the palette when the user has no tags', () => {
    expect(leastUsedColor([])).toBe('red');
  });

  it('picks the colour used least in the user tags, ignoring global tags', () => {
    const tags = [tag('a', 'red'), tag('b', 'orange'), tag('c', 'yellow', null)];
    expect(leastUsedColor(tags)).toBe('yellow');
  });

  it('sorts names with accents next to their letter', () => {
    const names = sortTags([tag('Zoología'), tag('Ética'), tag('Ensayo')]).map((t) => t.name);
    expect(names).toEqual(['Ensayo', 'Ética', 'Zoología']);
  });
});
