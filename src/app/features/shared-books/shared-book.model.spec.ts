import { librariesLabel } from './shared-book.model';

describe('librariesLabel', () => {
  const viajes = { id: '1', name: 'Viajes', ownerName: 'Ana' };

  it('tells the library and its owner', () => {
    expect(librariesLabel([viajes])).toBe('Viajes, de Ana');
  });

  it('tells how many more there are', () => {
    expect(librariesLabel([viajes, { ...viajes, id: '2' }, { ...viajes, id: '3' }])).toBe(
      'Viajes, de Ana, y 2 más',
    );
  });
});
