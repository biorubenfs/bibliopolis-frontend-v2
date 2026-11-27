import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';

import { LibraryExportFormat } from '../../libraries/library.model';
import { PublicBadge } from '../../libraries/public-badge/public-badge';
import { SharedLibrary } from '../shared-library.model';

/** What the card shows: the libraries of «Públicas» have no more. */
export type SharedLibraryCardData = Pick<
  SharedLibrary,
  'id' | 'name' | 'description' | 'ownerName' | 'booksCount'
> &
  Partial<Pick<SharedLibrary, 'isPublic'>>;

/**
 * A library of another user, shared with them or public. Its owner is always visible: names may be
 * repeated among users.
 */
@Component({
  selector: 'app-shared-library-card',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    PublicBadge,
    RouterLink,
  ],
  templateUrl: './shared-library-card.html',
  styleUrl: './shared-library-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SharedLibraryCard {
  readonly library = input.required<SharedLibraryCardData>();
  /** The page of the library is under the tab the card is in. */
  readonly basePath = input('/libraries/shared');
  /** Only a member can leave a library. */
  readonly leavable = input(true);
  /** True while an export of this library is being downloaded. */
  readonly exporting = input(false);

  readonly exportRequested = output<LibraryExportFormat>();
  readonly leaveRequested = output<void>();

  protected readonly booksLabel = computed(() => {
    const count = this.library().booksCount;
    return `${count} ${count === 1 ? 'libro' : 'libros'}`;
  });
}
