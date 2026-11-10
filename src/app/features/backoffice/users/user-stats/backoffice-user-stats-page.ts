import { DatePipe, Location } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { Subscription, forkJoin } from 'rxjs';

import { ApiError } from '../../../../core/http/api-error';
import { ManagedUser, ManagedUsersService } from '../managed-users.service';
import { RatingChart } from './rating-chart/rating-chart';
import { UserStats } from './user-stats.model';

type PageState = 'loading' | 'loaded' | 'not-found' | 'error';

/** Spanish decimal comma, at most one decimal: «1,3». Local to this page, nothing global. */
const decimal = new Intl.NumberFormat('es', { maximumFractionDigits: 1 });
const percent = new Intl.NumberFormat('es', { style: 'percent', maximumFractionDigits: 0 });

export interface StatCard {
  label: string;
  value: string;
}

/**
 * Figures about the libraries and books of a regular user. Only figures: the backend sends no
 * library names or book data, for privacy.
 */
@Component({
  selector: 'app-backoffice-user-stats-page',
  imports: [
    DatePipe,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    RatingChart,
    RouterLink,
  ],
  templateUrl: './backoffice-user-stats-page.html',
  styleUrl: './backoffice-user-stats-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BackofficeUserStatsPage {
  private readonly users = inject(ManagedUsersService);
  private readonly location = inject(Location);
  private readonly destroyRef = inject(DestroyRef);

  /** User ID, bound from the `:id` route param. */
  readonly id = input.required<string>();

  /** Set by the link of the user list. */
  protected readonly cameFromList =
    (this.location.getState() as { fromUserList?: boolean } | null)?.fromUserList === true;

  protected readonly state = signal<PageState>('loading');
  protected readonly user = signal<ManagedUser | null>(null);
  protected readonly stats = signal<UserStats | null>(null);

  protected readonly isEmpty = computed(() => {
    const stats = this.stats();
    return stats !== null && stats.libraries.count === 0 && stats.books.total === 0;
  });

  /** Figures of the libraries and the books; the ratings have their own block. */
  protected readonly cards = computed<StatCard[]>(() => {
    const stats = this.stats();
    if (!stats) {
      return [];
    }
    const { libraries, books } = stats;
    return [
      { label: 'Bibliotecas', value: String(libraries.count) },
      { label: 'Media de libros por biblioteca', value: decimal.format(libraries.averageBooks) },
      {
        label: 'Libros en la biblioteca más grande',
        value: libraries.largestBooks === null ? '—' : String(libraries.largestBooks),
      },
      { label: 'Libros', value: String(books.total) },
      { label: 'Libros sin biblioteca', value: String(books.withoutLibrary) },
    ];
  });

  protected readonly averageRating = computed(() => {
    const average = this.stats()?.ratings.average ?? null;
    return average === null ? '—' : decimal.format(average);
  });

  /** «Libros valorados (4 %)»: the share as text, so the bar is only a help. */
  protected readonly ratedLabel = computed(() => {
    const books = this.stats()?.books;
    if (!books || books.total === 0) {
      return 'Libros valorados';
    }
    return `Libros valorados (${percent.format(books.rated / books.total)})`;
  });

  /** Share of rated books, from 0 to 100, for the bar. */
  protected readonly ratedWidth = computed(() => {
    const books = this.stats()?.books;
    return books && books.total > 0 ? (books.rated / books.total) * 100 : 0;
  });

  private loadSubscription?: Subscription;

  constructor() {
    // The router reuses this component while the route stays the same: reload on a new ID
    effect(() => {
      this.id();
      untracked(() => this.load());
    });
  }

  protected load(): void {
    this.state.set('loading');
    this.loadSubscription?.unsubscribe();
    this.loadSubscription = forkJoin({
      user: this.users.get(this.id()),
      stats: this.users.getStats(this.id()),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ user, stats }) => {
          this.user.set(user);
          this.stats.set(stats);
          this.state.set('loaded');
        },
        error: (error: unknown) => {
          // The backend also answers 404 for an admin, who has no libraries
          const notFound = error instanceof ApiError && error.statusCode === 404;
          this.state.set(notFound ? 'not-found' : 'error');
        },
      });
  }

  /** Restores the search and the page of the list, which are in its URL. */
  protected goBack(): void {
    this.location.back();
  }
}
