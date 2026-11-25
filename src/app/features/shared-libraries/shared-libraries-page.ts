import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorIntl, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { tap } from 'rxjs';

import { SpanishPaginatorIntl } from '../../core/i18n/paginator-intl';
import { SearchableList } from '../../core/lists/searchable-list';
import { LibraryCounts } from '../libraries/libraries-section/library-counts';
import { LeaveLibraryDialog } from './leave-library-dialog/leave-library-dialog';
import { SharedLibrariesService } from './shared-libraries.service';
import { SharedLibrary, SharedLibraryOwner } from './shared-library.model';
import { SharedLibraryCard } from './shared-library-card/shared-library-card';

/** Query param with the ID of the owner whose libraries are listed. */
const OWNER_QUERY_PARAM = 'owner';

const DIALOG_SIZE = { width: '520px', maxWidth: 'calc(100vw - 32px)' };

/** «Compartidas conmigo»: the libraries of other users. */
@Component({
  selector: 'app-shared-libraries-page',
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    RouterLink,
    SharedLibraryCard,
  ],
  templateUrl: './shared-libraries-page.html',
  styleUrl: './shared-libraries-page.scss',
  providers: [{ provide: MatPaginatorIntl, useClass: SpanishPaginatorIntl }],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SharedLibrariesPage extends SearchableList<SharedLibrary> {
  private readonly sharedLibraries = inject(SharedLibrariesService);
  private readonly pageDestroyRef = inject(DestroyRef);
  private readonly counts = inject(LibraryCounts);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  private readonly content = viewChild.required<ElementRef<HTMLElement>>('content');

  protected override readonly filterParams = [OWNER_QUERY_PARAM];
  /** Only list the libraries of this owner; empty for all of them. */
  protected readonly ownerId = computed(() => this.filters()[OWNER_QUERY_PARAM] ?? '');

  /** Who shares libraries with the user, by name. */
  protected readonly owners = signal<SharedLibraryOwner[]>([]);
  protected readonly ownerName = computed(
    () => this.owners().find(({ id }) => id === this.ownerId())?.name ?? '',
  );
  /** With a single owner there is nothing to choose. */
  protected readonly showOwners = computed(() => this.owners().length > 1 || this.ownerId() !== '');

  /** Without libraries there is nothing to look for; with no results it stays, to change it. */
  protected readonly showFilters = computed(
    () => this.search() !== '' || this.ownerId() !== '' || this.total() > 0,
  );

  /** Own libraries that match the search. The owner does not apply to them. */
  protected readonly ownMatches = computed(() => (this.search() ? this.counts.own() : null));

  constructor() {
    super();
    this.loadOwners();
  }

  protected fetch(options: { skip: number; limit: number; search: string }) {
    return this.sharedLibraries.list({ ...options, ownerId: this.ownerId() }).pipe(
      tap({
        next: ({ total }) => this.counts.shared.set(total),
        error: () => this.counts.shared.set(null),
      }),
    );
  }

  /** The ones that share nothing any more are dropped from the URL: the list would be empty. */
  private loadOwners(): void {
    this.sharedLibraries
      .listOwners()
      .pipe(takeUntilDestroyed(this.pageDestroyRef))
      .subscribe({
        next: (owners) => {
          this.owners.set(owners);
          if (this.ownerId() !== '' && !owners.some(({ id }) => id === this.ownerId())) {
            this.updateFilter(OWNER_QUERY_PARAM, '', true);
          }
        },
        // The libraries are what matters here: without the owners, only the filter is missing
        error: () => undefined,
      });
  }

  protected changeOwner(ownerId: string): void {
    this.updateFilter(OWNER_QUERY_PARAM, ownerId);
  }

  protected openLeaveDialog(library: SharedLibrary): void {
    this.dialog
      .open<LeaveLibraryDialog, SharedLibrary, boolean>(LeaveLibraryDialog, {
        ...DIALOG_SIZE,
        data: library,
      })
      .afterClosed()
      .subscribe((left) => {
        if (left) {
          this.snackBar.open(`Has salido de «${library.name}»`, undefined, { duration: 4000 });
          // The button that opened the dialog goes with its card: keep the keyboard focus nearby
          this.content().nativeElement.focus();
          this.load({ quiet: true });
          this.loadOwners();
        }
      });
  }
}
