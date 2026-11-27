import { ChangeDetectionStrategy, Component, input, linkedSignal } from '@angular/core';

/**
 * The cover of a book, or a tonal placeholder with its title when there is none or it fails to
 * load. It fills the width of its container with a 2:3 ratio.
 */
@Component({
  selector: 'app-shelf-cover',
  template: `
    @if (url() && !failed()) {
      <!-- Empty alt: the cover is decorative because the title is right below it -->
      <img [src]="url()" alt="" loading="lazy" (error)="failed.set(true)" />
    } @else {
      <span class="placeholder" aria-hidden="true">
        <span class="placeholder-title">{{ title() }}</span>
      </span>
    }
  `,
  styles: `
    :host {
      display: block;
      aspect-ratio: 2 / 3;
      overflow: hidden;
      border-radius: 10px;
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
    }

    img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    // Like a plain cloth cover: a darker spine on the left and the title in the brand serif
    .placeholder {
      display: flex;
      box-sizing: border-box;
      align-items: center;
      justify-content: center;
      height: 100%;
      padding: 12px 10px 12px 16px;
      background-image: linear-gradient(
        to right,
        color-mix(in srgb, var(--mat-sys-on-primary-container) 12%, transparent) 0 6px,
        transparent 6px
      );
    }

    .placeholder-title {
      display: -webkit-box;
      overflow: hidden;
      font: 500 0.9375rem / 1.3 var(--app-font-display);
      text-align: center;
      overflow-wrap: anywhere;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 5;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShelfCover {
  readonly url = input.required<string | null>();
  readonly title = input.required<string>();

  /** Covers come from external services, so a URL may stop working: show the placeholder then. */
  protected readonly failed = linkedSignal({ source: this.url, computation: () => false });
}
