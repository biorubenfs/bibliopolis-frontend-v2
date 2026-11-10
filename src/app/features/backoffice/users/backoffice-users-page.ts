import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorIntl, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';

import { SpanishPaginatorIntl } from '../../../core/i18n/paginator-intl';
import { SearchableList } from '../../../core/lists/searchable-list';
import { CreateUserDialog } from './create-user-dialog/create-user-dialog';
import {
  GeneratedPasswordDialog,
  GeneratedPasswordDialogData,
} from './generated-password-dialog/generated-password-dialog';
import { ManagedUser, ManagedUsersService, UserWithPassword } from './managed-users.service';
import {
  ResetPasswordDialog,
  ResetPasswordDialogData,
} from './reset-password-dialog/reset-password-dialog';

const DIALOG_SIZE = { width: '480px', maxWidth: 'calc(100vw - 32px)' };

/** Lists the users, creates regular users, resets their passwords and links to their figures. */
@Component({
  selector: 'app-backoffice-users-page',
  imports: [
    DatePipe,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    RouterLink,
  ],
  templateUrl: './backoffice-users-page.html',
  styleUrls: ['../shared/backoffice-page.scss', './backoffice-users-page.scss'],
  providers: [{ provide: MatPaginatorIntl, useClass: SpanishPaginatorIntl }],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BackofficeUsersPage extends SearchableList<ManagedUser> {
  private readonly users = inject(ManagedUsersService);
  private readonly dialog = inject(MatDialog);

  protected fetch(options: { skip: number; limit: number; search: string }) {
    return this.users.list(options);
  }

  protected openCreateDialog(): void {
    this.dialog
      .open<CreateUserDialog, void, UserWithPassword>(CreateUserDialog, DIALOG_SIZE)
      .afterClosed()
      .subscribe((result) => {
        if (result) {
          this.showPassword('Usuario creado', result);
          this.load({ quiet: true });
        }
      });
  }

  protected openResetDialog(user: ManagedUser): void {
    this.dialog
      .open<ResetPasswordDialog, ResetPasswordDialogData, UserWithPassword>(ResetPasswordDialog, {
        ...DIALOG_SIZE,
        data: { user },
      })
      .afterClosed()
      .subscribe((result) => {
        if (result) {
          this.showPassword('Contraseña restablecida', result);
        }
      });
  }

  private showPassword(title: string, { user, password }: UserWithPassword): void {
    this.dialog.open<GeneratedPasswordDialog, GeneratedPasswordDialogData>(
      GeneratedPasswordDialog,
      {
        ...DIALOG_SIZE,
        // The password cannot be seen again: closing only with the button avoids losing it by accident
        disableClose: true,
        data: { title, userName: user.name, email: user.email, password },
      },
    );
  }
}
