import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { SectionTab, TabbedSection } from '../../../core/tabbed-section/tabbed-section';
import { SharedLibrariesService } from '../../shared-libraries/shared-libraries.service';
import { LibrariesService } from '../libraries.service';

/** «Bibliotecas»: the own libraries and the ones shared with the user. */
@Component({
  selector: 'app-libraries-section',
  imports: [TabbedSection],
  template: `
    <app-tabbed-section
      heading="Bibliotecas"
      singular="biblioteca"
      plural="bibliotecas"
      [own]="own"
      [shared]="shared"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LibrariesSection {
  private readonly librariesService = inject(LibrariesService);
  private readonly sharedLibraries = inject(SharedLibrariesService);

  protected readonly own: SectionTab = {
    label: 'Mías',
    path: '/libraries',
    list: (options) => this.librariesService.list(options),
  };
  protected readonly shared: SectionTab = {
    label: 'Compartidas conmigo',
    path: '/libraries/shared',
    list: (options) => this.sharedLibraries.list(options),
  };
}
