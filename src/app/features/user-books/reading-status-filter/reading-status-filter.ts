import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';

import { READING_STATUSES } from '../user-book.model';
import { ReadingStatusQuery } from '../user-books.service';

/** The oldest year offered by the year filter, unless the URL asks for an older one. */
export const FIRST_READ_YEAR = 2000;

/** Query params of the filter, the same in every list of books. */
export const STATUS_QUERY_PARAM = 'status';
export const YEAR_QUERY_PARAM = 'year';

const STATUS_QUERIES: readonly string[] = [...READING_STATUSES.map(({ value }) => value), 'none'];

/** Anyone can edit the URL: an unknown status means every status. */
export function toStatusQuery(value: string | null | undefined): ReadingStatusQuery | '' {
  return value && STATUS_QUERIES.includes(value) ? (value as ReadingStatusQuery) : '';
}

/** A year of four digits, or null for every year. */
export function toReadYear(value: string | number | null | undefined): number | null {
  const text = String(value ?? '');
  return /^\d{4}$/.test(text) ? Number(text) : null;
}

export interface ReadingStatusFilterChange {
  /** Empty for every status. */
  status: ReadingStatusQuery | '';
  /** Only with the status read; null for every year. */
  year: number | null;
}

/**
 * A select for the reading status of the books and, for the read ones, another one for the year,
 * both styled as filter chips. It only shows the filter: the page keeps it in the URL and reloads
 * the list.
 */
@Component({
  selector: 'app-reading-status-filter',
  imports: [MatIconModule, MatSelectModule],
  templateUrl: './reading-status-filter.html',
  styleUrl: './reading-status-filter.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReadingStatusFilter {
  /** Empty for every status. */
  readonly status = input<ReadingStatusQuery | ''>('');
  readonly year = input<number | null>(null);
  /** The current year, as a parameter so tests do not depend on the date. */
  readonly currentYear = input(new Date().getFullYear());

  readonly changed = output<ReadingStatusFilterChange>();

  protected readonly options = [
    ...READING_STATUSES,
    { value: 'none' as const, label: 'Sin estado', icon: 'remove' },
  ];

  /** The chip shows the icon of the chosen status, as the only hint of it besides its text. */
  protected readonly selectedOption = computed(() =>
    this.options.find(({ value }) => value === this.status()),
  );

  /** From this year back to the first one, and the one in the URL if it is older. */
  protected readonly years = computed(() => {
    const current = this.currentYear();
    const selected = this.year();
    const first = Math.min(FIRST_READ_YEAR, selected ?? FIRST_READ_YEAR);
    return Array.from({ length: current - first + 1 }, (_, index) => current - index);
  });

  protected changeStatus(value: ReadingStatusQuery | null): void {
    // «Todos los estados» is null. The year only applies to the read books
    const status = value ?? '';
    this.changed.emit({ status, year: status === 'read' ? this.year() : null });
  }

  protected changeYear(year: number | null): void {
    this.changed.emit({ status: this.status(), year });
  }
}
