import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

/** From left to right, as in any histogram. */
const RATINGS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** Steps that read well on an axis of whole books: 1, 2, 5, 10, 20, 50… */
const NICE_STEPS = [1, 2, 5];

/** About this many gridlines above the baseline: enough to read a height, not to clutter. */
const TARGET_TICKS = 4;

export interface AxisScale {
  /** Top of the axis: the highest count rounded up to a whole step. */
  max: number;
  /** Values of the gridlines, from 0 to `max`. */
  ticks: number[];
}

/** A y axis of whole numbers with round steps, so that 0, 2, 4, 6 is drawn instead of 0, 1.5, 3. */
export function niceScale(highest: number): AxisScale {
  if (highest <= 0) {
    return { max: 1, ticks: [0, 1] };
  }
  const rough = highest / TARGET_TICKS;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = Math.max(
    1,
    (NICE_STEPS.find((nice) => nice * magnitude >= rough) ?? 10) * magnitude,
  );
  const max = Math.ceil(highest / step) * step;
  const ticks: number[] = [];
  for (let tick = 0; tick <= max; tick += step) {
    ticks.push(tick);
  }
  return { max, ticks };
}

export interface RatingColumn {
  rating: number;
  count: number;
  /** Height of the bar, as a share of the axis. */
  height: number;
  /** «Valoración 7: 2 libros», what a screen reader says on reaching the column. */
  label: string;
}

/**
 * Column chart of the ratings of a user. The count of a rating appears only in the line above the
 * chart, while the column is hovered, tapped or focused; a screen reader gets it from the name of
 * the column.
 */
@Component({
  selector: 'app-rating-chart',
  templateUrl: './rating-chart.html',
  styleUrl: './rating-chart.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RatingChart {
  /** Books with each rating, with the keys "1" to "10" (see UserStats). */
  readonly distribution = input.required<Record<string, number>>();

  protected readonly scale = computed(() =>
    niceScale(Math.max(...RATINGS.map((rating) => this.distribution()[rating] ?? 0))),
  );

  /** Highest first: the gridlines are listed from the top of the chart down. */
  protected readonly gridlines = computed(() =>
    [...this.scale().ticks]
      .reverse()
      .map((value) => ({ value, bottom: (value / this.scale().max) * 100 })),
  );

  protected readonly columns = computed<RatingColumn[]>(() => {
    const { max } = this.scale();
    return RATINGS.map((rating) => {
      const count = this.distribution()[rating] ?? 0;
      return {
        rating,
        count,
        height: (count / max) * 100,
        label: `Valoración ${rating}: ${count} ${count === 1 ? 'libro' : 'libros'}`,
      };
    });
  });

  /** Column whose count the line above the chart shows, if any. */
  protected readonly active = signal<RatingColumn | null>(null);

  protected show(column: RatingColumn): void {
    this.active.set(column);
  }

  /** Only if it is still the one shown: moving to the next column may arrive before leaving this. */
  protected hide(column: RatingColumn): void {
    if (this.active()?.rating === column.rating) {
      this.active.set(null);
    }
  }
}
