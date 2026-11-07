import { TestBed } from '@angular/core/testing';

import { FavoriteButton } from './favorite-button';

describe('FavoriteButton', () => {
  function render(favorite: boolean) {
    TestBed.configureTestingModule({ imports: [FavoriteButton] });
    const fixture = TestBed.createComponent(FavoriteButton);
    fixture.componentRef.setInput('favorite', favorite);
    fixture.componentRef.setInput('libraryName', 'Novela');
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    return {
      fixture,
      button: element.querySelector<HTMLButtonElement>('button')!,
      path: element.querySelector('path')!,
    };
  }

  // The icon font has no filled variant: the state must be drawn by the SVG, not by a ligature
  it('draws an outlined bookmark when the library is not a favorite', () => {
    const { button, path } = render(false);

    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(getComputedStyle(path).fill).toBe('none');
  });

  it('draws a filled bookmark when the library is a favorite', () => {
    const { button, path } = render(true);

    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(getComputedStyle(path).fill).toBe('currentcolor');
  });

  it('keeps the same accessible label in both states', () => {
    expect(render(false).button.getAttribute('aria-label')).toBe('Marcar Novela como favorita');
    TestBed.resetTestingModule();
    expect(render(true).button.getAttribute('aria-label')).toBe('Marcar Novela como favorita');
  });
});
