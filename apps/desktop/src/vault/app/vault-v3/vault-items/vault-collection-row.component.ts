// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { NgClass } from "@angular/common";
import { Component, HostBinding, input, output } from "@angular/core";
import { RouterLink } from "@angular/router";

import {
  CollectionView,
  CollectionTypes,
} from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { CheckboxModule, IconModule, LinkModule, TableModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import {
  GetOrgNameFromIdPipe,
  OrganizationNameBadgeComponent,
  Vfo1IconPipe,
} from "@bitwarden/vault";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "tr[appVaultCollectionRow]",
  templateUrl: "vault-collection-row.component.html",
  imports: [
    TableModule,
    LinkModule,
    NgClass,
    I18nPipe,
    RouterLink,
    OrganizationNameBadgeComponent,
    GetOrgNameFromIdPipe,
    CheckboxModule,
    IconModule,
    Vfo1IconPipe,
  ],
})
export class VaultCollectionRowComponent {
  protected RowHeightClass = `tw-h-[76.5px]`;
  protected DefaultCollectionType = CollectionTypes.DefaultUserCollection;

  @HostBinding("class")
  protected get hostClasses(): string {
    const isSelected = this.selected();
    const base =
      "tw-block tw-rounded-xl tw-border tw-p-3.5 tw-transition-all tw-duration-200 tw-cursor-pointer tw-shadow-sm";
    if (isSelected) {
      return `${base} tw-border-primary tw-ring-2 tw-ring-primary/20 tw-bg-primary-50/50 dark:tw-bg-primary-950/40 tw-shadow-md`;
    }
    return `${base} tw-border-border tw-bg-surface-alt hover:tw-border-primary/60 hover:tw-bg-surface-hover hover:tw-shadow-md`;
  }

  protected readonly disabled = input<boolean>();
  protected readonly collection = input<CollectionView>();
  protected readonly showOwner = input<boolean>();
  protected readonly organizations = input<Organization[]>();
  protected readonly showBatchBar = input<boolean>(false);
  protected readonly selected = input<boolean>(false);
  protected readonly checkboxChange = output<void>();
}
