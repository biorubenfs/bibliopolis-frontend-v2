import { Subject, of, throwError } from 'rxjs';

import { ApiError } from '../../../core/http/api-error';
import { ExternalBook } from '../../books/external-book.model';
import { ScanQueue, ScanQueueBackend } from './scan-queue';

const ISBN_A = '9780595385294';
const ISBN_B = '9788483835043';

function externalBook(isbn13: string, title = `Libro ${isbn13}`): ExternalBook {
  return {
    title,
    isbn13,
    isbn10: null,
    authors: ['Autora'],
    cover: { source: 'open_library', value: '1' },
    coverUrl: null,
  };
}

const httpError = (statusCode: number) => () =>
  throwError(() => new ApiError(statusCode, null, 'error'));

describe('ScanQueue', () => {
  function setup(
    options: { findByIsbn?: ReturnType<typeof vi.fn>; addBook?: ReturnType<typeof vi.fn> } = {},
  ) {
    const findByIsbn = options.findByIsbn ?? vi.fn((isbn: string) => of(externalBook(isbn)));
    const addBook = options.addBook ?? vi.fn(() => of({}));
    return {
      findByIsbn,
      addBook,
      queue: new ScanQueue('l1', { findByIsbn, addBook } as unknown as ScanQueueBackend),
    };
  }

  it('shows the book found and does not add it until it is confirmed', () => {
    const { queue, addBook } = setup();

    queue.enqueue(ISBN_A);

    expect(queue.current()).toEqual({
      status: 'review',
      isbn: ISBN_A,
      book: externalBook(ISBN_A),
    });
    expect(addBook).not.toHaveBeenCalled();
  });

  it('adds the confirmed book', () => {
    const { queue, addBook } = setup();

    queue.enqueue(ISBN_A);
    queue.confirm();

    expect(addBook).toHaveBeenCalledExactlyOnceWith('l1', {
      title: `Libro ${ISBN_A}`,
      isbn13: ISBN_A,
      isbn10: null,
      authors: ['Autora'],
      cover: { source: 'open_library', value: '1' },
    });
    expect(queue.added()).toEqual([`Libro ${ISBN_A}`]);
    expect(queue.current()).toBeNull();
    expect(queue.notice()).toContain('añadido');
  });

  it('does not add a discarded book', () => {
    const { queue, addBook } = setup();

    queue.enqueue(ISBN_A);
    queue.discard();

    expect(addBook).not.toHaveBeenCalled();
    expect(queue.added()).toEqual([]);
    expect(queue.current()).toBeNull();
    expect(queue.notice()).toContain('descartado');
  });

  it('keeps later scans waiting until the user decides on the current book', () => {
    const { queue, findByIsbn } = setup();

    queue.enqueue(ISBN_A);
    queue.enqueue(ISBN_B);

    expect(findByIsbn).toHaveBeenCalledTimes(1);
    expect(queue.waitingCount()).toBe(1);
    expect(queue.undecidedCount()).toBe(2);

    queue.discard();

    expect(findByIsbn).toHaveBeenLastCalledWith(ISBN_B);
    expect(queue.current()?.isbn).toBe(ISBN_B);
    expect(queue.waitingCount()).toBe(0);
    expect(queue.undecidedCount()).toBe(1);
  });

  it('ignores a second confirmation while the book is being added', () => {
    const addResult = new Subject<void>();
    const { queue, addBook } = setup({ addBook: vi.fn(() => addResult) });

    queue.enqueue(ISBN_A);
    queue.confirm();
    queue.confirm();
    queue.discard();

    expect(addBook).toHaveBeenCalledTimes(1);
    expect(queue.current()?.status).toBe('adding');

    addResult.next();
    expect(queue.added()).toEqual([`Libro ${ISBN_A}`]);
  });

  it('does not count a book the library already has, and carries on', () => {
    const { queue } = setup({ addBook: vi.fn(httpError(409)) });

    queue.enqueue(ISBN_A);
    queue.enqueue(ISBN_B);
    queue.confirm();

    expect(queue.notice()).toContain('ya está en esta biblioteca');
    expect(queue.added()).toEqual([]);
    expect(queue.pending()).toEqual([]);
    expect(queue.current()?.isbn).toBe(ISBN_B);
  });

  it('leaves a book nobody knows as pending, and carries on', () => {
    const findByIsbn = vi.fn((isbn: string) =>
      isbn === ISBN_A ? httpError(404)() : of(externalBook(isbn)),
    );
    const { queue } = setup({ findByIsbn });

    queue.enqueue(ISBN_A);
    queue.enqueue(ISBN_B);

    expect(queue.pending()).toEqual([{ isbn: ISBN_A, reason: 'not-found' }]);
    expect(queue.current()?.isbn).toBe(ISBN_B);
  });

  it.each([
    ['the search', { findByIsbn: vi.fn(httpError(500)) }, false],
    ['adding the book', { addBook: vi.fn(httpError(503)) }, true],
  ])('leaves the book as pending when %s fails', (_case, backend, confirm) => {
    const { queue } = setup(backend);

    queue.enqueue(ISBN_A);
    if (confirm) {
      queue.confirm();
    }

    expect(queue.pending()).toEqual([{ isbn: ISBN_A, reason: 'error' }]);
    expect(queue.current()).toBeNull();
  });

  it('retries a pending book', () => {
    const findByIsbn = vi
      .fn()
      .mockImplementationOnce(httpError(500))
      .mockImplementationOnce((isbn: string) => of(externalBook(isbn)));
    const { queue } = setup({ findByIsbn });

    queue.enqueue(ISBN_A);
    queue.retry(ISBN_A);

    expect(queue.pending()).toEqual([]);
    expect(queue.current()?.status).toBe('review');
  });

  it('resolves a pending book that the user adds by hand', () => {
    const { queue } = setup({ findByIsbn: vi.fn(httpError(404)) });

    queue.enqueue(ISBN_A);
    queue.addedManually('Escrito a mano', ISBN_A);

    expect(queue.pending()).toEqual([]);
    expect(queue.added()).toEqual(['Escrito a mano']);
  });

  it('stops processing when destroyed', () => {
    const search = new Subject<ExternalBook>();
    const { queue } = setup({ findByIsbn: vi.fn(() => search) });

    queue.enqueue(ISBN_A);
    queue.destroy();

    expect(search.observed).toBe(false);
  });
});
