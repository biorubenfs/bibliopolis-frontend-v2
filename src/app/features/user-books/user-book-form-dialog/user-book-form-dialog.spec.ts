import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { By } from '@angular/platform-browser';
import { MatSelect } from '@angular/material/select';
import { of, throwError } from 'rxjs';

import { UserBook } from '../user-book.model';
import { UserBooksService } from '../user-books.service';
import { UserBookFormDialog } from './user-book-form-dialog';

const book = {
  id: 'ub1',
  bookTitle: 'Rossiya',
  rating: 8,
  notes: 'Muy recomendable',
} as UserBook;

describe('UserBookFormDialog', () => {
  async function setup(update: ReturnType<typeof vi.fn> = vi.fn(() => of(book))) {
    const close = vi.fn();
    TestBed.configureTestingModule({
      imports: [UserBookFormDialog],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: book },
        { provide: MatDialogRef, useValue: { close } },
        { provide: UserBooksService, useValue: { update } },
      ],
    });
    const fixture = TestBed.createComponent(UserBookFormDialog);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const notes = element.querySelector('textarea')!;

    const typeNotes = async (value: string) => {
      notes.value = value;
      notes.dispatchEvent(new Event('input'));
      await fixture.whenStable();
    };
    const save = async () => {
      element.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
      await fixture.whenStable();
    };
    const select = fixture.debugElement.query(By.directive(MatSelect))
      .componentInstance as MatSelect;

    return { element, notes, typeNotes, save, select, update, close };
  }

  it('starts with the current rating and notes', async () => {
    const { element, notes, select } = await setup();

    expect(element.querySelector('h2')?.textContent).toContain('Rossiya');
    expect(select.value).toBe(8);
    expect(notes.value).toBe('Muy recomendable');
  });

  it('saves the changes and closes with the updated book', async () => {
    const updated = { ...book, notes: 'Otra nota' };
    const { typeNotes, save, update, close } = await setup(vi.fn(() => of(updated)));

    await typeNotes('  Otra nota ');
    await save();

    expect(update).toHaveBeenCalledWith('ub1', { rating: 8, notes: 'Otra nota' });
    expect(close).toHaveBeenCalledWith(updated);
  });

  it('sends null when the notes are emptied', async () => {
    const { typeNotes, save, update } = await setup();

    await typeNotes('   ');
    await save();

    expect(update).toHaveBeenCalledWith('ub1', { rating: 8, notes: null });
  });

  it('does not call the backend when nothing changed', async () => {
    const { save, update, close } = await setup();

    await save();

    expect(update).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledWith();
  });

  it('stays open and shows an error when saving fails', async () => {
    const { element, typeNotes, save, close } = await setup(
      vi.fn(() => throwError(() => new Error('boom'))),
    );

    await typeNotes('Otra nota');
    await save();

    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'No se han podido guardar',
    );
    expect(close).not.toHaveBeenCalled();
  });
});
