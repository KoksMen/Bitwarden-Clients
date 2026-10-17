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
        margin-top: 12px;
      }
      .presets-row .label-hint,
      .chips-row .label-hint {
        font-size: 12px;
        font-weight: 600;
        color: #64748b;
      }
      :host-context(html.theme_dark) .presets-row .label-hint,
      :host-context(html.theme_dark) .chips-row .label-hint {
        color: #94a3b8;
      }
      .preset-buttons,
      .chip-buttons {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .preset-btn {
        background: #f1f5f9;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        padding: 4px 10px;
        font-size: 12px;
        font-weight: 500;
        color: #1e293b;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .preset-btn:hover {
        background: #eff6ff;
        border-color: #3b82f6;
        color: #1d4ed8;
      }
      .preset-btn.active {
        background: #2563eb !important;
        border-color: #1d4ed8 !important;
        color: #ffffff !important;
        font-weight: 600;
        box-shadow: 0 2px 8px rgba(37, 99, 235, 0.35);
      }
      :host-context(html.theme_dark) .preset-btn {
        background: #1e293b;
        border-color: #334155;
        color: #f8fafc;
      }
      :host-context(html.theme_dark) .preset-btn:hover {
        background: #1e3a8a;
        border-color: #60a5fa;
        color: #ffffff;
      }
      :host-context(html.theme_dark) .preset-btn.active {
        background: #2563eb !important;
        border-color: #93c5fd !important;
        color: #ffffff !important;
        box-shadow: 0 2px 10px rgba(37, 99, 235, 0.45);
      }
      .chip-btn {
        background: #f8fafc;
        border: 1px dashed #94a3b8;
        border-radius: 6px;
        padding: 3px 8px;
        font-size: 11.5px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        color: #334155;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .chip-btn:hover {
        background: #eff6ff;
        border-color: #2563eb;
        color: #1d4ed8;
        transform: translateY(-1px);
      }
      :host-context(html.theme_dark) .chip-btn {
        background: rgba(255, 255, 255, 0.05);
        border-color: #475569;
        color: #cbd5e1;
      }
      :host-context(html.theme_dark) .chip-btn:hover {
        background: #1e3a8a;
        border-color: #60a5fa;
        color: #ffffff;
        transform: translateY(-1px);
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
