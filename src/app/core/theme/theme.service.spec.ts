import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { THEME_STORAGE_KEY, ThemeService } from './theme.service';

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.removeItem(THEME_STORAGE_KEY);
    document.documentElement.style.colorScheme = '';
  });

  it('follows the system and leaves the root colour scheme alone without a choice', async () => {
    const service = TestBed.inject(ThemeService);
    await TestBed.inject(ApplicationRef).whenStable();

    expect(service.theme()).toBe('light');
    expect(document.documentElement.style.colorScheme).toBe('');
  });

  it('toggles to dark, pins it on the root element and remembers it', async () => {
    const service = TestBed.inject(ThemeService);

    service.toggle();
    await TestBed.inject(ApplicationRef).whenStable();

    expect(service.theme()).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('starts from the stored choice', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');

    const service = TestBed.inject(ThemeService);

    expect(service.theme()).toBe('dark');
    service.toggle();
    expect(service.theme()).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });
});
