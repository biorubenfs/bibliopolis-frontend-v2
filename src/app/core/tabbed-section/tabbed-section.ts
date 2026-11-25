import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  DestroyRef,
  ElementRef,
  Injector,
  OnInit,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatTabsModule } from '@angular/material/tabs';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import {
  Observable,
  catchError,
  distinctUntilChanged,
  filter,
  map,
  of,
  startWith,
  switchMap,
} from 'rxjs';

import { Page } from '../http/api.models';
import { toSearchTerm } from '../lists/searchable-list';
import { SectionCounts } from './section-counts';

type TabId = 'own' | 'shared';

/** What is the same for the own items and the ones shared with the user. */
export interface SectionTab {
  label: string;
  path: string;
  /** Lists the items of the tab, to know how many there are. */
  list: (options: { skip: number; limit: number; search: string }) => Observable<Page<unknown>>;
}

/**
 * A section with the own items and the ones shared with the user, one tab each. The tabs are here
 * and not in the pages, or they would lose the keyboard focus when one page replaces the other.
 */
@Component({
  selector: 'app-tabbed-section',
  imports: [MatTabsModule, RouterLink, RouterOutlet],
  templateUrl: './tabbed-section.html',
  styleUrl: './tabbed-section.scss',
  providers: [SectionCounts],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TabbedSection implements OnInit {
  private readonly router = inject(Router);
  private readonly counts = inject(SectionCounts);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  readonly heading = input.required<string>();
  readonly own = input.required<SectionTab>();
  readonly shared = input.required<SectionTab>();
  /** How the items are called, e.g. «biblioteca» and «bibliotecas». */
  readonly singular = input.required<string>();
  readonly plural = input.required<string>();

  protected readonly tab = signal<TabId>('own');
  /** Kept when changing tabs, unlike the page and the filters, which belong to one of them. */
  protected readonly search = signal('');
  protected readonly tabQueryParams = computed(() => ({ q: this.search() || null }));

  protected readonly tabs = computed(() => [
    this.toTab('own', this.own(), this.counts.own()),
    this.toTab('shared', this.shared(), this.counts.shared()),
  ]);

  /** Not in the constructor: the inputs are not set yet. */
  ngOnInit(): void {
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        startWith(null),
        map(() => this.readUrl()),
        distinctUntilChanged((a, b) => a.tab === b.tab && a.search === b.search),
        switchMap(({ tab, search }, index) => {
          if (index > 0 && tab !== this.tab()) {
            this.keepFocus();
          }
          this.tab.set(tab);
          this.search.set(search);
          return this.counts.recounts$.pipe(
            startWith(null),
            switchMap(() => this.countOther(tab, search)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  private readUrl(): { tab: TabId; search: string } {
    const url = this.router.parseUrl(this.router.url);
    const path = this.router.url.split(/[?#]/)[0];
    return {
      tab: path === this.shared().path ? 'shared' : 'own',
      search: toSearchTerm(url.queryParamMap.get('q')),
    };
  }

  /** The open tab gets its number from its page, which also applies its filters. */
  private countOther(tab: TabId, search: string): Observable<void> {
    const [other, count] =
      tab === 'own' ? [this.shared(), this.counts.shared] : [this.own(), this.counts.own];
    return other.list({ skip: 0, limit: 1, search }).pipe(
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

  private toTab(id: TabId, { label, path }: SectionTab, count: number | null) {
    return { id, label, path, count, countLabel: count === null ? '' : this.countLabel(count) };
  }

  private countLabel(count: number): string {
    if (this.search()) {
      return `${count} ${count === 1 ? 'resultado' : 'resultados'}`;
    }
    return `${count} ${count === 1 ? this.singular() : this.plural()}`;
  }
}
