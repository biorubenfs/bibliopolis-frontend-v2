import { Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';

/**
 * The numbers on the tabs of a section; `null` while unknown. Each page sets its own one with the
 * total of its list, and the section asks for the one of the page that is not open.
 */
@Injectable()
export class SectionCounts {
  readonly own = signal<number | null>(null);
  readonly shared = signal<number | null>(null);

  private readonly recounts = new Subject<void>();
  readonly recounts$ = this.recounts.asObservable();

  /** Something done in the open page changed the number of the other one. */
  recountOther(): void {
    this.recounts.next();
  }
}
