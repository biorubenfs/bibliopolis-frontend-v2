import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { RatingInput } from './rating-input';

@Component({
  imports: [ReactiveFormsModule, RatingInput],
  template: `<app-rating-input [formControl]="control" />`,
})
class Host {
  readonly control = new FormControl<number | null>(null);
}

describe('RatingInput', () => {
  async function setup(initial: number | null = null) {
    const fixture = TestBed.createComponent(Host);
    const { control } = fixture.componentInstance;
    control.setValue(initial);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const stars = Array.from(element.querySelectorAll('button'));

    const filled = () => stars.filter((star) => star.classList.contains('filled')).length;
    const clickStar = async (rating: number) => {
      stars[rating - 1].click();
      await fixture.whenStable();
    };
    return { fixture, control, element, stars, filled, clickStar };
  }

  it('shows ten empty stars when there is no rating', async () => {
    const { element, stars, filled } = await setup();

    expect(stars.length).toBe(10);
    expect(filled()).toBe(0);
    expect(element.textContent).toContain('Sin valorar');
  });

  it('shows the current rating', async () => {
    const { element, stars, filled } = await setup(8);

    expect(filled()).toBe(8);
    expect(element.textContent).toContain('8 de 10');
    expect(stars[7].getAttribute('aria-pressed')).toBe('true');
  });

  it('fills the stars up to the clicked one and takes its position as the rating', async () => {
    const { control, stars, filled, clickStar } = await setup();

    await clickStar(6);

    expect(control.value).toBe(6);
    expect(control.dirty).toBe(true);
    expect(filled()).toBe(6);
    expect(stars.slice(0, 6).every((star) => star.classList.contains('filled'))).toBe(true);
  });

  it('can lower the rating', async () => {
    const { control, filled, clickStar } = await setup(8);

    await clickStar(3);

    expect(control.value).toBe(3);
    expect(filled()).toBe(3);
  });

  it('clears the rating when clicking on the current one', async () => {
    const { control, filled, clickStar } = await setup(6);

    await clickStar(6);

    expect(control.value).toBeNull();
    expect(filled()).toBe(0);
  });

  it('names every star for screen readers', async () => {
    const { stars } = await setup();

    expect(stars[5].getAttribute('aria-label')).toBe('6 de 10');
  });

  it('marks the control as touched when leaving a star', async () => {
    const { control, stars } = await setup();

    stars[0].dispatchEvent(new Event('blur'));

    expect(control.touched).toBe(true);
  });

  it('disables the stars when the control is disabled', async () => {
    const { fixture, control, stars } = await setup();

    control.disable();
    await fixture.whenStable();

    expect(stars.every((star) => star.disabled)).toBe(true);
  });
});
