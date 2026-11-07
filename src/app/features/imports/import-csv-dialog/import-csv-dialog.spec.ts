import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSelect } from '@angular/material/select';
import { By } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';

import { ApiError } from '../../../core/http/api-error';
import { IMPORT_MAX_FILE_SIZE_BYTES, ImportAnalysis } from '../import.model';
import { ImportsService } from '../imports.service';
import { ImportCsvDialog } from './import-csv-dialog';

const csv = new File(['isbn\n9780306406157\n'], 'libros.csv', { type: 'text/csv' });

const analysis: ImportAnalysis = {
  columns: [
    { index: 0, name: 'Título' },
    { index: 1, name: 'ISBN' },
    { index: 2, name: 'Código' },
  ],
  isbnColumns: [1],
  counts: {
    rows: 10,
    valid: 6,
    invalidIsbn: 1,
    missingIsbn: 1,
    duplicateInFile: 1,
    alreadyInLibrary: 1,
  },
  sample: [{ row: 2, isbn: '9780306406157' }],
};

const library = { id: 'l1', name: 'Novela' };

describe('ImportCsvDialog', () => {
  async function setup(
    options: {
      analyze?: ReturnType<typeof vi.fn>;
      create?: ReturnType<typeof vi.fn>;
    } = {},
  ) {
    const analyze = options.analyze ?? vi.fn(() => of(analysis));
    const create = options.create ?? vi.fn(() => of({ id: 'i1', libraryId: 'l9' }));
    const close = vi.fn();
    TestBed.configureTestingModule({
      imports: [ImportCsvDialog],
      providers: [
        provideRouter([]),
        { provide: MAT_DIALOG_DATA, useValue: { library } },
        { provide: MatDialogRef, useValue: { close } },
        { provide: ImportsService, useValue: { analyze, create } },
      ],
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(ImportCsvDialog);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    const button = (text: string) =>
      Array.from(element.querySelectorAll('button')).find((b) => b.textContent?.includes(text));
    const click = async (text: string) => {
      button(text)!.click();
      await fixture.whenStable();
    };
    const selectFile = async (file: File | null) => {
      const input = element.querySelector<HTMLInputElement>('input[type="file"]')!;
      Object.defineProperty(input, 'files', { value: file ? [file] : [], configurable: true });
      input.dispatchEvent(new Event('change'));
      await fixture.whenStable();
    };
    const selectColumns = async (columns: number[]) => {
      const select = fixture.debugElement.queryAll(By.directive(MatSelect)).at(-1)!
        .componentInstance as MatSelect;
      select.selectionChange.emit({ value: columns, source: select });
      await fixture.whenStable();
    };

    return {
      fixture,
      element,
      analyze,
      create,
      close,
      navigate,
      button,
      click,
      selectFile,
      selectColumns,
    };
  }

  it('reviews a file for the library it was opened from', async () => {
    const { element, selectFile, click, analyze } = await setup();

    expect(element.textContent).toContain('Novela');

    await selectFile(csv);
    await click('Continuar');

    expect(analyze).toHaveBeenCalledExactlyOnceWith({
      file: csv,
      libraryId: 'l1',
      isbnColumns: undefined,
    });
    expect(element.textContent).toContain('10 filas leídas');
    expect(element.textContent).toContain('6 por añadir');
    expect(element.textContent).toContain('1 ya en la biblioteca');
    expect(element.querySelector('.sample')?.textContent).toContain('9780306406157');
  });

  it('asks for a file before analyzing', async () => {
    const { element, click, analyze } = await setup();

    await click('Continuar');

    expect(analyze).not.toHaveBeenCalled();
    expect(element.querySelector('.field-error')?.textContent).toContain('Elige un fichero');
  });

  it('rejects another extension and a file over the limit before sending anything', async () => {
    const { element, selectFile, click, analyze } = await setup();

    await selectFile(new File(['x'], 'libros.xlsx'));
    expect(element.querySelector('.field-error')?.textContent).toContain('.csv');

    const large = new File(['x'], 'libros.csv');
    Object.defineProperty(large, 'size', { value: IMPORT_MAX_FILE_SIZE_BYTES + 1 });
    await selectFile(large);
    expect(element.querySelector('.field-error')?.textContent).toContain('5 MB');

    await click('Continuar');
    expect(analyze).not.toHaveBeenCalled();
  });

  it('stays in the first step and explains the row limit', async () => {
    const { element, selectFile, click } = await setup({
      analyze: vi.fn(() =>
        throwError(() => new ApiError(400, 'IMPORT TOO MANY ROWS', 'in english')),
      ),
    });
    await selectFile(csv);

    await click('Continuar');

    expect(element.querySelector('.error')?.textContent).toContain('200 filas');
    expect(element.textContent).not.toContain('Revisión');
  });

  it('repeats the analysis when the columns change', async () => {
    const { selectFile, click, selectColumns, analyze } = await setup();
    await selectFile(csv);
    await click('Continuar');

    await selectColumns([2, 1]);

    expect(analyze).toHaveBeenCalledTimes(2);
    expect(analyze.mock.calls[1][0].isbnColumns).toEqual([2, 1]);
  });

  it('ignores an outdated analysis', async () => {
    const slow = new Subject<ImportAnalysis>();
    const fast = new Subject<ImportAnalysis>();
    const analyze = vi
      .fn()
      .mockReturnValueOnce(of(analysis))
      .mockReturnValueOnce(slow)
      .mockReturnValueOnce(fast);
    const { fixture, element, selectFile, click, selectColumns } = await setup({
      analyze,
    });
    await selectFile(csv);
    await click('Continuar');
    await selectColumns([0]);
    await selectColumns([2]);

    fast.next({ ...analysis, isbnColumns: [2], counts: { ...analysis.counts, rows: 22 } });
    slow.next({ ...analysis, isbnColumns: [0], counts: { ...analysis.counts, rows: 11 } });
    await fixture.whenStable();

    expect(element.textContent).toContain('22 filas leídas');
  });

  it('asks to choose a column when none has been detected, and does not allow importing', async () => {
    const { element, selectFile, click, button, create } = await setup({
      analyze: vi.fn(() =>
        of({
          ...analysis,
          isbnColumns: [],
          counts: { ...analysis.counts, valid: 0, alreadyInLibrary: 0 },
        }),
      ),
    });
    await selectFile(csv);
    await click('Continuar');

    expect(element.querySelector('.notice')?.textContent).toContain('columna de ISBN');
    expect(button('Importar')!.disabled).toBe(true);
    await click('Importar');
    expect(create).not.toHaveBeenCalled();
  });

  it('warns when no row has a valid ISBN', async () => {
    const { element, selectFile, click, button } = await setup({
      analyze: vi.fn(() =>
        of({ ...analysis, counts: { ...analysis.counts, valid: 0, alreadyInLibrary: 0 } }),
      ),
    });
    await selectFile(csv);
    await click('Continuar');

    expect(element.querySelector('.notice')?.textContent).toContain('ISBN válido');
    expect(button('Importar')!.disabled).toBe(true);
  });

  it('allows importing a file whose books are all in the library already', async () => {
    const { selectFile, click, button } = await setup({
      analyze: vi.fn(() =>
        of({ ...analysis, counts: { ...analysis.counts, valid: 0, alreadyInLibrary: 10 } }),
      ),
    });
    await selectFile(csv);
    await click('Continuar');

    expect(button('Importar')!.disabled).toBe(false);
  });

  it('imports with the chosen columns and moves to the page of the import', async () => {
    const { selectFile, click, create, close, navigate } = await setup();
    await selectFile(csv);
    await click('Continuar');

    await click('Importar');

    expect(create).toHaveBeenCalledExactlyOnceWith({
      file: csv,
      libraryId: 'l1',
      isbnColumns: [1],
    });
    expect(close).toHaveBeenCalledWith({ id: 'i1', libraryId: 'l9' });
    expect(navigate).toHaveBeenCalledWith(['/libraries', 'l9', 'imports', 'i1']);
  });

  it('stays open and explains why an import could not start', async () => {
    const { element, selectFile, click, button, close, navigate } = await setup({
      create: vi.fn(() =>
        throwError(() => new ApiError(409, 'IMPORT ALREADY ACTIVE', 'in english')),
      ),
    });
    await selectFile(csv);
    await click('Continuar');

    await click('Importar');

    expect(element.querySelector('.error')?.textContent).toContain('en curso');
    expect(button('Importar')!.disabled).toBe(false);
    expect(close).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('keeps the file when going back to the first step', async () => {
    const { selectFile, click, analyze } = await setup();
    await selectFile(csv);
    await click('Continuar');

    await click('Atrás');
    await click('Continuar');

    expect(analyze).toHaveBeenCalledTimes(2);
    expect(analyze.mock.calls[1][0].file).toBe(csv);
  });
});
