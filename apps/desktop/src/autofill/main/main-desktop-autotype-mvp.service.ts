// MVP, delete with PM-41067

import { ipcMain, globalShortcut } from "electron";

import { autotype_mvp } from "@bitwarden/desktop-napi";
import { LogService } from "@bitwarden/logging";

import { WindowMain } from "../../main/window.main";
import { stringIsNotUndefinedNullAndEmpty } from "../../utils";
import { AutotypeConfig } from "../models/autotype-config";
import { AutotypeMatchError } from "../models/autotype-errors";
import { AutotypeVaultData } from "../models/autotype-vault-data";
import { AUTOTYPE_MVP_IPC_CHANNELS } from "../models/ipc-channels";
import { AutotypeKeyboardShortcut } from "../models/main-autotype-keyboard-shortcut";

import { AutotypePickerWindow } from "./autotype-picker-window";
import {
  MainAutotypeHelperService,
  SequenceToken,
  WindowInfo,
} from "./main-autotype-helper.service";

export class MainDesktopAutotypeMvpService {
  private autotypeKeyboardShortcut: AutotypeKeyboardShortcut;
  private globalSearchShortcut: AutotypeKeyboardShortcut;
  private helperService: MainAutotypeHelperService;
  private pickerWindow: AutotypePickerWindow;
  private isAutotypeEnabled = false;

  constructor(
    private logService: LogService,
    private windowMain: WindowMain,
  ) {
    this.autotypeKeyboardShortcut = new AutotypeKeyboardShortcut();
    this.globalSearchShortcut = new AutotypeKeyboardShortcut();
    // Default Global Spotlight Shortcut: Ctrl+Alt+A
    this.globalSearchShortcut.set(["Control", "Alt", "A"]);

    this.helperService = new MainAutotypeHelperService(this.logService);
    this.pickerWindow = new AutotypePickerWindow(this.logService, this.helperService);

    this.registerIpcListeners();
  }

  registerIpcListeners() {
    ipcMain.on(AUTOTYPE_MVP_IPC_CHANNELS.TOGGLE, (_event, enable: boolean) => {
      this.isAutotypeEnabled = enable;
      if (enable) {
        this.enableAutotype();
      } else {
        this.disableAutotype();
      }
    });

    ipcMain.on(AUTOTYPE_MVP_IPC_CHANNELS.CONFIGURE, (_event, config: AutotypeConfig) => {
      const newKeyboardShortcut = new AutotypeKeyboardShortcut();
      const newKeyboardShortcutIsValid = newKeyboardShortcut.set(config.keyboardShortcut);

      if (!newKeyboardShortcutIsValid) {
        this.logService.error("Configure autotype failed: the keyboard shortcut is invalid.");
        return;
      }

      this.setKeyboardShortcut(newKeyboardShortcut);
    });

    ipcMain.on(
      AUTOTYPE_MVP_IPC_CHANNELS.CONFIGURE_GLOBAL_SEARCH,
      (_event, config: { shortcut: string[] }) => {
        const newShortcut = new AutotypeKeyboardShortcut();
        if (newShortcut.set(config.shortcut)) {
          this.setGlobalSearchShortcut(newShortcut);
        }
      },
    );

    ipcMain.handle(AUTOTYPE_MVP_IPC_CHANNELS.GET_RUNNING_WINDOWS, async () => {
      return await this.helperService.listRunningWindows();
    });

    ipcMain.handle(AUTOTYPE_MVP_IPC_CHANNELS.CAPTURE_WINDOW, async () => {
      return await this.helperService.captureWindow();
    });

    ipcMain.on(
      AUTOTYPE_MVP_IPC_CHANNELS.OPEN_PICKER,
      async (
        _event,
        data: {
          targetWindow: WindowInfo;
          mode: "picker" | "search";
          initialQuery?: string;
          positionMode?: "center" | "cursor";
          useTcato?: boolean;
        },
      ) => {
        await this.pickerWindow.open(data);
      },
    );

    ipcMain.on(AUTOTYPE_MVP_IPC_CHANNELS.CLOSE_PICKER, () => {
      this.pickerWindow.close();
    });

    ipcMain.on(
      AUTOTYPE_MVP_IPC_CHANNELS.PICKER_SELECT,
      async (_event, data: { cipherId?: string; tokens?: SequenceToken[] }) => {
        const targetWindow = this.pickerWindow.getCurrentTargetWindow();
        const useTcato = this.pickerWindow.getCurrentUseTcato();
        this.pickerWindow.close();
        if (data.tokens && data.tokens.length > 0) {
          await this.pickerWindow.handlePickerSelect(data.tokens);
        } else if (data.cipherId) {
          if (this.windowMain.win && !this.windowMain.win.isDestroyed()) {
            this.windowMain.win.webContents.send(AUTOTYPE_MVP_IPC_CHANNELS.PICKER_ITEM_CHOSEN, {
              cipherId: data.cipherId,
              targetWindow,
              useTcato,
            });
          }
        }
      },
    );

    ipcMain.on(
      AUTOTYPE_MVP_IPC_CHANNELS.EXECUTE_SEQUENCE,
      async (
        _event,
        data: {
          hwnd: number;
          tokens: SequenceToken[];
          useTcato: boolean;
        },
      ) => {
        if (data.hwnd) {
          await this.helperService.focusWindow(data.hwnd);
          await new Promise((r) => setTimeout(r, 100));
        }
        await this.helperService.typeSequence({
          hwnd: data.hwnd,
          tokens: data.tokens,
          useTcato: data.useTcato,
        });
      },
    );

    ipcMain.on(AUTOTYPE_MVP_IPC_CHANNELS.EXECUTE, (_event, vaultData: AutotypeVaultData) => {
      if (
        stringIsNotUndefinedNullAndEmpty(vaultData.username) &&
        stringIsNotUndefinedNullAndEmpty(vaultData.password)
      ) {
        this.doAutotype(vaultData, this.autotypeKeyboardShortcut.getArrayFormat());
      }
    });

    ipcMain.on(
      AUTOTYPE_MVP_IPC_CHANNELS.EXECUTION_ERROR,
      (_event, matchError: AutotypeMatchError) => {
        this.logService.debug(
          AUTOTYPE_MVP_IPC_CHANNELS.EXECUTION_ERROR,
          "No match for window: " + matchError.windowTitle,
        );
        this.logService.error(AUTOTYPE_MVP_IPC_CHANNELS.EXECUTION_ERROR, matchError.errorMessage);
      },
    );
  }

  disableAutotype() {
    const formattedKeyboardShortcut = this.autotypeKeyboardShortcut.getElectronFormat();
    if (globalShortcut.isRegistered(formattedKeyboardShortcut)) {
      globalShortcut.unregister(formattedKeyboardShortcut);
      this.logService.debug("Autotype shortcut disabled.");
    }

    const formattedGlobal = this.globalSearchShortcut.getElectronFormat();
    if (globalShortcut.isRegistered(formattedGlobal)) {
      globalShortcut.unregister(formattedGlobal);
      this.logService.debug("Global search shortcut disabled.");
    }
  }

  dispose() {
    ipcMain.removeAllListeners(AUTOTYPE_MVP_IPC_CHANNELS.TOGGLE);
    ipcMain.removeAllListeners(AUTOTYPE_MVP_IPC_CHANNELS.CONFIGURE);
    ipcMain.removeAllListeners(AUTOTYPE_MVP_IPC_CHANNELS.CONFIGURE_GLOBAL_SEARCH);
    ipcMain.removeHandler(AUTOTYPE_MVP_IPC_CHANNELS.GET_RUNNING_WINDOWS);
    ipcMain.removeHandler(AUTOTYPE_MVP_IPC_CHANNELS.CAPTURE_WINDOW);
    ipcMain.removeAllListeners(AUTOTYPE_MVP_IPC_CHANNELS.OPEN_PICKER);
    ipcMain.removeAllListeners(AUTOTYPE_MVP_IPC_CHANNELS.CLOSE_PICKER);
    ipcMain.removeAllListeners(AUTOTYPE_MVP_IPC_CHANNELS.PICKER_SELECT);
    ipcMain.removeAllListeners(AUTOTYPE_MVP_IPC_CHANNELS.EXECUTE_SEQUENCE);
    ipcMain.removeAllListeners(AUTOTYPE_MVP_IPC_CHANNELS.EXECUTE);
    ipcMain.removeAllListeners(AUTOTYPE_MVP_IPC_CHANNELS.EXECUTION_ERROR);

    this.disableAutotype();
    this.pickerWindow.dispose();
    this.helperService.dispose();
  }

  private enableAutotype() {
    const formattedKeyboardShortcut = this.autotypeKeyboardShortcut.getElectronFormat();
    if (!globalShortcut.isRegistered(formattedKeyboardShortcut)) {
      const result = globalShortcut.register(formattedKeyboardShortcut, async () => {
        await this.handleTrigger(false);
      });
      result
        ? this.logService.debug("Autotype enabled: " + formattedKeyboardShortcut)
        : this.logService.error("Failed to enable Autotype.");
    }

    const formattedGlobal = this.globalSearchShortcut.getElectronFormat();
    if (!globalShortcut.isRegistered(formattedGlobal)) {
      const globalResult = globalShortcut.register(formattedGlobal, async () => {
        await this.handleTrigger(true);
      });
      globalResult
        ? this.logService.debug("Global AutoType search enabled: " + formattedGlobal)
        : this.logService.error("Failed to enable Global AutoType search shortcut.");
    }
  }

  private async handleTrigger(isGlobalSearch: boolean) {
    if (this.windowMain.win == null || this.windowMain.win.isDestroyed()) {
      this.logService.debug("Autotype triggered, but main window does not exist.");
      return;
    }

    const activeInfo = await this.helperService.getActiveWindow();
    let windowTitle = activeInfo?.windowTitle;

    if (!windowTitle) {
      try {
        windowTitle = autotype_mvp.getForegroundWindowTitle();
      } catch {
        windowTitle = "";
      }
    }

    const data = {
      windowTitle: windowTitle || "",
      processName: activeInfo?.processName || "",
      processPath: activeInfo?.processPath || "",
      hwnd: activeInfo?.hwnd || 0,
      isGlobalSearch,
    };

    this.windowMain.win.webContents.send(AUTOTYPE_MVP_IPC_CHANNELS.LISTEN, data);
  }

  private setKeyboardShortcut(keyboardShortcut: AutotypeKeyboardShortcut) {
    if (
      keyboardShortcut.getElectronFormat() !== this.autotypeKeyboardShortcut.getElectronFormat()
    ) {
      const registered = globalShortcut.isRegistered(
        this.autotypeKeyboardShortcut.getElectronFormat(),
      );
      if (registered) {
        globalShortcut.unregister(this.autotypeKeyboardShortcut.getElectronFormat());
      }
      this.autotypeKeyboardShortcut = keyboardShortcut;
      if (this.isAutotypeEnabled) {
        this.enableAutotype();
      }
    }
  }

  private setGlobalSearchShortcut(shortcut: AutotypeKeyboardShortcut) {
    if (shortcut.getElectronFormat() !== this.globalSearchShortcut.getElectronFormat()) {
      const registered = globalShortcut.isRegistered(this.globalSearchShortcut.getElectronFormat());
      if (registered) {
        globalShortcut.unregister(this.globalSearchShortcut.getElectronFormat());
      }
      this.globalSearchShortcut = shortcut;
      if (this.isAutotypeEnabled) {
        this.enableAutotype();
      }
    }
  }

  private doAutotype(vaultData: AutotypeVaultData, keyboardShortcut: string[]) {
    const TAB = "\t";
    const inputPattern = vaultData.username + TAB + vaultData.password;
    const inputArray = new Array<number>(inputPattern.length);

    for (let i = 0; i < inputPattern.length; i++) {
      inputArray[i] = inputPattern.charCodeAt(i);
    }

    autotype_mvp.typeInput(inputArray, keyboardShortcut);
  }
}
