import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonToggleChange, MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import { BooksView, BooksViewPreference } from '../books-view';

/** Switches the lists of books between cards and a table, and remembers the choice. */
@Component({
  selector: 'app-books-view-toggle',
  imports: [MatButtonToggleModule, MatIconModule, MatTooltipModule],
  template: `
    <mat-button-toggle-group
      hideSingleSelectionIndicator
      aria-label="Vista de los libros"
      [value]="preference.view()"
      (change)="change($event)"
    >
      <mat-button-toggle value="grid" aria-label="Ver como tarjetas" matTooltip="Tarjetas">
        <mat-icon>grid_view</mat-icon>
      </mat-button-toggle>
      <mat-button-toggle value="table" aria-label="Ver como tabla" matTooltip="Tabla">
        <mat-icon>table_rows</mat-icon>
      </mat-button-toggle>
    </mat-button-toggle-group>
  `,
  styles: `
    :host {
      display: inline-flex;
      flex: none;
    }

    mat-button-toggle-group {
      --mat-button-toggle-shape: 12px;
      /* As tall as the buttons it may sit next to, such as «Añadir libro» */
      --mat-button-toggle-height: 40px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BooksViewToggle {
  protected readonly preference = inject(BooksViewPreference);

  protected change(event: MatButtonToggleChange): void {
    this.preference.set(event.value as BooksView);
  }
}
