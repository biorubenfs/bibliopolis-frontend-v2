import { ChangeDetectionStrategy, Component, forwardRef, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

import { READING_STATUSES, ReadingStatus } from '../user-book.model';

/**
 * Form control with the reading statuses as segmented buttons. Clicking on the current status
 * clears it. The parent must name the control, for example with `aria-labelledby`.
 */
@Component({
  selector: 'app-reading-status-input',
  imports: [MatIconModule],
  templateUrl: './reading-status-input.html',
  styleUrl: './reading-status-input.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'group' },
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => ReadingStatusInput), multi: true },
  ],
})
export class ReadingStatusInput implements ControlValueAccessor {
  protected readonly statuses = READING_STATUSES;
  protected readonly value = signal<ReadingStatus | null>(null);
  protected readonly disabled = signal(false);

  private onChange: (value: ReadingStatus | null) => void = () => undefined;
  protected onTouched: () => void = () => undefined;

  protected select(status: ReadingStatus): void {
    const value = status === this.value() ? null : status;
    this.value.set(value);
    this.onChange(value);
    this.onTouched();
  }

  writeValue(value: ReadingStatus | null): void {
    this.value.set(value);
  }

  registerOnChange(onChange: (value: ReadingStatus | null) => void): void {
    this.onChange = onChange;
  }

  registerOnTouched(onTouched: () => void): void {
    this.onTouched = onTouched;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
  }
}
