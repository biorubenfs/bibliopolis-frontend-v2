import { ChangeDetectionStrategy, Component, input, linkedSignal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import { ExternalBook } from '../external-book.model';

/** The data of a book found by ISBN, so the user can check that it is the right one. */
@Component({
  selector: 'app-book-preview',
  imports: [MatIconModule],
  templateUrl: './book-preview.html',
  styleUrl: './book-preview.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookPreview {
  readonly book = input.required<ExternalBook>();

  /** Starts again with each book, whose cover may well load. */
  protected readonly coverFailed = linkedSignal({ source: this.book, computation: () => false });
}
