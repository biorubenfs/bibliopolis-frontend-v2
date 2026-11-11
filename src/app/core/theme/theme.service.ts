import { computed, DOCUMENT, effect, inject, Injectable, signal } from '@angular/core';

export type Theme = 'light' | 'dark';

/** Also read by the inline script of index.html, which applies the choice before the app boots. */
export const THEME_STORAGE_KEY = 'bibliopolis.theme';

const DARK_SCHEME_QUERY = '(prefers-color-scheme: dark)';

function readStoredTheme(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

/**
 * Light or dark colour scheme. The stylesheet declares `color-scheme: light dark`, so without a
 * choice the app follows the system; a choice pins the scheme on the root element and is kept in
 * local storage.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);

  /** The user's explicit choice, or null to follow the system. */
  private readonly preference = signal<Theme | null>(readStoredTheme());
  private readonly systemDark = signal(false);

  /** The scheme in use. */
  readonly theme = computed<Theme>(
    () => this.preference() ?? (this.systemDark() ? 'dark' : 'light'),
  );

  constructor() {
    // Not available in every environment (jsdom, for instance)
    const query = this.document.defaultView?.matchMedia?.(DARK_SCHEME_QUERY);
    if (query) {
      this.systemDark.set(query.matches);
      query.addEventListener('change', (event) => this.systemDark.set(event.matches));
    }

    effect(() => {
      this.document.documentElement.style.colorScheme = this.preference() ?? '';
    });
  }

  toggle(): void {
    const next: Theme = this.theme() === 'dark' ? 'light' : 'dark';
    this.preference.set(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Without storage the choice only lasts for the session
    }
  }
}
