import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import { CatalogBook } from '../../backoffice/books/catalog-book.model';
import { ShelfCover } from './shelf-cover';

/** Placeholders shown while the books load, enough to fill a wide screen. */
const SKELETON_COUNT = 8;
/** Below this distance from an edge the shelf counts as being at that edge. */
const EDGE_TOLERANCE_PX = 4;

let nextId = 0;

/**
 * A horizontal row of book covers that scrolls with the finger or the trackpad, and with two
 * buttons on screens with a mouse. Each click scrolls by most of the visible width.
 */
@Component({
  selector: 'app-book-shelf',
  imports: [MatButtonModule, MatIconModule, MatTooltipModule, ShelfCover],
  templateUrl: './book-shelf.html',
  styleUrl: './book-shelf.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookShelf {
  readonly heading = input.required<string>();
  readonly subheading = input<string>();
  readonly books = input.required<CatalogBook[]>();
  readonly loading = input(false);

  readonly openRequested = output<CatalogBook>();

  /** Unique, so a page can hold several shelves. */
  protected readonly headingId = `book-shelf-heading-${nextId++}`;
  protected readonly skeletons = Array.from({ length: SKELETON_COUNT }, (_, index) => index);
  protected readonly atStart = signal(true);
  protected readonly atEnd = signal(true);

  private readonly track = viewChild<ElementRef<HTMLElement>>('track');

  constructor() {
    // The books and the loading state change how much there is to scroll
    afterRenderEffect(() => {
      this.books();
      this.loading();
      this.updateEdges();
    });
  }

  protected updateEdges(): void {
    const element = this.track()?.nativeElement;
    if (!element) {
      return;
    }
    const maxScroll = element.scrollWidth - element.clientWidth;
    this.atStart.set(element.scrollLeft <= EDGE_TOLERANCE_PX);
    this.atEnd.set(element.scrollLeft >= maxScroll - EDGE_TOLERANCE_PX);
  }

  protected scroll(direction: 1 | -1): void {
    const element = this.track()?.nativeElement;
    if (!element) {
      return;
    }
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    element.scrollBy({
      left: direction * element.clientWidth * 0.8,
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  }

  protected authors(book: CatalogBook): string {
    return book.authors.join(', ') || 'Autor desconocido';
  }
}
