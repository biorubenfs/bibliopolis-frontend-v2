import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorIntl, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { tap } from 'rxjs';

import { SpanishPaginatorIntl } from '../../core/i18n/paginator-intl';
import { SearchableList } from '../../core/lists/searchable-list';
import { SectionCounts } from '../../core/tabbed-section/section-counts';
import { LeaveLibraryDialog } from './leave-library-dialog/leave-library-dialog';
import { SharedLibrariesService } from './shared-libraries.service';
import { SharedLibrary } from './shared-library.model';
import { SharedLibraryCard } from './shared-library-card/shared-library-card';

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
  private readonly counts = inject(SectionCounts);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  private readonly content = viewChild.required<ElementRef<HTMLElement>>('content');

  /** Without libraries there is nothing to search in; with no results it stays, to change it. */
  protected readonly showSearch = computed(() => this.search() !== '' || this.total() > 0);

  /** Own libraries that match the search. */
  protected readonly ownMatches = this.counts.own.asReadonly();

  protected fetch(options: { skip: number; limit: number; search: string }) {
    return this.sharedLibraries.list(options).pipe(
      tap({
        next: ({ total }) => this.counts.shared.set(total),
        error: () => this.counts.shared.set(null),
      }),
    );
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
        }
      });
  }
}
