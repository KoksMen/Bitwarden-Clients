import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  NgZone,
  OnDestroy,
  OnInit,
  signal,
} from "@angular/core";

import { I18nPipe } from "@bitwarden/ui-common";

import { IconComponent } from "../icon";

@Component({
  selector: "bit-caps-lock-layout-indicator",
  standalone: true,
  imports: [CommonModule, I18nPipe, IconComponent],
  template: `
    <div
      class="tw-flex tw-items-center tw-justify-between tw-text-xs tw-mt-1.5 tw-px-1 tw-min-h-[20px] tw-select-none"
      aria-live="polite"
    >
      <div
        *ngIf="capsLock()"
        class="tw-flex tw-items-center tw-text-warning tw-font-medium tw-gap-1"
        role="alert"
      >
        <bit-icon name="bwi-exclamation-triangle"></bit-icon>
        <span>{{ "capsLockOn" | i18n }}</span>
      </div>
      <div *ngIf="!capsLock()"></div>

      <div
        *ngIf="layout()"
        class="tw-inline-flex tw-items-center tw-gap-1.5 tw-text-muted tw-text-xs"
      >
        <span>{{ "keyboardLayout" | i18n }}:</span>
        <span
          class="tw-font-mono tw-font-semibold tw-text-fg-body tw-bg-bg-secondary tw-px-1.5 tw-py-0.5 tw-rounded tw-border tw-border-border-base"
        >
          {{ layout() }}
        </span>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BitCapsLockLayoutIndicatorComponent implements OnInit, OnDestroy {
  private readonly ngZone = inject(NgZone);

  readonly capsLock = signal(false);
  readonly layout = signal("");

  private readonly pollIntervalRef = { id: null as ReturnType<typeof setInterval> | null };

  ngOnInit(): void {
    void this.updateFromNative();

    window.addEventListener("keydown", this.handleKeyEvent, true);
    window.addEventListener("keyup", this.handleKeyEvent, true);
    window.addEventListener("mousedown", this.handleMouseEvent, true);
    window.addEventListener("focus", this.handleWindowFocus, true);

    this.ngZone.runOutsideAngular(() => {
      this.pollIntervalRef.id = setInterval(() => {
        void this.updateFromNative();
      }, 500);
    });
  }

  ngOnDestroy(): void {
    window.removeEventListener("keydown", this.handleKeyEvent, true);
    window.removeEventListener("keyup", this.handleKeyEvent, true);
    window.removeEventListener("mousedown", this.handleMouseEvent, true);
    window.removeEventListener("focus", this.handleWindowFocus, true);

    if (this.pollIntervalRef.id) {
      clearInterval(this.pollIntervalRef.id);
      this.pollIntervalRef.id = null;
    }
  }

  private readonly handleKeyEvent = (e: KeyboardEvent) => {
    const newCaps = e.getModifierState("CapsLock");
    if (this.capsLock() !== newCaps) {
      this.capsLock.set(newCaps);
    }

    if (e.key && e.key.length === 1 && e.code && e.code.startsWith("Key")) {
      const char = e.key;
      if (/[а-яА-ЯёЁ]/.test(char)) {
        this.setLayout("RU");
      } else if (/[a-zA-Z]/.test(char)) {
        if (!this.layout() || this.layout() === "RU" || this.layout() === "UA") {
          this.setLayout("EN");
        }
      } else if (/[іїєґІЇЄҐ]/.test(char)) {
        this.setLayout("UA");
      }
    }

    if (["Alt", "Shift", "Control", "Meta"].includes(e.key)) {
      setTimeout(() => void this.updateFromNative(), 50);
    }
  };

  private readonly handleMouseEvent = (e: MouseEvent) => {
    const newCaps = e.getModifierState("CapsLock");
    if (this.capsLock() !== newCaps) {
      this.capsLock.set(newCaps);
    }
    void this.updateFromNative();
  };

  private readonly handleWindowFocus = () => {
    void this.updateFromNative();
  };

  private async updateFromNative(): Promise<void> {
    try {
      const ipc = (window as any).ipc;
      if (ipc?.platform?.getKeyboardState) {
        const state = await ipc.platform.getKeyboardState();
        if (state) {
          if (state.capsLock !== undefined && this.capsLock() !== state.capsLock) {
            this.capsLock.set(state.capsLock);
          }
          if (state.layout && this.layout() !== state.layout) {
            this.layout.set(state.layout);
          }
          return;
        }
      }
    } catch {
      // ignore
    }

    if (!this.layout()) {
      const navLang = navigator.language ? navigator.language.slice(0, 2).toUpperCase() : "EN";
      this.setLayout(navLang === "RU" ? "RU" : "EN");
    }
  }

  private setLayout(newLayout: string) {
    if (this.layout() !== newLayout) {
      this.layout.set(newLayout);
    }
  }
}
