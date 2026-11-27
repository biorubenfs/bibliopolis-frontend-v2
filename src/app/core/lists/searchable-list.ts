import { DestroyRef, Directive, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PageEvent } from '@angular/material/paginator';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, Subject, Subscription, debounceTime, distinctUntilChanged, map } from 'rxjs';

import { Page } from '../http/api.models';
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  toPageNumber,
  toPageSize,
} from '../pagination/pagination';

export type LoadState = 'loading' | 'loaded' | 'error';

/** The backend rejects longer searches. */
export const SEARCH_MAX_LENGTH = 100;
/** Wait this long after the last keystroke before searching, to avoid one request per key. */
export const SEARCH_DEBOUNCE_MS = 300;

/** Anyone can edit the URL: the search is trimmed and cut to the length the backend accepts. */
export function toSearchTerm(value: string | null | undefined): string {
  return (value ?? '').trim().slice(0, SEARCH_MAX_LENGTH);
}

/**
 * A paginated list with a search box, kept in the URL (`?q=`, `?page=`, `?limit=`) like the other
 * pages: it survives reloads and back/forward, and can be shared.
 */
@Directive()
export abstract class SearchableList<T extends { id: string }> implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  protected readonly searchMaxLength = SEARCH_MAX_LENGTH;

  /** Other query params of the subclass: the list also reloads when any of them changes. */
  protected readonly filterParams: readonly string[] = [];
  /** Their values in the URL; empty without that filter. */
  protected readonly filters = signal<Readonly<Record<string, string>>>({});

  protected readonly items = signal<T[]>([]);
  protected readonly total = signal(0);
  protected readonly state = signal<LoadState>('loading');
  /** Text in the search field, updated on every keystroke. */
  protected readonly query = signal('');
  /** Search applied to the list (debounced and trimmed). */
  protected readonly search = signal('');
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(DEFAULT_PAGE_SIZE);

  protected readonly showPaginator = computed(
    () => this.state() !== 'error' && this.total() > this.pageSizeOptions[0],
  );

  private readonly searchInput = new Subject<string>();
  private loadSubscription?: Subscription;

  /**
   * Not in the constructor: it runs before the fields of the subclass exist (such as the service
   * used by `fetch()`), and the URL emits as soon as it is subscribed to.
   */
  ngOnInit(): void {
    // The URL is the source of truth: typing and the paginator only update it, and the list reacts
    // to changes from any origin. Its first emission performs the initial load.
    this.route.queryParamMap
      .pipe(
        map((params) => ({
          term: toSearchTerm(params.get('q')),
          page: toPageNumber(params.get('page')),
          limit: toPageSize(params.get('limit')),
          filters: Object.fromEntries(
            this.filterParams.map((param) => [param, params.get(param) ?? '']),
          ),
        })),
        distinctUntilChanged(
          (a, b) =>
            a.term === b.term &&
            a.page === b.page &&
            a.limit === b.limit &&
            this.filterParams.every((param) => a.filters[param] === b.filters[param]),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ term, page, limit, filters }) => {
        // Only overwrite the field when the change comes from outside, so a trailing space being
        // typed is not removed
        if (this.query().trim() !== term) {
          this.query.set(term);
        }
        this.search.set(term);
        this.filters.set(filters);
        this.pageIndex.set(page - 1);
        this.pageSize.set(limit);
        this.load();
      });

    this.searchInput
      .pipe(
        map((value) => value.trim()),
        debounceTime(SEARCH_DEBOUNCE_MS),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((term) => this.updateSearchInUrl(term));
  }

  protected abstract fetch(options: {
    skip: number;
    limit: number;
    search: string;
  }): Observable<Page<T>>;

  /** A quiet load keeps the current list on screen instead of the spinner. */
  protected load(options: { quiet?: boolean } = {}): void {
    if (!options.quiet) {
      this.state.set('loading');
    }
    const limit = this.pageSize();
    // Drop the previous request so a slow, outdated search cannot overwrite newer results
    this.loadSubscription?.unsubscribe();
    this.loadSubscription = this.fetch({
      skip: this.pageIndex() * limit,
      limit,
      search: this.search(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ items, total }) => {
          this.total.set(total);
          // Past the end, e.g. an outdated shared link: show the last page
          const lastPage = Math.ceil(total / limit);
          if (total > 0 && this.pageIndex() + 1 > lastPage) {
            this.updatePageInUrl(lastPage, limit, true);
            return;
          }
          this.items.set(items);
          this.state.set('loaded');
        },
        error: () => this.state.set('error'),
      });
  }

  /** Puts a changed item in place, without reloading the list. */
  protected replaceItem(item: T): void {
    this.items.update((list) => list.map((current) => (current.id === item.id ? item : current)));
  }

  protected onSearchInput(value: string): void {
    this.query.set(value);
    this.searchInput.next(value);
  }

  protected clearSearch(): void {
    this.query.set('');
    // Replace any keystroke still waiting in the debounce, then clear the URL right away
    this.searchInput.next('');
    this.updateSearchInUrl('');
  }

  /** Sets one of `filterParams`, or removes it with an empty value. */
  protected updateFilter(param: string, value: string, replaceUrl = false): void {
    this.updateFilters({ [param]: value }, replaceUrl);
  }

  /** Sets several of `filterParams` at once, in a single navigation; empty values remove them. */
  protected updateFilters(values: Readonly<Record<string, string>>, replaceUrl = false): void {
    const params = Object.fromEntries(
      Object.entries(values).map(([param, value]) => [param, value || null]),
    );
    this.router.navigate([], {
      relativeTo: this.route,
      // A different filter has different results: start again from the first page
      queryParams: { ...params, page: null },
      queryParamsHandling: 'merge',
      replaceUrl,
    });
  }

  /** Clears the search and `filterParams`. */
  protected clearFilters(): void {
    this.query.set('');
    // Replace any keystroke still waiting in the debounce
    this.searchInput.next('');
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        ...Object.fromEntries(this.filterParams.map((param) => [param, null])),
        q: null,
        page: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  protected changePage(event: PageEvent): void {
    this.updatePageInUrl(event.pageIndex + 1, event.pageSize);
  }

  private updateSearchInUrl(term: string): void {
    // Typing a trailing space does not change the search, so it must not lose the current page
    if (term === this.search()) {
      return;
    }
    this.router.navigate([], {
      relativeTo: this.route,
      // A new search has different results: start again from the first page
      queryParams: { q: term || null, page: null },
      queryParamsHandling: 'merge',
      // One history entry per page visit, not one per search typed
      replaceUrl: true,
    });
  }

  private updatePageInUrl(page: number, limit: number, replaceUrl = false): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        // Default values stay out of the URL to keep it short
        page: page > 1 ? page : null,
        limit: limit !== DEFAULT_PAGE_SIZE ? limit : null,
      },
      queryParamsHandling: 'merge',
      replaceUrl,
    });
  }
}
