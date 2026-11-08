import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { TAG_COLOR_STYLES, Tag } from '../tag.model';

/** A tag shown as a coloured badge with its full name. */
@Component({
  selector: 'app-tag-badge',
  template: `{{ tag().name }}`,
  host: {
    class: 'tag-badge',
    '[style.background-color]': 'style().background',
    '[style.color]': 'style().text',
  },
  styles: `
    :host {
      display: inline-block;
      max-width: 100%;
      box-sizing: border-box;
      padding: 2px 10px;
      border-radius: 999px;
      font: var(--mat-sys-label-medium);
      // Long names wrap instead of being cut, so the whole name is always visible
      overflow-wrap: anywhere;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TagBadge {
  readonly tag = input.required<Tag>();

  protected readonly style = computed(() => TAG_COLOR_STYLES[this.tag().color]);
}
