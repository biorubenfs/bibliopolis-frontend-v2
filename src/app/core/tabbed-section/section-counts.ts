import { Injectable, signal } from '@angular/core';

/**
 * The numbers on the tabs of a section; `null` while unknown. Each page sets its own one with the
 * total of its list, and the section asks for the one of the page that is not open.
 */
@Injectable()
export class SectionCounts {
  readonly own = signal<number | null>(null);
  readonly shared = signal<number | null>(null);
}
