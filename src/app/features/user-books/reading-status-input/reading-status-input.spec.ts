import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { ReadingStatus } from '../user-book.model';
import { ReadingStatusInput } from './reading-status-input';

@Component({
  imports: [ReactiveFormsModule, ReadingStatusInput],
  template: `<app-reading-status-input [formControl]="control" aria-label="Estado" />`,
})
class Host {
  readonly control = new FormControl<ReadingStatus | null>(null);
}

describe('ReadingStatusInput', () => {
  async function setup(value: ReadingStatus | null = null) {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.control.setValue(value);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const button = (label: string) =>
      Array.from(element.querySelectorAll<HTMLButtonElement>('button')).find((item) =>
        item.textContent?.includes(label),
      )!;
    const click = async (label: string) => {
      button(label).click();
      await fixture.whenStable();
    };
    return { fixture, element, control: fixture.componentInstance.control, button, click };
  }

  it('shows the three statuses as a group of toggle buttons', async () => {
    const { element, button } = await setup('reading');

    expect(element.querySelector('app-reading-status-input')?.getAttribute('role')).toBe('group');
    expect(button('Pendiente').getAttribute('aria-pressed')).toBe('false');
    expect(button('Leyendo').getAttribute('aria-pressed')).toBe('true');
    expect(button('Leído').getAttribute('aria-pressed')).toBe('false');
    expect(element.textContent).not.toContain('Sin estado');
  });

  it('says when there is no status', async () => {
    const { element } = await setup();

    expect(element.textContent).toContain('Sin estado');
  });

  it('selects a status, and clears it when clicking on it again', async () => {
    const { control, click, button } = await setup();

    await click('Leído');
    expect(control.value).toBe('read');
    expect(button('Leído').getAttribute('aria-pressed')).toBe('true');

    await click('Leído');
    expect(control.value).toBeNull();
  });

  it('cannot be changed while disabled', async () => {
    const { fixture, control, button } = await setup();

    control.disable();
    await fixture.whenStable();

    expect(button('Pendiente').disabled).toBe(true);
  });
});
