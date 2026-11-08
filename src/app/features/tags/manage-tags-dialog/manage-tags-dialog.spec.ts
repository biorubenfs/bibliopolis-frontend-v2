import { TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';

import { ApiError } from '../../../core/http/api-error';
import { LibrariesService } from '../../libraries/libraries.service';
import { Tag, TagColor } from '../tag.model';
import { TagsService } from '../tags.service';
import { ManageTagsDialog } from './manage-tags-dialog';

function tag(id: string, name: string, color: TagColor, userId: string | null = 'u1'): Tag {
  return { id, name, color, userId, createdAt: '', updatedAt: '' };
}

describe('ManageTagsDialog', () => {
  const novela = tag('t1', 'Novela', 'red');
  const clasicos = tag('t2', 'Clásicos', 'purple', null);

  async function setup(services: Partial<Record<keyof TagsService, unknown>> = {}) {
    const tagsService = {
      listAll: vi.fn(() => of([clasicos, novela])),
      create: vi.fn((body: { name: string; color: TagColor }) =>
        of(tag('t3', body.name, body.color)),
      ),
      update: vi.fn((id: string, changes: Partial<Tag>) => of({ ...novela, ...changes })),
      delete: vi.fn(() => of(undefined)),
      ...services,
    };
    const list = vi.fn(() => of({ items: [], total: 3 }));
    TestBed.configureTestingModule({
      imports: [ManageTagsDialog],
      providers: [
        { provide: TagsService, useValue: tagsService },
        { provide: LibrariesService, useValue: { list } },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
      ],
    });
    const fixture = TestBed.createComponent(ManageTagsDialog);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const button = (text: string) =>
      Array.from(element.querySelectorAll('button')).find((b) => b.textContent?.includes(text))!;
    const type = (input: HTMLInputElement, value: string) => {
      input.value = value;
      input.dispatchEvent(new Event('input'));
    };
    const settle = async () => {
      fixture.detectChanges();
      await fixture.whenStable();
    };
    return { fixture, element, tagsService, list, button, type, settle };
  }

  it('lists the own tags with actions and the global ones without them', async () => {
    const { element } = await setup();

    expect(element.textContent).toContain('Tus etiquetas (1 de 10)');
    expect(element.querySelector('[aria-label="Editar Novela"]')).not.toBeNull();
    expect(element.querySelector('.globals')?.textContent).toContain('Clásicos');
    expect(element.querySelector('[aria-label="Editar Clásicos"]')).toBeNull();
    expect(element.querySelector('[aria-label="Borrar Clásicos"]')).toBeNull();
  });

  it('creates a tag with the least used colour preselected', async () => {
    const { element, tagsService, button, type, settle } = await setup();

    // Novela is red: the next colour of the palette is suggested
    expect(element.querySelector<HTMLInputElement>('.new input[value="orange"]')?.checked).toBe(
      true,
    );
    type(element.querySelector<HTMLInputElement>('.new input[matInput]')!, ' Viajes ');
    await settle();
    button('Crear etiqueta').click();
    await settle();

    expect(tagsService.create).toHaveBeenCalledWith({ name: 'Viajes', color: 'orange' });
    expect(element.textContent).toContain('Tus etiquetas (2 de 10)');
  });

  it('does not allow creating a tag with a name too short', async () => {
    const { element, button, type, settle } = await setup();

    type(element.querySelector<HTMLInputElement>('.new input[matInput]')!, 'a');
    await settle();

    expect(button('Crear etiqueta').disabled).toBe(true);
  });

  it('shows why a tag could not be created', async () => {
    const { element, button, type, settle } = await setup({
      create: vi.fn(() => throwError(() => new ApiError(409, 'CONFLICT ERROR', ''))),
    });

    type(element.querySelector<HTMLInputElement>('.new input[matInput]')!, 'Clásicos');
    await settle();
    button('Crear etiqueta').click();
    await settle();

    expect(element.querySelector('.new [role="alert"]')?.textContent).toContain(
      'Ya existe una etiqueta con ese nombre.',
    );
  });

  it('renames a tag and changes its colour', async () => {
    const { element, tagsService, button, type, settle } = await setup();

    element.querySelector<HTMLButtonElement>('[aria-label="Editar Novela"]')!.click();
    await settle();
    type(element.querySelector<HTMLInputElement>('.edit input[matInput]')!, 'Novela negra');
    element.querySelector<HTMLInputElement>('.edit input[value="teal"]')!.click();
    await settle();
    button('Guardar').click();
    await settle();

    expect(tagsService.update).toHaveBeenCalledWith('t1', { name: 'Novela negra', color: 'teal' });
    expect(element.querySelector('.edit')).toBeNull();
    expect(element.textContent).toContain('Novela negra');
  });

  it('says how many libraries lose a tag before deleting it', async () => {
    const { element, tagsService, list, button, settle } = await setup();

    element.querySelector<HTMLButtonElement>('[aria-label="Borrar Novela"]')!.click();
    await settle();

    expect(list).toHaveBeenCalledWith({ skip: 0, limit: 1, tagIds: ['t1'] });
    expect(element.querySelector('.confirm')?.textContent).toContain(
      'Se quitará de 3 bibliotecas.',
    );

    element.querySelector<HTMLButtonElement>('.confirm button.danger')!.click();
    await settle();

    expect(tagsService.delete).toHaveBeenCalledWith('t1');
    expect(element.textContent).toContain('Aún no has creado ninguna.');
    expect(button('Cerrar')).toBeDefined();
  });
});
