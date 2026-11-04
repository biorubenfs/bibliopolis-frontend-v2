import { ChangeDetectionStrategy, Component, computed, forwardRef, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

import { USER_BOOK_RATINGS } from '../user-book.model';

/**
 * Form control that picks a rating by clicking on a row of stars. Clicking on the current rating
 * clears it. The parent must name the control, for example with `aria-labelledby`.
 */
@Component({
  selector: 'app-rating-input',
  templateUrl: './rating-input.html',
  styleUrl: './rating-input.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'group' },
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => RatingInput), multi: true },
  ],
})
export class RatingInput implements ControlValueAccessor {
  protected readonly ratings = USER_BOOK_RATINGS;
  protected readonly value = signal<number | null>(null);
  protected readonly disabled = signal(false);
  protected readonly status = computed(() => {
    const value = this.value();
    return value === null ? 'Sin valorar' : `${value} de ${this.ratings.length}`;
  });

  private onChange: (value: number | null) => void = () => undefined;
  protected onTouched: () => void = () => undefined;

  protected select(rating: number): void {
    const value = rating === this.value() ? null : rating;
    this.value.set(value);
    this.onChange(value);
    this.onTouched();
  }

  writeValue(value: number | null): void {
    this.value.set(value);
  }

  registerOnChange(onChange: (value: number | null) => void): void {
    this.onChange = onChange;
  }

  registerOnTouched(onTouched: () => void): void {
    this.onTouched = onTouched;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
  }
}
