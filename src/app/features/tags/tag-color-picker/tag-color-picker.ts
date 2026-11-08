import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

import { TAG_COLORS, TAG_COLOR_STYLES, TagColor } from '../tag.model';

let nextId = 0;

/**
 * Picks a colour of the palette. Native radio buttons keep the keyboard behaviour (arrows move
 * between colours) and announce the name of each colour.
 */
@Component({
  selector: 'app-tag-color-picker',
  template: `
    <fieldset>
      <legend>{{ label() }}</legend>
      <div class="swatches">
        @for (color of colors; track color) {
          <label class="swatch" [title]="styles[color].label">
            <input
              type="radio"
              [name]="name"
              [value]="color"
              [checked]="value() === color"
              [disabled]="disabled()"
              (change)="value.set(color)"
            />
            <span
              class="dot"
              aria-hidden="true"
              [style.background-color]="styles[color].background"
              [style.border-color]="styles[color].text"
            ></span>
            <span class="visually-hidden">{{ styles[color].label }}</span>
          </label>
        }
      </div>
    </fieldset>
  `,
  styles: `
    fieldset {
      margin: 0;
      padding: 0;
      border: 0;
    }

    legend {
      margin-bottom: 8px;
      padding: 0;
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }

    .swatches {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }

    // 32px targets: above the 24px minimum of WCAG AA
    .swatch {
      position: relative;
      display: grid;
      place-items: center;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      cursor: pointer;
    }

    input {
      position: absolute;
      inset: 0;
      margin: 0;
      opacity: 0;
      cursor: pointer;
    }

    .dot {
      width: 20px;
      height: 20px;
      box-sizing: border-box;
      border: 2px solid;
      border-radius: 50%;
    }

    input:checked + .dot {
      outline: 2px solid var(--mat-sys-on-surface);
      outline-offset: 2px;
    }

    input:focus-visible + .dot {
      outline: 3px solid var(--mat-sys-primary);
      outline-offset: 2px;
    }

    .visually-hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TagColorPicker {
  readonly value = model.required<TagColor>();
  readonly label = input('Color');
  readonly disabled = input(false);

  protected readonly colors = TAG_COLORS;
  protected readonly styles = TAG_COLOR_STYLES;
  /** Groups the radio buttons of this picker only. */
  protected readonly name = `tag-color-${nextId++}`;
}
