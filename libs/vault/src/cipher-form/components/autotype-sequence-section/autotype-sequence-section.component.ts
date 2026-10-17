import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";

import { FieldType } from "@bitwarden/common/vault/enums";
import { FieldView } from "@bitwarden/common/vault/models/view/field.view";
import {
  ButtonModule,
  CardComponent,
  FormFieldModule,
  SectionHeaderComponent,
  TypographyModule,
} from "@bitwarden/components";

import { CipherFormContainer } from "../../cipher-form-container";

const DEFAULT_SEQUENCE = "{USERNAME}{TAB}{PASSWORD}{ENTER}";

@Component({
  selector: "vault-autotype-sequence-section",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardComponent,
    SectionHeaderComponent,
    TypographyModule,
    FormFieldModule,
    ButtonModule,
  ],
  templateUrl: "./autotype-sequence-section.component.html",
  styles: [
    `
      .presets-row,
      .chips-row {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-top: 10px;
      }
      .presets-row .label-hint,
      .chips-row .label-hint {
        font-size: 11.5px;
        color: #71717a;
        font-weight: 500;
      }
      .preset-buttons,
      .chip-buttons {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .preset-btn {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 4px;
        padding: 3px 8px;
        font-size: 11.5px;
        color: #d4d4d8;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .preset-btn:hover {
        background: rgba(59, 130, 246, 0.15);
        border-color: rgba(59, 130, 246, 0.35);
        color: #93c5fd;
      }
      .preset-btn.active {
        background: rgba(59, 130, 246, 0.25);
        border-color: #3b82f6;
        color: #60a5fa;
        font-weight: 600;
      }
      .chip-btn {
        background: rgba(255, 255, 255, 0.03);
        border: 1px dashed rgba(255, 255, 255, 0.15);
        border-radius: 4px;
        padding: 2px 7px;
        font-size: 11px;
        font-family: monospace;
        color: #a1a1aa;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .chip-btn:hover {
        background: rgba(255, 255, 255, 0.08);
        border-color: rgba(255, 255, 255, 0.3);
        color: #f4f4f5;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AutotypeSequenceSectionComponent implements OnInit {
  // eslint-disable-next-line @bitwarden/components/enforce-readonly-angular-properties
  sequence: string = DEFAULT_SEQUENCE;

  readonly presets = [
    {
      label: "Очистить + Логин + Пароль + Enter",
      seq: "{CLEARFIELD}{USERNAME}{TAB}{PASSWORD}{ENTER}",
    },
    { label: "Логин + Пароль + Enter", seq: "{USERNAME}{TAB}{PASSWORD}{ENTER}" },
    { label: "Только пароль + Enter", seq: "{PASSWORD}{ENTER}" },
    { label: "Логин + Пароль", seq: "{USERNAME}{TAB}{PASSWORD}" },
    { label: "TOTP + Enter", seq: "{TOTP}{ENTER}" },
  ];

  readonly chips = [
    "{CLEARFIELD}",
    "{USERNAME}",
    "{PASSWORD}",
    "{TOTP}",
    "{TAB}",
    "{ENTER}",
    "{SPACE}",
    "{DELAY 500}",
  ];

  constructor(
    private readonly cipherFormContainer: CipherFormContainer,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    const cipher = this.cipherFormContainer.getInitialCipherView();
    if (cipher.fields && cipher.fields.length > 0) {
      const field = cipher.fields.find(
        (f) =>
          f.name?.toLowerCase() === "autotype_sequence" ||
          f.name?.toLowerCase() === "autotype-sequence",
      );
      if (field && field.value && field.value.trim().length > 0) {
        this.sequence = field.value.trim();
        this.cdr.markForCheck();
      }
    }
  }

  setPreset(seq: string) {
    this.sequence = seq;
    this.onSequenceChange();
  }

  insertTag(tag: string) {
    this.sequence = (this.sequence || "") + tag;
    this.onSequenceChange();
  }

  onSequenceChange() {
    const trimmed = (this.sequence || "").trim();
    this.cipherFormContainer.patchCipher((cipher) => {
      cipher.fields = cipher.fields || [];
      const fieldIdx = cipher.fields.findIndex(
        (f) =>
          f.name?.toLowerCase() === "autotype_sequence" ||
          f.name?.toLowerCase() === "autotype-sequence",
      );

      if (trimmed.length > 0 && trimmed !== DEFAULT_SEQUENCE) {
        if (fieldIdx >= 0) {
          cipher.fields[fieldIdx].value = trimmed;
        } else {
          const field = new FieldView();
          field.name = "autotype_sequence";
          field.value = trimmed;
          field.type = FieldType.Text;
          cipher.fields.push(field);
        }
      } else {
        // If empty or default sequence, remove the override field
        if (fieldIdx >= 0) {
          cipher.fields.splice(fieldIdx, 1);
        }
      }
      return cipher;
    });
  }
}
