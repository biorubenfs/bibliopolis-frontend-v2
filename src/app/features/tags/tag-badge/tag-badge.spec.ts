import { TestBed } from '@angular/core/testing';

import { Tag } from '../tag.model';
import { TagBadge } from './tag-badge';

describe('TagBadge', () => {
  it('shows the full name with the colours of its palette key', () => {
    const tag: Tag = {
      id: 't1',
      name: 'Novela negra muy larga',
      color: 'blue',
      userId: 'u1',
      createdAt: '',
      updatedAt: '',
    };
    TestBed.configureTestingModule({ imports: [TagBadge] });
    const fixture = TestBed.createComponent(TagBadge);
    fixture.componentRef.setInput('tag', tag);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent?.trim()).toBe('Novela negra muy larga');
    expect(element.style.backgroundColor).toBe('rgb(179, 199, 255)');
    expect(element.style.color).toBe('rgb(20, 47, 112)');
  });
});
