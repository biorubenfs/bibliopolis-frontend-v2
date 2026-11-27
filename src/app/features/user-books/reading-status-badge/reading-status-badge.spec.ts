import { TestBed } from '@angular/core/testing';

import { ReadingStatus } from '../user-book.model';
import { ReadingStatusBadge } from './reading-status-badge';

describe('ReadingStatusBadge', () => {
  it.each<[ReadingStatus, string, string]>([
    ['to_read', 'Pendiente', 'bookmark'],
    ['reading', 'Leyendo', 'auto_stories'],
    ['read', 'Leído', 'task_alt'],
  ])('shows %s with its text and icon, readable as a whole', async (status, label, icon) => {
    const fixture = TestBed.createComponent(ReadingStatusBadge);
    fixture.componentRef.setInput('status', status);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain(label);
    expect(element.querySelector('mat-icon')?.textContent).toBe(icon);
    expect(element.getAttribute('role')).toBe('img');
    expect(element.getAttribute('aria-label')).toBe(label);
    expect(element.classList).toContain(status);
  });
});
