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
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorIntl, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';

import { SpanishPaginatorIntl } from '../../core/i18n/paginator-intl';
import { SearchableList } from '../../core/lists/searchable-list';
import { LeaveLibraryDialog } from './leave-library-dialog/leave-library-dialog';
import { SharedLibrariesService } from './shared-libraries.service';
import { SharedLibrary } from './shared-library.model';
import { SharedLibraryCard } from './shared-library-card/shared-library-card';

const DIALOG_SIZE = { width: '520px', maxWidth: 'calc(100vw - 32px)' };

/** «Compartidas conmigo»: the libraries of other users. The API offers no search for them. */
@Component({
  selector: 'app-shared-libraries-page',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    SharedLibraryCard,
  ],
  templateUrl: './shared-libraries-page.html',
  styleUrl: './shared-libraries-page.scss',
  providers: [{ provide: MatPaginatorIntl, useClass: SpanishPaginatorIntl }],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SharedLibrariesPage extends SearchableList<SharedLibrary> {
  private readonly sharedLibraries = inject(SharedLibrariesService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  private readonly heading = viewChild.required<ElementRef<HTMLElement>>('heading');

  protected readonly countLabel = computed(() => {
    const count = this.total();
    return `${count} ${count === 1 ? 'biblioteca' : 'bibliotecas'}`;
  });

  protected fetch({ skip, limit }: { skip: number; limit: number }) {
    return this.sharedLibraries.list({ skip, limit });
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
          this.heading().nativeElement.focus();
          this.load({ quiet: true });
        }
      });
  }
}
