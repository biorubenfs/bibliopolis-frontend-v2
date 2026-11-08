import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';

import { TagBadge } from '../../tags/tag-badge/tag-badge';
import { Tag } from '../../tags/tag.model';
import { FavoriteButton } from '../favorite-button/favorite-button';
import { Library, LibraryExportFormat } from '../library.model';

@Component({
  selector: 'app-library-card',
  imports: [
    FavoriteButton,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    RouterLink,
    TagBadge,
  ],
  templateUrl: './library-card.html',
  styleUrl: './library-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LibraryCard {
  readonly library = input.required<Library>();
  /** Tags of the library, already resolved from its IDs. */
  readonly tags = input<Tag[]>([]);
  /** True while an export of this library is being downloaded. */
  readonly exporting = input(false);
  /** True while the favorite mark of this library is being saved. */
  readonly savingFavorite = input(false);

  readonly favoriteToggled = output<void>();
  readonly exportRequested = output<LibraryExportFormat>();
  readonly editRequested = output<void>();
  readonly deleteRequested = output<void>();

  protected readonly booksLabel = computed(() => {
    const count = this.library().books.length;
    return `${count} ${count === 1 ? 'libro' : 'libros'}`;
  });
}
