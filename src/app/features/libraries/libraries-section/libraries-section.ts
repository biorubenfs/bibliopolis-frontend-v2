import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  ElementRef,
  Injector,
  WritableSignal,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTabsModule } from '@angular/material/tabs';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import {
  Observable,
  Subject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  filter,
  map,
  of,
  startWith,
  switchMap,
  tap,
} from 'rxjs';

import { Page } from '../../../core/http/api.models';
import {
  SEARCH_DEBOUNCE_MS,
  SEARCH_MAX_LENGTH,
  toSearchTerm,
} from '../../../core/lists/searchable-list';
import { SharedLibrariesService } from '../../shared-libraries/shared-libraries.service';
import { LibrariesService } from '../libraries.service';
import { LibraryCounts } from './library-counts';

type LibrariesTab = 'own' | 'shared';

const OWN_PATH = '/libraries';
const SHARED_PATH = '/libraries/shared';

/** Query params that only move through the list, without narrowing it. */
const NAVIGATION_PARAMS = ['q', 'page', 'limit'];

/**
 * «Bibliotecas»: the own libraries and the ones shared with the user, one tab each. The tabs are
 * here and not in the pages, or they would lose the keyboard focus when one page replaces the other.
 * So is the search, which applies to both tabs: in the header, in the same place as in the other
 * list pages. It only updates `?q=`, and the page of the open tab reacts to it.
 */
@Component({
  selector: 'app-libraries-section',
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTabsModule,
    RouterLink,
    RouterOutlet,
  ],
  templateUrl: './libraries-section.html',
  styleUrl: './libraries-section.scss',
  providers: [LibraryCounts],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LibrariesSection {
  private readonly router = inject(Router);
  private readonly librariesService = inject(LibrariesService);
  private readonly sharedLibraries = inject(SharedLibrariesService);
  private readonly counts = inject(LibraryCounts);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly document = inject(DOCUMENT);

  protected readonly searchMaxLength = SEARCH_MAX_LENGTH;

  protected readonly tab = signal<LibrariesTab>('own');
  /**
   * Search applied to the lists (debounced and trimmed). Kept when changing tabs, unlike the page
   * and the filters, which belong to one of them.
   */
  protected readonly search = signal('');
  /** Text in the search field, updated on every keystroke. */
  protected readonly query = signal('');
  /** A filter of the open tab narrows its list. */
  private readonly filtered = signal(false);
  protected readonly tabQueryParams = computed(() => ({ q: this.search() || null }));

  /** Without libraries in any tab there is nothing to look for; with no results it stays. */
  protected readonly showSearch = computed(
    () =>
      this.search() !== '' ||
      this.filtered() ||
      this.counts.own() !== 0 ||
      this.counts.shared() !== 0,
  );
  /** Each tab searches in different fields. */
  protected readonly searchPlaceholder = computed(() =>
    this.tab() === 'own' ? 'Nombre o descripción' : 'Nombre, descripción o propietario',
  );
  protected readonly searchLabel = computed(() =>
    this.tab() === 'own' ? 'Buscar bibliotecas' : 'Buscar bibliotecas compartidas conmigo',
  );

  private readonly searchInput = new Subject<string>();

  protected readonly tabs = computed(() => [
    this.toTab('own', 'Mías', OWN_PATH, this.counts.own()),
    this.toTab('shared', 'Compartidas conmigo', SHARED_PATH, this.counts.shared()),
  ]);

  constructor() {
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        startWith(null),
        map(() => this.readUrl()),
        tap(({ filtered }) => this.filtered.set(filtered)),
        distinctUntilChanged((a, b) => a.tab === b.tab && a.search === b.search),
        switchMap(({ tab, search }, index) => {
          if (index > 0 && tab !== this.tab()) {
            this.keepFocus();
          }
          this.tab.set(tab);
          this.search.set(search);
          // Only overwrite the field when the change comes from outside (a link, back/forward, a
          // button of the page that clears the search), so a trailing space being typed stays
          if (this.query().trim() !== search) {
            this.query.set(search);
          }
          return this.countOther(tab, search);
        }),
        takeUntilDestroyed(),
      )
      .subscribe();

    this.searchInput
      .pipe(
        map((value) => value.trim()),
        debounceTime(SEARCH_DEBOUNCE_MS),
        takeUntilDestroyed(),
      )
      .subscribe((term) => this.updateSearchInUrl(term));
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

  private readUrl(): { tab: LibrariesTab; search: string; filtered: boolean } {
    const url = this.router.parseUrl(this.router.url);
    const path = this.router.url.split(/[?#]/)[0];
    return {
      tab: path === SHARED_PATH ? 'shared' : 'own',
      search: toSearchTerm(url.queryParamMap.get('q')),
      filtered: url.queryParamMap.keys.some((key) => !NAVIGATION_PARAMS.includes(key)),
    };
  }

  /** Keeps the path of the open tab and its filters. */
  private updateSearchInUrl(term: string): void {
    // Typing a trailing space does not change the search, so it must not lose the current page
    if (term === this.search()) {
      return;
    }
    const url = this.router.parseUrl(this.router.url);
    // A new search has different results: start again from the first page
    const { q: _search, page: _page, ...params } = url.queryParams;
    url.queryParams = term ? { ...params, q: term } : params;
    // One history entry per page visit, not one per search typed
    this.router.navigateByUrl(url, { replaceUrl: true });
  }

  /** The open tab gets its number from its page, which also applies its filters. */
  private countOther(tab: LibrariesTab, search: string): Observable<void> {
    const options = { skip: 0, limit: 1, search };
    const [list, count]: [Observable<Page<unknown>>, WritableSignal<number | null>] =
      tab === 'own'
        ? [this.sharedLibraries.list(options), this.counts.shared]
        : [this.librariesService.list(options), this.counts.own];
    return list.pipe(
      map(({ total }) => total),
      // The number is only a hint: without it the tab still works
      catchError(() => of(null)),
      map((total) => count.set(total)),
    );
  }

  /** A link of the replaced page goes with it: keep the keyboard focus nearby, on the open tab. */
  private keepFocus(): void {
    afterNextRender(
      () => {
        if (this.document.activeElement === this.document.body) {
          this.host.nativeElement.querySelector<HTMLElement>('[aria-selected="true"]')?.focus();
        }
      },
      { injector: this.injector },
    );
  }

  private toTab(id: LibrariesTab, label: string, path: string, count: number | null) {
    return { id, label, path, count, countLabel: count === null ? '' : this.countLabel(count) };
  }

  private countLabel(count: number): string {
    if (this.search()) {
      return `${count} ${count === 1 ? 'resultado' : 'resultados'}`;
    }
    return `${count} ${count === 1 ? 'biblioteca' : 'bibliotecas'}`;
  }
}
