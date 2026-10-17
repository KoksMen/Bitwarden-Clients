// MVP, delete with PM-41067

import { Injectable, OnDestroy, Optional } from "@angular/core";
import {
  combineLatest,
  concatMap,
  distinctUntilChanged,
  filter,
  firstValueFrom,
  map,
  Observable,
  of,
  Subject,
  switchMap,
  take,
  takeUntil,
} from "rxjs";

import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { ClearClipboardDelay } from "@bitwarden/common/autofill/constants";
import { AutofillSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/autofill-settings.service";
import { ClearClipboardDelaySetting } from "@bitwarden/common/autofill/types";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { AutotypeFeatureFlagState } from "@bitwarden/common/desktop-native/enums/autotype-feature-flag-state.enum";
import { autotypeFeatureFlagState$ } from "@bitwarden/common/desktop-native/services/autotype-feature-flags";
import { DeviceType } from "@bitwarden/common/enums";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  GlobalStateProvider,
  AUTOTYPE_SETTINGS_DISK,
  AUTOFILL_SETTINGS_DISK_LOCAL,
  KeyDefinition,
  UserKeyDefinition,
} from "@bitwarden/common/platform/state";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { TotpService } from "@bitwarden/common/vault/abstractions/totp.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { LogService } from "@bitwarden/logging";
import { UserId } from "@bitwarden/user-core";

import { AutotypeConfig } from "../models/autotype-config";
import { AutotypeVaultData } from "../models/autotype-vault-data";
import { DEFAULT_KEYBOARD_SHORTCUT } from "../models/main-autotype-keyboard-shortcut";

import { DesktopAutotypeDefaultSettingPolicy } from "./desktop-autotype-policy.service";

export const AUTOTYPE_ENABLED = new KeyDefinition<boolean | null>(
  AUTOTYPE_SETTINGS_DISK,
  "autotypeEnabled",
  { deserializer: (b) => b },
);

export const AUTOTYPE_KEYBOARD_SHORTCUT = new KeyDefinition<string[]>(
  AUTOTYPE_SETTINGS_DISK,
  "autotypeKeyboardShortcut",
  { deserializer: (b) => b },
);

export const AUTOTYPE_GLOBAL_SHORTCUT = new KeyDefinition<string[]>(
  AUTOTYPE_SETTINGS_DISK,
  "autotypeGlobalShortcut",
  { deserializer: (s) => s ?? ["Control", "Alt", "A"] },
);

export const AUTOTYPE_PICKER_POSITION = new KeyDefinition<"center" | "cursor">(
  AUTOTYPE_SETTINGS_DISK,
  "autotypePickerPosition",
  { deserializer: (p) => (p === "cursor" ? "cursor" : "center") },
);

export const AUTOTYPE_TCATO_ENABLED = new KeyDefinition<boolean>(
  AUTOTYPE_SETTINGS_DISK,
  "autotypeTcatoEnabled",
  { deserializer: (b) => b ?? false },
);

export const CLEAR_CLIPBOARD_DELAY = new UserKeyDefinition(
  AUTOFILL_SETTINGS_DISK_LOCAL,
  "clearClipboardDelay",
  {
    deserializer: (value: ClearClipboardDelaySetting) => value ?? ClearClipboardDelay.FiveMinutes,
    clearOn: [],
  },
);

export type Result<T, E = Error> = [E, null] | [null, T];

export interface SequenceToken {
  type: "text" | "key" | "clearfield" | "delay";
  value?: string;
  key?: string;
  milliseconds?: number;
  isSensitive?: boolean;
}

@Injectable({
  providedIn: "root",
})
export class DesktopAutotypeMvpService implements OnDestroy {
  private readonly autotypeEnabledState = this.globalStateProvider.get(AUTOTYPE_ENABLED);
  private readonly autotypeKeyboardShortcut = this.globalStateProvider.get(
    AUTOTYPE_KEYBOARD_SHORTCUT,
  );
  private readonly autotypeGlobalShortcutState =
    this.globalStateProvider.get(AUTOTYPE_GLOBAL_SHORTCUT);
  private readonly autotypePickerPositionState =
    this.globalStateProvider.get(AUTOTYPE_PICKER_POSITION);
  private readonly autotypeTcatoEnabledState = this.globalStateProvider.get(AUTOTYPE_TCATO_ENABLED);

  // if the user's account is Premium
  private readonly isPremiumAccount$: Observable<boolean>;

  // The enabled/disabled state from the user settings menu
  autotypeEnabledUserSetting$: Observable<boolean> = of(false);

  autotypeKeyboardShortcut$: Observable<string[]> = of(DEFAULT_KEYBOARD_SHORTCUT);
  autotypeGlobalShortcut$: Observable<string[]> = of(["Control", "Alt", "A"]);
  autotypePickerPosition$: Observable<"center" | "cursor"> = of("center");
  autotypeTcatoEnabled$: Observable<boolean> = of(false);

  private destroy$ = new Subject<void>();

  constructor(
    private accountService: AccountService,
    private authService: AuthService,
    private cipherService: CipherService,
    private totpService: TotpService,
    private configService: ConfigService,
    private globalStateProvider: GlobalStateProvider,
    private platformUtilsService: PlatformUtilsService,
    private billingAccountProfileStateService: BillingAccountProfileStateService,
    private desktopAutotypePolicy: DesktopAutotypeDefaultSettingPolicy,
    private logService: LogService,
    private messagingService: MessagingService,
    @Optional() private autofillSettingsService?: AutofillSettingsServiceAbstraction,
  ) {
    this.autotypeEnabledUserSetting$ = this.autotypeEnabledState.state$.pipe(
      map((enabled) => enabled ?? true),
      distinctUntilChanged(),
      takeUntil(this.destroy$),
    );

    this.isPremiumAccount$ = this.accountService.activeAccount$.pipe(
      filter((account): account is Account => !!account),
      switchMap((account) =>
        this.billingAccountProfileStateService.hasPremiumFromAnySource$(account.id),
      ),
      distinctUntilChanged(),
      takeUntil(this.destroy$),
    );

    this.autotypeKeyboardShortcut$ = this.autotypeKeyboardShortcut.state$.pipe(
      map((shortcut) => shortcut ?? DEFAULT_KEYBOARD_SHORTCUT),
      takeUntil(this.destroy$),
    );

    this.autotypeGlobalShortcut$ = this.autotypeGlobalShortcutState.state$.pipe(
      map((shortcut) => shortcut ?? ["Control", "Alt", "A"]),
      takeUntil(this.destroy$),
    );

    this.autotypePickerPosition$ = this.autotypePickerPositionState.state$.pipe(
      map((pos) => pos ?? "center"),
      takeUntil(this.destroy$),
    );

    this.autotypeTcatoEnabled$ = this.autotypeTcatoEnabledState.state$.pipe(
      map((enabled) => enabled ?? false),
      takeUntil(this.destroy$),
    );
  }

  async init() {
    // Currently Autotype is only supported for Windows
    if (this.platformUtilsService.getDevice() !== DeviceType.WindowsDesktop) {
      return;
    }

    ipc.autofill.autotypeMvp.listenRequest(async (data: any, callback) => {
      const positionMode = await firstValueFrom(this.autotypePickerPosition$);
      const tcatoEnabled = await firstValueFrom(this.autotypeTcatoEnabled$);

      // 1. If triggered by global spotlight shortcut, open search immediately
      if (data.isGlobalSearch) {
        const items = await this.preparePickerItems(data.windowTitle, data.processName);
        ipc.autofill.autotypeMvp.openPicker({
          targetWindow: data,
          mode: "search",
          positionMode,
          useTcato: tcatoEnabled,
          initialQuery: "",
          items,
        });
        return;
      }

      // 2. Regular autotype trigger: match ciphers by process and title
      const possibleCiphers = await this.matchCiphers(data.windowTitle, data.processName);

      if (possibleCiphers.length === 1) {
        const cipher = possibleCiphers[0];
        const tokens = await this.buildSequenceTokens(cipher);
        ipc.autofill.autotypeMvp.executeSequence({
          hwnd: data.hwnd,
          tokens,
          useTcato: tcatoEnabled,
        });
      } else {
        const items = await this.preparePickerItems(data.windowTitle, data.processName);
        ipc.autofill.autotypeMvp.openPicker({
          targetWindow: data,
          mode: possibleCiphers.length >= 2 ? "picker" : "search",
          positionMode,
          useTcato: tcatoEnabled,
          initialQuery: "",
          items,
        });
      }
    });

    if (ipc.autofill.autotypeMvp.onPickerItemChosen) {
      ipc.autofill.autotypeMvp.onPickerItemChosen(
        async (data: { cipherId: string; targetWindow: any; useTcato: boolean }) => {
          const cipher = await this.getCipherById(data.cipherId);
          if (!cipher) {
            return;
          }
          const tokens = await this.buildSequenceTokens(cipher);
          ipc.autofill.autotypeMvp.executeSequence({
            hwnd: data.targetWindow?.hwnd || 0,
            tokens,
            useTcato: data.useTcato,
          });
        },
      );
    }

    if (ipc.autofill.autotypeMvp.onPickerCopyField) {
      ipc.autofill.autotypeMvp.onPickerCopyField(
        async (data: { cipherId: string; field: string; replyChannel: string }) => {
          const cipher = await this.getCipherById(data.cipherId);
          if (!cipher) {
            ipc.autofill.autotypeMvp.sendReply(data.replyChannel, {
              success: false,
              message: "Запись не найдена",
            });
            return;
          }

          let message = "";
          let copied = false;

          switch (data.field) {
            case "username":
              if (cipher.login?.username) {
                this.platformUtilsService.copyToClipboard(cipher.login.username);
                message = "Логин скопирован";
                copied = true;
              } else {
                message = "Логин отсутствует";
              }
              break;

            case "password":
              if (cipher.login?.password && cipher.viewPassword) {
                this.platformUtilsService.copyToClipboard(cipher.login.password);
                message = "Пароль скопирован";
                copied = true;
              } else {
                message = "Пароль недоступен";
              }
              break;

            case "totp":
              if (cipher.login?.hasTotp && cipher.login?.totp) {
                try {
                  const codeObj = await firstValueFrom(
                    this.totpService.getCode$(cipher.login.totp),
                  );
                  if (codeObj && codeObj.code) {
                    this.platformUtilsService.copyToClipboard(codeObj.code);
                    message = `Код TOTP (${codeObj.code}) скопирован`;
                    copied = true;
                  } else {
                    message = "Не удалось сгенерировать код TOTP";
                  }
                } catch {
                  message = "Ошибка при вычислении TOTP";
                }
              } else {
                message = "TOTP не настроен";
              }
              break;

            case "url": {
              const uris = cipher.login?.uris || [];
              const primaryUri =
                uris.find(
                  (u) => u.uri && !u.uri.startsWith("app://") && !u.uri.startsWith("apptitle://"),
                )?.uri || uris[0]?.uri;
              if (primaryUri) {
                this.platformUtilsService.copyToClipboard(primaryUri);
                message = "URL скопирован";
                copied = true;
              } else {
                message = "URL отсутствует";
              }
              break;
            }
          }

          const timeoutSec = copied ? await this.getClearClipboardSeconds() : null;
          ipc.autofill.autotypeMvp.sendReply(data.replyChannel, {
            success: copied,
            message,
            timeoutSec,
          });
        },
      );
    }

    if (ipc.autofill.autotypeMvp.onPickerEditCipher) {
      ipc.autofill.autotypeMvp.onPickerEditCipher((data: { cipherId: string }) => {
        this.messagingService.send("editCipherById", { cipherId: data.cipherId });
      });
    }

    if (ipc.autofill.autotypeMvp.onPickerClearClipboard) {
      ipc.autofill.autotypeMvp.onPickerClearClipboard(() => {
        this.platformUtilsService.copyToClipboard("", { clearing: true });
      });
    }

    // In this fork, ensure Autotype is default-enabled locally if never configured
    this.autotypeEnabledState.state$
      .pipe(
        take(1),
        concatMap(async (state) => {
          if (state === null) {
            await this.setAutotypeEnabledState(true);
          }
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();

    combineLatest([
      this.autotypeEnabledState.state$,
      this.desktopAutotypePolicy.autotypeDefaultSetting$,
    ])
      .pipe(
        concatMap(async ([autotypeEnabledState, autotypeDefaultPolicy]) => {
          try {
            if (autotypeDefaultPolicy === true && autotypeEnabledState === null) {
              await this.setAutotypeEnabledState(true);
            }
          } catch {
            this.logService.error("Failed to set Autotype enabled state.");
          }
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();

    // Listen for changes in keyboard shortcut settings
    this.autotypeKeyboardShortcut$
      .pipe(
        concatMap(async (keyboardShortcut) => {
          const config: AutotypeConfig = {
            keyboardShortcut,
          };
          ipc.autofill.autotypeMvp.configure(config);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();

    // Listen for changes in global spotlight shortcut settings
    this.autotypeGlobalShortcut$
      .pipe(
        concatMap(async (shortcut) => {
          ipc.autofill.autotypeMvp.configureGlobalSearch(shortcut);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();

    this.autotypeFeatureEnabled$
      .pipe(
        concatMap(async (enabled) => {
          ipc.autofill.autotypeMvp.toggle(enabled);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();
  }

  private get autotypeFeatureEnabled$(): Observable<boolean> {
    return combineLatest([
      this.autotypeEnabledUserSetting$,
      autotypeFeatureFlagState$(this.configService).pipe(
        map((state) => state === AutotypeFeatureFlagState.Mvp),
      ),
      this.authService.activeAccountStatus$,
    ]).pipe(
      map(
        ([settingsEnabled, ffEnabled, authStatus]) =>
          settingsEnabled && ffEnabled && authStatus === AuthenticationStatus.Unlocked,
      ),
      distinctUntilChanged(),
      takeUntil(this.destroy$),
    );
  }

  async setAutotypeEnabledState(enabled: boolean): Promise<void> {
    await this.autotypeEnabledState.update(() => enabled, {
      shouldUpdate: (currentlyEnabled) => currentlyEnabled !== enabled,
    });
  }

  async setAutotypeKeyboardShortcutState(keyboardShortcut: string[]): Promise<void> {
    await this.autotypeKeyboardShortcut.update(() => keyboardShortcut);
  }

  async setAutotypeGlobalShortcutState(shortcut: string[]): Promise<void> {
    await this.autotypeGlobalShortcutState.update(() => shortcut);
  }

  async setAutotypePickerPositionState(pos: "center" | "cursor"): Promise<void> {
    await this.autotypePickerPositionState.update(() => pos);
  }

  async setAutotypeTcatoEnabledState(enabled: boolean): Promise<void> {
    await this.autotypeTcatoEnabledState.update(() => enabled);
  }

  async matchCiphers(windowTitle: string, processName?: string): Promise<CipherView[]> {
    const titleLower = (windowTitle || "").toLowerCase();
    const procLower = (processName || "").toLowerCase();
    const cleanExe = procLower.replace(/\.exe$/i, "");

    const ciphers = await firstValueFrom(
      this.accountService.activeAccount$.pipe(
        map((account) => account?.id),
        filter((userId): userId is UserId => userId != null),
        switchMap((userId) => this.cipherService.cipherViews$(userId)),
      ),
    );

    return (ciphers || []).filter((c) => {
      if (!c.login?.username || !c.login?.password || c.deletedDate != null) {
        return false;
      }

      const uris = c.login?.uris || [];

      // 1. Process matching
      if (procLower) {
        const procMatch = uris.some((u) => {
          const raw = (u.uri || "").toLowerCase().trim();
          return (
            raw === `app://${procLower}` ||
            raw === `app://${cleanExe}` ||
            raw === procLower ||
            raw === cleanExe
          );
        });
        if (procMatch) {
          return true;
        }
      }

      // 2. Window title matching
      if (titleLower) {
        const titleMatch = uris.some((u) => {
          const raw = (u.uri || "").toLowerCase().trim();
          if (raw.startsWith("apptitle://")) {
            const pat = raw.substring("apptitle://".length).trim();
            return pat.length > 0 && titleLower.includes(pat);
          }
          return false;
        });
        if (titleMatch) {
          return true;
        }
      }

      // 3. Name-based match
      if (c.name) {
        const name = c.name.trim().toLowerCase();
        if (procLower && (name === cleanExe || procLower.includes(name))) {
          return true;
        }

        if (titleLower && name.length >= 2 && titleLower.includes(name)) {
          return true;
        }

        const primaryName = name.split(/[\s(\-_:]+/)[0]?.trim();
        if (primaryName && primaryName.length >= 3 && titleLower.includes(primaryName)) {
          return true;
        }
      }

      return false;
    });
  }

  async matchCiphersToWindowTitle(windowTitle: string): Promise<CipherView[]> {
    return await this.matchCiphers(windowTitle, undefined);
  }

  async getCipherById(id: string): Promise<CipherView | null> {
    try {
      const ciphers = await firstValueFrom(
        this.accountService.activeAccount$.pipe(
          map((account) => account?.id),
          filter((userId): userId is UserId => userId != null),
          switchMap((userId) => this.cipherService.cipherViews$(userId)),
        ),
      );
      return (ciphers || []).find((c) => c.id === id) || null;
    } catch {
      return null;
    }
  }

  async preparePickerItems(windowTitle: string, processName?: string): Promise<any[]> {
    const titleLower = (windowTitle || "").toLowerCase();
    const procLower = (processName || "").toLowerCase();
    const cleanExe = procLower.replace(/\.exe$/i, "");

    try {
      const ciphers = await firstValueFrom(
        this.accountService.activeAccount$.pipe(
          map((account) => account?.id),
          filter((userId): userId is UserId => userId != null),
          switchMap((userId) => this.cipherService.cipherViews$(userId)),
        ),
      );

      const validCiphers = (ciphers || []).filter(
        (c) => (c.login?.username || c.login?.password) && c.deletedDate == null,
      );

      const matchedItems: any[] = [];
      const otherItems: any[] = [];

      for (const c of validCiphers) {
        const uris = c.login?.uris || [];
        const name = (c.name || "").toLowerCase();
        let matchType: "process" | "title" | "search" | null = null;
        let badge = "";

        if (procLower) {
          const procMatch = uris.some((u) => {
            const raw = (u.uri || "").toLowerCase().trim();
            return (
              raw === `app://${procLower}` ||
              raw === `app://${cleanExe}` ||
              raw === procLower ||
              raw === cleanExe
            );
          });
          if (procMatch || name === cleanExe || name.startsWith(cleanExe)) {
            matchType = "process";
            badge = `Процесс: ${procLower}`;
          }
        }

        if (!matchType && titleLower) {
          const titleMatch = uris.some((u) => {
            const raw = (u.uri || "").toLowerCase().trim();
            if (raw.startsWith("apptitle://")) {
              const pat = raw.substring("apptitle://".length).trim();
              return pat.length > 0 && titleLower.includes(pat);
            }
            return false;
          });
          if (titleMatch || (name.length >= 2 && titleLower.includes(name))) {
            matchType = "title";
            badge = "Заголовок окна";
          }
        }

        const customSeq = this.getCustomSequence(c);
        const sequencePreview = customSeq || "{USERNAME} ⇥ {PASSWORD} ↵";

        const primaryUri =
          uris.find((u) => u.uri && !u.uri.startsWith("app://") && !u.uri.startsWith("apptitle://"))
            ?.uri ||
          uris[0]?.uri ||
          "";

        const item = {
          id: c.id,
          name: c.name || "Без названия",
          username: c.login?.username || "",
          hasPassword: !!(c.login?.password && c.viewPassword),
          hasTotp: !!c.login?.hasTotp,
          hasUrl: !!primaryUri,
          url: primaryUri,
          matchType: matchType || "search",
          matchBadge: badge || undefined,
          sequencePreview,
        };

        if (matchType) {
          matchedItems.push(item);
        } else {
          otherItems.push(item);
        }
      }

      return [...matchedItems, ...otherItems];
    } catch {
      return [];
    }
  }

  private getCustomSequence(cipher: CipherView): string | null {
    if (cipher.fields && cipher.fields.length > 0) {
      const field = cipher.fields.find(
        (f) =>
          f.name?.toLowerCase() === "autotype_sequence" ||
          f.name?.toLowerCase() === "autotype-sequence",
      );
      if (field && field.value && field.value.trim().length > 0) {
        return field.value.trim();
      }
    }
    return null;
  }

  async buildSequenceTokens(cipher: CipherView): Promise<SequenceToken[]> {
    const username = cipher.login?.username || "";
    const password = cipher.login?.password || "";
    let totp = "";

    if (cipher.login?.totp) {
      try {
        const res = await firstValueFrom(this.totpService.getCode$(cipher.login.totp));
        totp = res?.code || "";
      } catch {
        totp = "";
      }
    }

    const customSeq = this.getCustomSequence(cipher);
    if (!customSeq) {
      return [
        { type: "text", value: username, isSensitive: false },
        { type: "key", key: "Tab" },
        { type: "text", value: password, isSensitive: true },
        { type: "key", key: "Enter" },
      ];
    }

    const tokens: SequenceToken[] = [];
    const regex = /\{([A-Za-z0-9_ ]+)\}/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(customSeq)) !== null) {
      if (match.index > lastIndex) {
        tokens.push({
          type: "text",
          value: customSeq.substring(lastIndex, match.index),
          isSensitive: false,
        });
      }

      const tag = match[1].trim().toUpperCase();
      if (tag === "CLEARFIELD") {
        tokens.push({ type: "clearfield" });
      } else if (tag === "USERNAME") {
        tokens.push({ type: "text", value: username, isSensitive: false });
      } else if (tag === "PASSWORD") {
        tokens.push({ type: "text", value: password, isSensitive: true });
      } else if (tag === "TOTP") {
        tokens.push({ type: "text", value: totp, isSensitive: false });
      } else if (tag === "TAB") {
        tokens.push({ type: "key", key: "Tab" });
      } else if (tag === "ENTER") {
        tokens.push({ type: "key", key: "Enter" });
      } else if (tag === "SPACE") {
        tokens.push({ type: "key", key: "Space" });
      } else if (tag.startsWith("DELAY")) {
        const parts = tag.split(/\s+/);
        const ms = parts[1] ? parseInt(parts[1], 10) : 500;
        tokens.push({ type: "delay", milliseconds: isNaN(ms) ? 500 : ms });
      } else {
        tokens.push({ type: "text", value: match[0], isSensitive: false });
      }

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < customSeq.length) {
      tokens.push({
        type: "text",
        value: customSeq.substring(lastIndex),
        isSensitive: false,
      });
    }

    return tokens;
  }

  private convertClearClipboardDelayToSeconds(
    setting: ClearClipboardDelaySetting | null | undefined,
  ): number | null {
    switch (setting) {
      case ClearClipboardDelay.Never:
        return null;
      case ClearClipboardDelay.TenSeconds:
        return 10;
      case ClearClipboardDelay.TwentySeconds:
        return 20;
      case ClearClipboardDelay.ThirtySeconds:
        return 30;
      case ClearClipboardDelay.OneMinute:
        return 60;
      case ClearClipboardDelay.TwoMinutes:
        return 120;
      case ClearClipboardDelay.FiveMinutes:
        return 300;
      default:
        return 300;
    }
  }

  private async getClearClipboardSeconds(): Promise<number | null> {
    try {
      if (this.autofillSettingsService) {
        const setting = await firstValueFrom(
          this.autofillSettingsService.clearClipboardDelay$.pipe(take(1)),
        );
        return this.convertClearClipboardDelayToSeconds(setting);
      }
    } catch (e) {
      this.logService.error("Failed to get clear clipboard delay setting", e);
    }
    return 300;
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}

export function getAutotypeVaultData(
  cipherView: CipherView | undefined,
): Result<AutotypeVaultData> {
  if (!cipherView) {
    return [Error("No matching vault item."), null];
  } else if (cipherView.login.username === undefined || cipherView.login.password === undefined) {
    return [Error("Vault item is undefined."), null];
  } else {
    const vaultData: AutotypeVaultData = {
      username: cipherView.login.username,
      password: cipherView.login.password,
    };
    return [null, vaultData];
  }
}
