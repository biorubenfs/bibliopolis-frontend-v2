import {
  ChangeDetectionStrategy,
  Component,
  WritableSignal,
  computed,
  inject,
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

import { Page } from '../../../core/http/api.models';
import { toSearchTerm } from '../../../core/lists/searchable-list';
import { SharedLibrariesService } from '../../shared-libraries/shared-libraries.service';
import { LibrariesService } from '../libraries.service';
import { LibraryCounts } from './library-counts';

type LibrariesTab = 'own' | 'shared';

const OWN_PATH = '/libraries';
const SHARED_PATH = '/libraries/shared';

/**
 * «Bibliotecas»: the own libraries and the ones shared with the user, one tab each. The tabs are
 * here and not in the pages, or they would lose the keyboard focus when one page replaces the other.
 */
@Component({
  selector: 'app-libraries-section',
  imports: [MatTabsModule, RouterLink, RouterOutlet],
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

  protected readonly tab = signal<LibrariesTab>('own');
  /** Kept when changing tabs, unlike the page and the filters, which belong to one of them. */
  protected readonly search = signal('');
  protected readonly tabQueryParams = computed(() => ({ q: this.search() || null }));

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
        distinctUntilChanged((a, b) => a.tab === b.tab && a.search === b.search),
        switchMap(({ tab, search }) => {
          this.tab.set(tab);
          this.search.set(search);
          return this.countOther(tab, search);
        }),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  private readUrl(): { tab: LibrariesTab; search: string } {
    const url = this.router.parseUrl(this.router.url);
    const path = this.router.url.split(/[?#]/)[0];
    return {
      tab: path === SHARED_PATH ? 'shared' : 'own',
      search: toSearchTerm(url.queryParamMap.get('q')),
    };
  }

  /** The open tab gets its number from its page, which also applies its filters. */
  private countOther(tab: LibrariesTab, search: string): Observable<void> {
    const options = { skip: 0, limit: 1 };
    const [list, count]: [Observable<Page<unknown>>, WritableSignal<number | null>] =
      tab === 'own'
        ? [this.sharedLibraries.list(options), this.counts.shared]
        : [this.librariesService.list({ ...options, search }), this.counts.own];
    return list.pipe(
      map(({ total }) => total),
      // The number is only a hint: without it the tab still works
      catchError(() => of(null)),
      map((total) => count.set(total)),
    );
  }

  private toTab(id: LibrariesTab, label: string, path: string, count: number | null) {
    return { id, label, path, count, countLabel: count === null ? '' : this.countLabel(count) };
  }

  private countLabel(count: number): string {
    return `${count} ${count === 1 ? 'biblioteca' : 'bibliotecas'}`;
  }
}
