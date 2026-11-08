import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';

import { Tag, TagColor } from '../../tags/tag.model';
import { TagsService } from '../../tags/tags.service';
import { LibrariesService } from '../libraries.service';
import { Library } from '../library.model';
import { LibraryFormDialog } from './library-form-dialog';

function tag(id: string, name: string, color: TagColor = 'red', userId: string | null = 'u1'): Tag {
  return { id, name, color, userId, createdAt: '', updatedAt: '' };
}

const library: Library = {
  id: 'l1',
  name: 'Novela',
  description: 'Mis novelas',
  books: [],
  isFavorite: false,
  tagIds: ['t1', 't2'],
  userId: 'u1',
  createdAt: '',
  updatedAt: '',
};

describe('LibraryFormDialog', () => {
  const novela = tag('t1', 'Novela', 'red');
  const prestados = tag('t2', 'Prestados', 'orange');
  const clasicos = tag('t3', 'Clásicos', 'purple', null);

  async function setup(options: { library?: Library; listAll?: ReturnType<typeof vi.fn> } = {}) {
    const close = vi.fn();
    const create = vi.fn((values: object) => of({ ...library, ...values }));
    const update = vi.fn((_id: string, values: object) => of({ ...library, ...values }));
    const createTag = vi.fn((body: { name: string; color: TagColor }) =>
      of(tag('t9', body.name, body.color)),
    );
    const listAll = options.listAll ?? vi.fn(() => of([clasicos, novela, prestados]));
    TestBed.configureTestingModule({
      imports: [LibraryFormDialog],
      providers: [
        {
          provide: MAT_DIALOG_DATA,
          useValue: options.library ? { library: options.library } : null,
        },
        { provide: MatDialogRef, useValue: { close } },
        { provide: LibrariesService, useValue: { create, update } },
        { provide: TagsService, useValue: { listAll, create: createTag } },
      ],
    });
    const fixture = TestBed.createComponent(LibraryFormDialog);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const settle = async () => {
      fixture.detectChanges();
      await fixture.whenStable();
    };
    const tagInput = () =>
      element.querySelector<HTMLInputElement>('input[matchipinputfor], .mat-mdc-chip-input')!;
    const chips = () =>
      Array.from(element.querySelectorAll('mat-chip-row')).map((chip) =>
        chip.textContent?.replace('cancel', '').trim(),
      );
    /** Types in the tags field and returns the options of the autocomplete panel. */
    const typeTag = async (value: string) => {
      const input = tagInput();
      input.focus();
      input.dispatchEvent(new Event('focusin'));
      input.value = value;
      input.dispatchEvent(new Event('input'));
      await settle();
      return Array.from(document.querySelectorAll<HTMLElement>('mat-option'));
    };
    const fill = async (name: string, description: string) => {
      const nameInput = element.querySelector<HTMLInputElement>('input[formcontrolname="name"]')!;
      const descriptionInput = element.querySelector<HTMLTextAreaElement>(
        'textarea[formcontrolname="description"]',
      )!;
      nameInput.value = name;
      nameInput.dispatchEvent(new Event('input'));
      descriptionInput.value = description;
      descriptionInput.dispatchEvent(new Event('input'));
      await settle();
    };
    const submit = async () => {
      element.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
      await settle();
    };
    return {
      fixture,
      element,
      close,
      create,
      update,
      createTag,
      chips,
      tagInput,
      typeTag,
      fill,
      submit,
      settle,
    };
  }

  it('shows the current tags of the library being edited', async () => {
    const { chips, element } = await setup({ library });

    expect(chips()).toEqual(['Novela', 'Prestados']);
    expect(element.textContent).toContain('2 de 5 etiquetas');
  });

  it('suggests the tags not selected yet that match the text', async () => {
    const { typeTag } = await setup({ library });

    const options = await typeTag('clá');
    const suggestions = options.filter((option) => !option.textContent?.includes('Crear'));

    // Novela and Prestados are already selected: only the global tag is suggested
    expect(suggestions.map((option) => option.textContent?.trim())).toEqual(['Clásicos']);
  });

  it('adds a suggested tag and saves the new selection', async () => {
    const { typeTag, chips, settle, submit, update, close } = await setup({ library });

    (await typeTag('clás'))[0].click();
    await settle();
    expect(chips()).toEqual(['Clásicos', 'Novela', 'Prestados']);

    await submit();

    expect(update).toHaveBeenCalledWith('l1', {
      name: 'Novela',
      description: 'Mis novelas',
      tagIds: ['t3', 't1', 't2'],
    });
    expect(close).toHaveBeenCalled();
  });

  it('removes a tag', async () => {
    const { element, chips, settle, submit, update } = await setup({ library });

    element.querySelector<HTMLButtonElement>('[aria-label="Quitar Novela"]')!.click();
    await settle();
    expect(chips()).toEqual(['Prestados']);

    await submit();
    expect(update).toHaveBeenCalledWith('l1', expect.objectContaining({ tagIds: ['t2'] }));
  });

  it('creates a tag from the text typed, with the colour used least, and selects it', async () => {
    const { typeTag, chips, createTag, settle, fill, submit, create } = await setup();

    const options = await typeTag('  Viajes ');
    const createOption = options.find((option) => option.textContent?.includes('Crear'))!;
    expect(createOption.textContent).toContain('Crear «Viajes»');
    createOption.click();
    await settle();

    // Novela is red and Prestados orange (the global tag does not count): yellow comes next
    expect(createTag).toHaveBeenCalledWith({ name: 'Viajes', color: 'yellow' });
    expect(chips()).toEqual(['Viajes']);

    await fill('Viajes', 'Guías de viaje');
    await submit();
    expect(create).toHaveBeenCalledWith({
      name: 'Viajes',
      description: 'Guías de viaje',
      tagIds: ['t9'],
    });
  });

  it('does not offer to create a tag that already exists, own or global', async () => {
    const { typeTag } = await setup();

    const options = await typeTag('CLÁSICOS');

    expect(options.some((option) => option.textContent?.includes('Crear'))).toBe(false);
  });

  it('does not allow more than 5 tags', async () => {
    const many = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => tag(id, `Tag ${id}`));
    const { tagInput, element } = await setup({
      library: { ...library, tagIds: ['a', 'b', 'c', 'd', 'e'] },
      listAll: vi.fn(() => of(many)),
    });

    expect(tagInput().disabled).toBe(true);
    expect(tagInput().placeholder).toBe('Máximo de 5 etiquetas');
    expect(element.textContent).toContain('5 de 5 etiquetas');
  });

  it('keeps the current tags when they could not be loaded', async () => {
    const { submit, update, element } = await setup({
      library,
      listAll: vi.fn(() => throwError(() => new Error('down'))),
    });

    expect(element.textContent).toContain('No se han podido cargar tus etiquetas.');
    await submit();

    expect(update).toHaveBeenCalledWith('l1', { name: 'Novela', description: 'Mis novelas' });
  });
});
