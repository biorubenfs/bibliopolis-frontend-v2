import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { catchError, map, of, startWith, switchMap } from 'rxjs';

import { LibrariesService } from '../../libraries/libraries.service';
import { Library } from '../../libraries/library.model';

/** The backend resolves up to 100 IDs in one request, and a book is never in that many libraries. */
const MAX_LIBRARIES = 100;

/** Libraries shown before the rest are folded behind a «+N más» chip, to keep the dialog short. */
const VISIBLE_LIBRARIES = 3;

type State =
  { status: 'loading' } | { status: 'error' } | { status: 'loaded'; libraries: Library[] };

/**
 * Lists the libraries that contain a book as links to each of them. The library the book is being
 * viewed from, if any, goes first and is marked instead of linked. Beyond the first few, the rest
 * stay folded until the user asks for them.
 */
@Component({
  selector: 'app-book-libraries',
  imports: [MatIconModule, RouterLink],
  templateUrl: './book-libraries.html',
  styleUrl: './book-libraries.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookLibraries {
  private readonly librariesService = inject(LibrariesService);

  /** IDs of the libraries that contain the book. */
  readonly libraryIds = input.required<readonly string[]>();
  /** The library the book is being viewed from, when there is one. */
  readonly currentLibraryId = input<string>();

  /** Emitted when the user follows a link to a library, so a dialog can close itself. */
  readonly navigated = output<void>();

  private readonly state = toSignal(
    toObservable(this.libraryIds).pipe(
      switchMap((ids) => {
        if (ids.length === 0) {
          return of<State>({ status: 'loaded', libraries: [] });
        }
        return this.librariesService.list({ skip: 0, limit: MAX_LIBRARIES, ids }).pipe(
          map((page): State => ({ status: 'loaded', libraries: page.items })),
          catchError(() => of<State>({ status: 'error' })),
          startWith<State>({ status: 'loading' }),
        );
      }),
    ),
    { initialValue: { status: 'loading' } as State },
  );

  protected readonly status = computed(() => this.state().status);

  /** The current library first; the rest keep the order of the listing (favorites first). */
  protected readonly libraries = computed(() => {
    const state = this.state();
    if (state.status !== 'loaded') {
      return [];
    }
    const currentId = this.currentLibraryId();
    const current = state.libraries.filter((library) => library.id === currentId);
    const others = state.libraries.filter((library) => library.id !== currentId);
    return [...current, ...others];
  });

  protected readonly expanded = signal(false);

  protected readonly visibleLibraries = computed(() =>
    this.expanded() ? this.libraries() : this.libraries().slice(0, VISIBLE_LIBRARIES),
  );

  /** How many libraries the «+N más» chip hides; 0 when they all fit. */
  protected readonly hiddenCount = computed(() =>
    Math.max(this.libraries().length - VISIBLE_LIBRARIES, 0),
  );

  protected isCurrent(library: Library): boolean {
    return library.id === this.currentLibraryId();
  }

  protected toggleExpanded(): void {
    this.expanded.update((expanded) => !expanded);
  }
}
