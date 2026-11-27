import { Injectable, signal } from '@angular/core';

/**
 * The numbers on the tabs of the libraries section; `null` while unknown. Each page sets its own
 * one with the total of its list, and the section asks for the ones of the pages that are not open.
 */
@Injectable()
export class LibraryCounts {
  readonly own = signal<number | null>(null);
  readonly shared = signal<number | null>(null);
  readonly public = signal<number | null>(null);
}
