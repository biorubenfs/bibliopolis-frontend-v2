import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import { UserBook } from '../user-book.model';

@Component({
  selector: 'app-user-book-card',
  imports: [MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './user-book-card.html',
  styleUrl: './user-book-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserBookCard {
  readonly book = input.required<UserBook>();
  /** Offers removing the book from the library being shown. */
  readonly removable = input(true);
  /** Shows how many libraries contain the book, for lists that span several of them. */
  readonly showLibraryCount = input(false);

  readonly openRequested = output<void>();
  readonly removeRequested = output<void>();

  /** Covers come from external services, so a URL may stop working: show the placeholder then. */
  protected readonly coverFailed = signal(false);

  protected readonly authors = computed(
    () => this.book().bookAuthors.join(', ') || 'Autor desconocido',
  );

  protected readonly libraryCountLabel = computed(() => {
    const count = this.book().libraries.length;
    return `En ${count} ${count === 1 ? 'biblioteca' : 'bibliotecas'}`;
  });
}
