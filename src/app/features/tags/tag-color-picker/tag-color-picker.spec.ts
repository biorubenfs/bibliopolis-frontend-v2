import { TestBed } from '@angular/core/testing';

import { TAG_COLORS } from '../tag.model';
import { TagColorPicker } from './tag-color-picker';

describe('TagColorPicker', () => {
  function render() {
    TestBed.configureTestingModule({ imports: [TagColorPicker] });
    const fixture = TestBed.createComponent(TagColorPicker);
    fixture.componentRef.setInput('value', 'green');
    fixture.detectChanges();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  it('offers every colour of the palette as a named radio button', () => {
    const { element } = render();
    const radios = element.querySelectorAll<HTMLInputElement>('input[type="radio"]');

    expect(radios.length).toBe(TAG_COLORS.length);
    expect(element.querySelector('legend')?.textContent).toContain('Color');
    expect(radios[0].closest('label')?.textContent).toContain('Rojo');
    expect(element.querySelector<HTMLInputElement>('input[value="green"]')?.checked).toBe(true);
  });

  it('updates the value when another colour is chosen', () => {
    const { fixture, element } = render();

    element.querySelector<HTMLInputElement>('input[value="pink"]')!.click();

    expect(fixture.componentInstance.value()).toBe('pink');
  });
});
