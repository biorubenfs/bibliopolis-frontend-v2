import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';

import { Library, LibraryExportFormat } from '../library.model';

@Component({
  selector: 'app-library-card',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  templateUrl: './library-card.html',
  styleUrl: './library-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LibraryCard {
  readonly library = input.required<Library>();
  /** True while an export of this library is being downloaded. */
  readonly exporting = input(false);

  readonly exportRequested = output<LibraryExportFormat>();
  readonly editRequested = output<void>();
  readonly deleteRequested = output<void>();

  protected readonly booksLabel = computed(() => {
    const count = this.library().books.length;
    return `${count} ${count === 1 ? 'libro' : 'libros'}`;
  });
}
