import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormGroupDirective,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleChange, MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { forkJoin } from 'rxjs';

import { ApiError } from '../../../core/http/api-error';
import { LibrariesService } from '../libraries.service';
import { Library } from '../library.model';
import { LibraryMember, MAX_LIBRARY_MEMBERS, inviteErrorMessage } from '../library-member.model';
import { LibraryMembersService } from '../library-members.service';

type LoadState = 'loading' | 'loaded' | 'error';

export type ShareLibraryDialogData = Pick<Library, 'id' | 'name'>;

export const SHARE_DIALOG_SIZE = { width: '520px', maxWidth: 'calc(100vw - 32px)' };

/**
 * Manages who can see a library of the user, whether they also see the ratings, and whether anyone
 * can see it. Every change is saved at once. It loads the library itself, so the settings are right
 * however it was opened.
 */
@Component({
  selector: 'app-share-library-dialog',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSlideToggleModule,
    MatTooltipModule,
  ],
  templateUrl: './share-library-dialog.html',
  styleUrl: './share-library-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShareLibraryDialog {
  private readonly librariesService = inject(LibrariesService);
  private readonly membersService = inject(LibraryMembersService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  protected readonly library = inject<ShareLibraryDialogData>(MAT_DIALOG_DATA);

  /**
   * The library once it is made public or private, so whoever opened the dialog can show it at
   * once: `dialogRef.componentInstance.visibilityChanged.subscribe(…)`.
   */
  readonly visibilityChanged = output<Library>();

  private readonly formDirective = viewChild(FormGroupDirective);
  private readonly emailInput = viewChild<ElementRef<HTMLInputElement>>('emailInput');

  protected readonly maxMembers = MAX_LIBRARY_MEMBERS;

  protected readonly state = signal<LoadState>('loading');
  protected readonly members = signal<LibraryMember[]>([]);
  protected readonly shareRatings = signal(false);
  protected readonly isPublic = signal(false);
  protected readonly limitReached = computed(() => this.members().length >= MAX_LIBRARY_MEMBERS);

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
  });
  protected readonly inviting = signal(false);
  protected readonly inviteError = signal<string | null>(null);

  protected readonly removingId = signal<string | null>(null);
  protected readonly savingRatings = signal(false);
  protected readonly savingVisibility = signal(false);
  /** A failed change of the list or of the setting, shown below them. */
  protected readonly changeError = signal<string | null>(null);
  /** The result of the last change of the setting, shown next to it: there is no button to save it. */
  protected readonly ratingsMessage = signal('');
  /** The same for the visibility. */
  protected readonly visibilityMessage = signal('');
  /** The result of the last change of the list, read by screen readers. */
  protected readonly statusMessage = signal('');

  constructor() {
    this.load();
  }

  protected load(): void {
    this.state.set('loading');
    forkJoin({
      library: this.librariesService.get(this.library.id),
      members: this.membersService.list(this.library.id, { skip: 0, limit: MAX_LIBRARY_MEMBERS }),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ library, members }) => {
          this.shareRatings.set(library.shareRatings);
          this.isPublic.set(library.isPublic);
          this.members.set(members.items);
          this.state.set('loaded');
        },
        error: () => this.state.set('error'),
      });
  }

  protected invite(): void {
    if (this.inviting() || this.limitReached()) {
      return;
    }
    this.clearMessages();
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.inviting.set(true);
    this.membersService
      .invite(this.library.id, this.form.controls.email.value.trim())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (member) => {
          this.inviting.set(false);
          this.members.update((members) => [member, ...members]);
          // Also clears the submitted state, so the empty field does not show an error
          this.formDirective()?.resetForm();
          this.statusMessage.set(`${member.name} ya puede ver la biblioteca.`);
          this.focusEmail();
        },
        error: (error: unknown) => {
          this.inviting.set(false);
          this.inviteError.set(inviteErrorMessage(error));
        },
      });
  }

  protected remove(member: LibraryMember): void {
    if (this.removingId()) {
      return;
    }
    this.removingId.set(member.id);
    this.clearMessages();
    this.membersService
      .remove(this.library.id, member.userId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.onRemoved(member),
        error: (error: unknown) => {
          // They may have left in the meantime: the result is the same
          if (error instanceof ApiError && error.message === 'member not found') {
            this.onRemoved(member);
            return;
          }
          this.removingId.set(null);
          this.changeError.set('No se ha podido retirar el acceso. Inténtalo de nuevo.');
        },
      });
  }

  protected changeShareRatings({ checked, source }: MatSlideToggleChange): void {
    this.savingRatings.set(true);
    this.clearMessages();
    this.librariesService
      .update(this.library.id, { shareRatings: checked })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (library) => {
          this.savingRatings.set(false);
          this.shareRatings.set(library.shareRatings);
          this.ratingsMessage.set(
            library.shareRatings
              ? 'Guardado: tus valoraciones se muestran.'
              : 'Guardado: tus valoraciones ya no se muestran.',
          );
        },
        error: () => {
          this.savingRatings.set(false);
          // The toggle has already moved by itself, and its binding has not changed
          source.checked = this.shareRatings();
          this.changeError.set('No se ha podido guardar el cambio. Inténtalo de nuevo.');
        },
      });
  }

  protected changeVisibility({ checked, source }: MatSlideToggleChange): void {
    this.savingVisibility.set(true);
    this.clearMessages();
    this.librariesService
      .update(this.library.id, { isPublic: checked })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (library) => {
          this.savingVisibility.set(false);
          this.isPublic.set(library.isPublic);
          this.visibilityMessage.set(
            library.isPublic
              ? 'Guardado: la biblioteca es pública.'
              : 'Guardado: la biblioteca ya no es pública.',
          );
          this.visibilityChanged.emit(library);
        },
        error: () => {
          this.savingVisibility.set(false);
          // The toggle has already moved by itself, and its binding has not changed
          source.checked = this.isPublic();
          this.changeError.set('No se ha podido guardar el cambio. Inténtalo de nuevo.');
        },
      });
  }

  private onRemoved(member: LibraryMember): void {
    this.removingId.set(null);
    this.members.update((members) => members.filter((item) => item.id !== member.id));
    this.statusMessage.set(`${member.name} ya no puede ver la biblioteca.`);
    // The row is gone with its button: keep the keyboard focus in the dialog
    this.focusEmail();
  }

  private clearMessages(): void {
    this.inviteError.set(null);
    this.changeError.set(null);
    this.ratingsMessage.set('');
    this.visibilityMessage.set('');
    this.statusMessage.set('');
  }

  private focusEmail(): void {
    // Once the field is enabled again
    afterNextRender(() => this.emailInput()?.nativeElement.focus(), { injector: this.injector });
  }
}
