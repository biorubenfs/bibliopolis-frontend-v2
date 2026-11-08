import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';

import { LibrariesService } from '../../libraries/libraries.service';
import { TagBadge } from '../tag-badge/tag-badge';
import { TagColorPicker } from '../tag-color-picker/tag-color-picker';
import {
  MAX_TAGS_PER_USER,
  TAG_NAME_MAX_LENGTH,
  TAG_NAME_MIN_LENGTH,
  Tag,
  TagColor,
  isGlobalTag,
  leastUsedColor,
  normalizeTagName,
  sortTags,
} from '../tag.model';
import { TagsService, tagErrorMessage } from '../tags.service';

type LoadState = 'loading' | 'loaded' | 'error';

export const MANAGE_TAGS_DIALOG_SIZE = { width: '560px', maxWidth: 'calc(100vw - 32px)' };

/**
 * Creates, renames, recolours and deletes the user's tags. Global tags are listed without actions.
 * The caller reloads its tags when the dialog closes.
 */
@Component({
  selector: 'app-manage-tags-dialog',
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    TagBadge,
    TagColorPicker,
  ],
  templateUrl: './manage-tags-dialog.html',
  styleUrl: './manage-tags-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ManageTagsDialog {
  private readonly tagsService = inject(TagsService);
  private readonly librariesService = inject(LibrariesService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  protected readonly nameMaxLength = TAG_NAME_MAX_LENGTH;
  protected readonly maxTags = MAX_TAGS_PER_USER;

  protected readonly state = signal<LoadState>('loading');
  protected readonly tags = signal<Tag[]>([]);
  protected readonly ownTags = computed(() => this.tags().filter((tag) => !isGlobalTag(tag)));
  protected readonly globalTags = computed(() => this.tags().filter(isGlobalTag));
  protected readonly limitReached = computed(() => this.ownTags().length >= MAX_TAGS_PER_USER);

  protected readonly newName = signal('');
  protected readonly newColor = signal<TagColor>('green');
  protected readonly creating = signal(false);
  protected readonly createError = signal<string | null>(null);
  protected readonly canCreate = computed(
    () => !this.limitReached() && this.isValidName(this.newName()),
  );

  protected readonly editingId = signal<string | null>(null);
  protected readonly editName = signal('');
  protected readonly editColor = signal<TagColor>('green');
  protected readonly savingEdit = signal(false);
  protected readonly editError = signal<string | null>(null);
  protected readonly canSaveEdit = computed(() => this.isValidName(this.editName()));

  protected readonly confirmingDeleteId = signal<string | null>(null);
  /** Libraries that use the tag about to be deleted; null while it is being counted. */
  protected readonly deleteUsage = signal<number | null>(null);
  protected readonly deleting = signal(false);
  protected readonly deleteError = signal<string | null>(null);

  constructor() {
    this.load();
  }

  protected load(): void {
    this.state.set('loading');
    this.tagsService.listAll().subscribe({
      next: (tags) => {
        this.tags.set(tags);
        this.newColor.set(leastUsedColor(tags));
        this.state.set('loaded');
      },
      error: () => this.state.set('error'),
    });
  }

  protected create(event: Event): void {
    event.preventDefault();
    if (!this.canCreate() || this.creating()) {
      return;
    }
    this.creating.set(true);
    this.createError.set(null);
    this.tagsService.create({ name: this.newName().trim(), color: this.newColor() }).subscribe({
      next: (tag) => {
        this.creating.set(false);
        this.tags.update((tags) => sortTags([...tags, tag]));
        this.newName.set('');
        this.newColor.set(leastUsedColor(this.tags()));
      },
      error: (error: unknown) => {
        this.creating.set(false);
        this.createError.set(tagErrorMessage(error));
      },
    });
  }

  protected startEdit(tag: Tag): void {
    this.cancelDelete();
    this.editingId.set(tag.id);
    this.editName.set(tag.name);
    this.editColor.set(tag.color);
    this.editError.set(null);
    this.focus('.edit input[matInput]');
  }

  protected cancelEdit(): void {
    const id = this.editingId();
    this.editingId.set(null);
    if (id) {
      this.focus(`[data-edit="${id}"]`);
    }
  }

  protected saveEdit(event: Event, tag: Tag): void {
    event.preventDefault();
    if (!this.canSaveEdit() || this.savingEdit()) {
      return;
    }
    this.savingEdit.set(true);
    this.editError.set(null);
    this.tagsService
      .update(tag.id, { name: this.editName().trim(), color: this.editColor() })
      .subscribe({
        next: (updated) => {
          this.savingEdit.set(false);
          this.tags.update((tags) =>
            sortTags(tags.map((item) => (item.id === updated.id ? updated : item))),
          );
          this.editingId.set(null);
          this.focus(`[data-edit="${updated.id}"]`);
        },
        error: (error: unknown) => {
          this.savingEdit.set(false);
          this.editError.set(tagErrorMessage(error));
        },
      });
  }

  protected startDelete(tag: Tag): void {
    this.editingId.set(null);
    this.confirmingDeleteId.set(tag.id);
    this.deleteError.set(null);
    this.deleteUsage.set(null);
    // The pagination total says how many libraries have the tag, without a dedicated endpoint
    this.librariesService.list({ skip: 0, limit: 1, tagIds: [tag.id] }).subscribe({
      next: ({ total }) => this.deleteUsage.set(total),
      // Not knowing the count must not prevent the deletion
      error: () => this.deleteUsage.set(-1),
    });
    this.focus('.confirm [data-cancel]');
  }

  protected cancelDelete(): void {
    const id = this.confirmingDeleteId();
    this.confirmingDeleteId.set(null);
    if (id) {
      this.focus(`[data-delete="${id}"]`);
    }
  }

  protected confirmDelete(tag: Tag): void {
    this.deleting.set(true);
    this.deleteError.set(null);
    this.tagsService.delete(tag.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.confirmingDeleteId.set(null);
        this.tags.update((tags) => tags.filter((item) => item.id !== tag.id));
        // The row is gone with its buttons: keep the keyboard focus in the dialog
        this.focus('.new input[matInput]');
      },
      error: () => {
        this.deleting.set(false);
        this.deleteError.set('No se ha podido borrar la etiqueta. Inténtalo de nuevo.');
      },
    });
  }

  protected inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  private isValidName(name: string): boolean {
    const length = normalizeTagName(name).length;
    return length >= TAG_NAME_MIN_LENGTH && length <= TAG_NAME_MAX_LENGTH;
  }

  /** Moves the focus once the view shows the element. */
  private focus(selector: string): void {
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus(), {
      injector: this.injector,
    });
  }
}
