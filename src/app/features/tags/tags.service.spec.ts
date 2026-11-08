import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { ApiError } from '../../core/http/api-error';
import { TagsService, tagErrorMessage } from './tags.service';

describe('TagsService', () => {
  let service: TagsService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(TagsService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('lists all the tags in one page, as flat models sorted by name', () => {
    let result: unknown;
    service.listAll().subscribe((tags) => (result = tags.map((tag) => tag.name)));

    const req = backend.expectOne((r) => r.url === `${environment.apiUrl}/tags`);
    expect(req.request.params.get('limit')).toBe('100');
    req.flush({
      results: [
        { type: 'tags', id: 't1', attributes: { name: 'Prestados', color: 'blue', userId: 'u1' } },
        { type: 'tags', id: 't2', attributes: { name: 'Ética', color: 'red', userId: null } },
      ],
      paginationInfo: { skip: 0, limit: 100, total: 2 },
    });

    expect(result).toEqual(['Ética', 'Prestados']);
  });

  it('creates, updates and deletes tags', () => {
    service.create({ name: 'Novela', color: 'green' }).subscribe();
    service.update('t1', { color: 'red' }).subscribe();
    service.delete('t1').subscribe();

    const create = backend.expectOne({ method: 'POST', url: `${environment.apiUrl}/tags` });
    expect(create.request.body).toEqual({ name: 'Novela', color: 'green' });
    create.flush({ results: { type: 'tags', id: 't1', attributes: {} } });
    const update = backend.expectOne({ method: 'PATCH', url: `${environment.apiUrl}/tags/t1` });
    expect(update.request.body).toEqual({ color: 'red' });
    update.flush({ results: { type: 'tags', id: 't1', attributes: {} } });
    backend.expectOne({ method: 'DELETE', url: `${environment.apiUrl}/tags/t1` }).flush(null);
  });

  it('explains why a tag could not be saved', () => {
    expect(tagErrorMessage(new ApiError(409, 'TAG LIMIT REACHED', ''))).toContain('máximo');
    expect(tagErrorMessage(new ApiError(409, 'CONFLICT ERROR', ''))).toBe(
      'Ya existe una etiqueta con ese nombre.',
    );
    expect(tagErrorMessage(new Error('down'))).toContain('Inténtalo de nuevo');
  });
});
