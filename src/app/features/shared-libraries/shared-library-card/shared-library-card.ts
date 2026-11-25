import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';

import { SharedLibrary } from '../shared-library.model';

/** A library of another user. Its owner is always visible: names may be repeated among users. */
@Component({
  selector: 'app-shared-library-card',
  imports: [MatButtonModule, MatIconModule, MatTooltipModule, RouterLink],
  templateUrl: './shared-library-card.html',
  styleUrl: './shared-library-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SharedLibraryCard {
  readonly library = input.required<SharedLibrary>();

  readonly leaveRequested = output<void>();

  protected readonly booksLabel = computed(() => {
    const count = this.library().booksCount;
    return `${count} ${count === 1 ? 'libro' : 'libros'}`;
  });
}
