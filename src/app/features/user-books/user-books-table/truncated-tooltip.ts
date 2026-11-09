import { Directive, ElementRef, inject } from '@angular/core';
import { MatTooltip } from '@angular/material/tooltip';

/**
 * Goes with `matTooltip` on an element cut with an ellipsis: the tooltip only appears when the text
 * does not fit, so short texts, shown in full, do not repeat themselves.
 */
@Directive({
  selector: '[appTruncatedTooltip]',
  host: {
    // Registered before the tooltip's own listeners, so it is enabled or disabled before it shows
    '(mouseenter)': 'update()',
    '(focus)': 'update()',
  },
})
export class TruncatedTooltip {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly tooltip = inject(MatTooltip);

  protected update(): void {
    const { scrollWidth, clientWidth } = this.element.nativeElement;
    this.tooltip.disabled = scrollWidth <= clientWidth;
  }
}
