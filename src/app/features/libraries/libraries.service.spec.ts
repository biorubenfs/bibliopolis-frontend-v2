import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { LibrariesService } from './libraries.service';
import { Library } from './library.model';

describe('LibrariesService', () => {
  let service: LibrariesService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(LibrariesService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('lists libraries as flat models with pagination', () => {
    let result: unknown;
    service.list({ skip: 12, limit: 12 }).subscribe((page) => (result = page));

    const req = backend.expectOne((r) => r.url === `${environment.apiUrl}/libraries`);
    expect(req.request.params.get('skip')).toBe('12');
    expect(req.request.params.get('limit')).toBe('12');
    req.flush({
      results: [
        {
          type: 'libraries',
          id: 'lib-1',
          attributes: { name: 'Novela', description: 'Mis novelas', books: ['b1'] },
        },
      ],
      paginationInfo: { skip: 12, limit: 12, total: 13 },
    });

    expect(result).toEqual({
      items: [{ id: 'lib-1', name: 'Novela', description: 'Mis novelas', books: ['b1'] }],
      total: 13,
    });
  });

  it('sends the trimmed search term', () => {
    service.list({ skip: 0, limit: 12, search: '  novela ' }).subscribe();

    const req = backend.expectOne((r) => r.url === `${environment.apiUrl}/libraries`);
    expect(req.request.params.get('search')).toBe('novela');
    req.flush({ results: [], paginationInfo: { skip: 0, limit: 12, total: 0 } });
  });

  it('omits a blank search term', () => {
    service.list({ skip: 0, limit: 12, search: '   ' }).subscribe();

    const req = backend.expectOne((r) => r.url === `${environment.apiUrl}/libraries`);
    expect(req.request.params.has('search')).toBe(false);
    req.flush({ results: [], paginationInfo: { skip: 0, limit: 12, total: 0 } });
  });

  it('gets a library as a flat model', () => {
    let result: unknown;
    service.get('lib-1').subscribe((library) => (result = library));

    backend
      .expectOne(`${environment.apiUrl}/libraries/lib-1`)
      .flush({ results: { type: 'libraries', id: 'lib-1', attributes: { name: 'Novela' } } });

    expect(result).toEqual({ id: 'lib-1', name: 'Novela' });
  });

  it('updates a library with PATCH', () => {
    service.update('lib-1', { name: 'Nuevo' }).subscribe();
    const req = backend.expectOne(`${environment.apiUrl}/libraries/lib-1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ name: 'Nuevo' });
    req.flush({ results: { type: 'libraries', id: 'lib-1', attributes: { name: 'Nuevo' } } });
  });

  it('deletes a library', () => {
    service.delete('lib-1').subscribe();
    const req = backend.expectOne(`${environment.apiUrl}/libraries/lib-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('exports a library and names the file like the backend does', () => {
    let filename = '';
    const library = { id: 'lib-1', name: 'Novela negra!' } as Library;
    service.export(library, 'csv').subscribe((file) => (filename = file.filename));

    const req = backend.expectOne((r) => r.url === `${environment.apiUrl}/user-books/download`);
    expect(req.request.params.get('libraryId')).toBe('lib-1');
    expect(req.request.params.get('format')).toBe('csv');
    req.flush(new Blob(['a,b']));

    expect(filename).toBe('Novela_negra_.csv');
  });
});
