import { TestBed } from '@angular/core/testing';

import {
  ReadingStatusFilter,
  ReadingStatusFilterChange,
  toReadYear,
  toStatusQuery,
} from './reading-status-filter';

describe('ReadingStatusFilter', () => {
  async function setup(inputs: { status?: string; year?: number | null } = {}) {
    const fixture = TestBed.createComponent(ReadingStatusFilter);
    fixture.componentRef.setInput('currentYear', 2026);
    if (inputs.status !== undefined) fixture.componentRef.setInput('status', inputs.status);
    if (inputs.year !== undefined) fixture.componentRef.setInput('year', inputs.year);
    const changes: ReadingStatusFilterChange[] = [];
    fixture.componentInstance.changed.subscribe((change) => changes.push(change));
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    /** Opens a select and returns its options, which live in an overlay. */
    const open = async (selector: string) => {
      element.querySelector<HTMLElement>(`${selector} .mat-mdc-select-trigger`)!.click();
      await fixture.whenStable();
      return Array.from(document.querySelectorAll<HTMLElement>('mat-option'));
    };
    const text = (option: HTMLElement) =>
      option.textContent?.replace(option.querySelector('mat-icon')?.textContent ?? '', '').trim();
    return { fixture, element, changes, open, text };
  }

  it('offers every status and «Sin estado» in one select', async () => {
    const { open, text } = await setup();

    const options = await open('.status-select');

    expect(options.map(text)).toEqual([
      'Todos los estados',
      'Pendiente',
      'Leyendo',
      'Leído',
      'Sin estado',
    ]);
  });

  it('shows the chosen status, highlighted, or the placeholder without it', async () => {
    const chosen = await setup({ status: 'reading' });
    expect(chosen.element.querySelector('.status-select')?.textContent?.trim()).toBe('Leyendo');
    expect(chosen.element.querySelector('.status-filter')?.classList).toContain('active');
    TestBed.resetTestingModule();

    const none = await setup();
    expect(none.element.querySelector('.status-select')?.textContent?.trim()).toBe('Estado');
    expect(none.element.querySelector('.status-filter')?.classList).not.toContain('active');
  });

  it('asks for the chosen status', async () => {
    const { changes, open, fixture } = await setup();

    (await open('.status-select'))[4].click();
    await fixture.whenStable();

    expect(changes).toEqual([{ status: 'none', year: null }]);
  });

  it('asks for every status again, dropping the year', async () => {
    const { changes, open, fixture } = await setup({ status: 'read', year: 2025 });

    (await open('.status-select'))[0].click();
    await fixture.whenStable();

    expect(changes).toEqual([{ status: '', year: null }]);
  });

  it('only offers the year for the read books', async () => {
    const reading = await setup({ status: 'reading' });
    expect(reading.element.querySelector('.year-select')).toBeNull();
    TestBed.resetTestingModule();

    const read = await setup({ status: 'read' });
    expect(read.element.querySelector('.year-select')?.textContent).toContain('Todos los años');
  });

  it('offers the years from the current one back to 2000, and asks for the chosen one', async () => {
    const { changes, open, fixture } = await setup({ status: 'read' });

    const options = await open('.year-select');
    expect(options[0].textContent?.trim()).toBe('Todos los años');
    expect(options[1].textContent?.trim()).toBe('2026');
    expect(options.at(-1)?.textContent?.trim()).toBe('2000');
    expect(options).toHaveLength(28);

    options[2].click();
    await fixture.whenStable();
    expect(changes).toEqual([{ status: 'read', year: 2025 }]);
  });

  it('also offers an older year when it comes from the URL', async () => {
    const { element, open } = await setup({ status: 'read', year: 1998 });

    expect(element.querySelector('.year-select')?.textContent).toContain('1998');
    const options = await open('.year-select');
    expect(options.at(-1)?.textContent?.trim()).toBe('1998');
  });

  it('reads the status and the year of the URL, ignoring invalid values', () => {
    expect(toStatusQuery('read')).toBe('read');
    expect(toStatusQuery('none')).toBe('none');
    expect(toStatusQuery('abandoned')).toBe('');
    expect(toStatusQuery(null)).toBe('');
    expect(toReadYear('2026')).toBe(2026);
    expect(toReadYear('26')).toBeNull();
    expect(toReadYear('2026-01')).toBeNull();
    expect(toReadYear(undefined)).toBeNull();
  });
});
