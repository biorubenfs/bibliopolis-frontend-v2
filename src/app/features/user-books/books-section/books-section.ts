import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { SectionTab, TabbedSection } from '../../../core/tabbed-section/tabbed-section';
import { SharedBooksService } from '../../shared-books/shared-books.service';
import { UserBooksService } from '../user-books.service';

/** «Libros»: the own books and the ones of the libraries shared with the user. */
@Component({
  selector: 'app-books-section',
  imports: [TabbedSection],
  template: `
    <app-tabbed-section
      heading="Libros"
      singular="libro"
      plural="libros"
      [own]="own"
      [shared]="shared"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BooksSection {
  private readonly userBooks = inject(UserBooksService);
  private readonly sharedBooks = inject(SharedBooksService);

  protected readonly own: SectionTab = {
    label: 'Míos',
    path: '/books',
    list: (options) => this.userBooks.list(options),
  };
  protected readonly shared: SectionTab = {
    label: 'Compartidos',
    path: '/books/shared',
    list: (options) => this.sharedBooks.list(options),
  };
}
