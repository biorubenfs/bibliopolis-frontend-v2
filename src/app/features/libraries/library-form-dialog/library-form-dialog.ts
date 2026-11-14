import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  MatAutocompleteModule,
  MatAutocompleteSelectedEvent,
} from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Observable } from 'rxjs';

import { ApiError } from '../../../core/http/api-error';
import { TagBadge } from '../../tags/tag-badge/tag-badge';
import {
  MAX_TAGS_PER_LIBRARY,
  TAG_COLOR_STYLES,
  TAG_NAME_MAX_LENGTH,
  TAG_NAME_MIN_LENGTH,
  Tag,
  leastUsedColor,
  normalizeTagName,
  sortTags,
} from '../../tags/tag.model';
import { TagsService, tagErrorMessage } from '../../tags/tags.service';
import { LibrariesService } from '../libraries.service';
import {
  LIBRARY_DESCRIPTION_MAX_LENGTH,
  LIBRARY_NAME_MAX_LENGTH,
  LIBRARY_NAME_MIN_LENGTH,
  Library,
} from '../library.model';

export interface LibraryFormDialogData {
  /** Library to edit; when absent the dialog creates a new one. */
  library?: Library;
}

/** Creates or edits a library. Closes with the saved library, or with nothing when cancelled. */
@Component({
  selector: 'app-library-form-dialog',
  imports: [
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatChipsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    TagBadge,
  ],
  templateUrl: './library-form-dialog.html',
  styleUrl: './library-form-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LibraryFormDialog {
  private readonly libraries = inject(LibrariesService);
  private readonly tagsService = inject(TagsService);
  private readonly dialogRef = inject<MatDialogRef<LibraryFormDialog, Library>>(MatDialogRef);
  private readonly library = inject<LibraryFormDialogData | null>(MAT_DIALOG_DATA, {
    optional: true,
  })?.library;

  protected readonly isEdit = this.library !== undefined;
  protected readonly nameMinLength = LIBRARY_NAME_MIN_LENGTH;
  protected readonly nameMaxLength = LIBRARY_NAME_MAX_LENGTH;
  protected readonly descriptionMaxLength = LIBRARY_DESCRIPTION_MAX_LENGTH;

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: [
      this.library?.name ?? '',
      [
        Validators.required,
        Validators.minLength(LIBRARY_NAME_MIN_LENGTH),
        Validators.maxLength(LIBRARY_NAME_MAX_LENGTH),
      ],
    ],
    description: [
      this.library?.description ?? '',
      [Validators.maxLength(LIBRARY_DESCRIPTION_MAX_LENGTH)],
    ],
  });

  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  /** Value of the autocomplete option that creates a tag with the text typed. */
  protected readonly createOption = '__create__';
  protected readonly maxTags = MAX_TAGS_PER_LIBRARY;
  protected readonly tagNameMaxLength = TAG_NAME_MAX_LENGTH;
  protected readonly tagStyles = TAG_COLOR_STYLES;
  private readonly tagInput = viewChild<ElementRef<HTMLInputElement>>('tagInput');

  /** Tags the user can use, own and global. */
  protected readonly tags = signal<Tag[]>([]);
  protected readonly tagsError = signal(false);
  /** Until the tags arrive the selection is unknown, so saving must not touch the tags. */
  private readonly tagsLoaded = signal(false);
  protected readonly selectedTagIds = signal<string[]>(this.library?.tagIds ?? []);
  /** Selected tags in name order; IDs of tags that no longer exist are not shown. */
  protected readonly selectedTags = computed(() =>
    this.tags().filter((tag) => this.selectedTagIds().includes(tag.id)),
  );
  protected readonly tagsFull = computed(() => this.selectedTags().length >= MAX_TAGS_PER_LIBRARY);
  /** Text typed in the tags field. */
  protected readonly tagQuery = signal('');
  protected readonly suggestions = computed(() => {
    const query = normalizeTagName(this.tagQuery());
    return this.tags().filter(
      (tag) =>
        !this.selectedTagIds().includes(tag.id) && normalizeTagName(tag.name).includes(query),
    );
  });
  /** The text typed is a valid name that no tag has yet, own or global. */
  protected readonly canCreateTag = computed(() => {
    const name = normalizeTagName(this.tagQuery());
    return (
      name.length >= TAG_NAME_MIN_LENGTH &&
      name.length <= TAG_NAME_MAX_LENGTH &&
      !this.tags().some((tag) => normalizeTagName(tag.name) === name)
    );
  });
  protected readonly trimmedQuery = computed(() => this.tagQuery().trim().replace(/\s+/g, ' '));
  protected readonly creatingTag = signal(false);
  protected readonly tagError = signal<string | null>(null);

  constructor() {
    this.tagsService.listAll().subscribe({
      next: (tags) => {
        this.tags.set(tags);
        this.tagsLoaded.set(true);
      },
      error: () => this.tagsError.set(true),
    });
  }

  protected onTagInput(event: Event): void {
    this.tagQuery.set((event.target as HTMLInputElement).value);
    this.tagError.set(null);
  }

  protected onTagSelected(event: MatAutocompleteSelectedEvent): void {
    const value: string = event.option.value;
    if (value === this.createOption) {
      this.createTag();
    } else {
      this.addTag(value);
    }
  }

  protected removeTag(id: string): void {
    this.selectedTagIds.update((ids) => ids.filter((item) => item !== id));
    this.tagInput()?.nativeElement.focus();
  }

  private addTag(id: string): void {
    if (!this.tagsFull() && !this.selectedTagIds().includes(id)) {
      this.selectedTagIds.update((ids) => [...ids, id]);
    }
    this.clearTagInput();
  }

  /** Creates the tag right away, with the colour used least, and selects it. */
  private createTag(): void {
    if (!this.canCreateTag() || this.creatingTag()) {
      return;
    }
    this.creatingTag.set(true);
    this.tagError.set(null);
    this.tagsService
      .create({ name: this.trimmedQuery(), color: leastUsedColor(this.tags()) })
      .subscribe({
        next: (tag) => {
          this.creatingTag.set(false);
          this.tags.update((tags) => sortTags([...tags, tag]));
          this.addTag(tag.id);
          this.tagInput()?.nativeElement.focus();
        },
        error: (error: unknown) => {
          this.creatingTag.set(false);
          this.tagError.set(tagErrorMessage(error));
        },
      });
  }

  private clearTagInput(): void {
    const input = this.tagInput()?.nativeElement;
    if (input) {
      input.value = '';
    }
    this.tagQuery.set('');
  }

  protected submit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);
    const values = {
      name: this.form.controls.name.value.trim(),
      // Optional: an empty description is sent as null
      description: this.form.controls.description.value.trim() || null,
      // Only the tags shown: a tag deleted meanwhile is dropped instead of failing. Without the
      // tags loaded the field is left out, so an edit keeps the current ones.
      ...(this.tagsLoaded() ? { tagIds: this.selectedTags().map((tag) => tag.id) } : {}),
    };
    const request: Observable<Library> = this.library
      ? this.libraries.update(this.library.id, values)
      : this.libraries.create(values);

    request.subscribe({
      next: (library) => this.dialogRef.close(library),
      error: (error: unknown) => {
        this.saving.set(false);
        this.errorMessage.set(
          error instanceof ApiError && error.statusCode === 409
            ? 'Ya tienes una biblioteca con ese nombre.'
            : error instanceof ApiError && error.message === 'tag not found'
              ? 'Alguna de las etiquetas ya no existe. Quítala e inténtalo de nuevo.'
              : 'No se ha podido guardar la biblioteca. Inténtalo de nuevo.',
        );
      },
    });
  }
}
