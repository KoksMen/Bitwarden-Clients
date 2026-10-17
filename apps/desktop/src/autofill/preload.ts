import { ipcRenderer } from "electron";

import { DesktopAutofillPreload } from "./desktop-autofill.preload";
import { AutotypeConfig } from "./models/autotype-config";
import { AutotypeMatchError } from "./models/autotype-errors";
import { AutotypeVaultData } from "./models/autotype-vault-data";
import { AUTOTYPE_MVP_IPC_CHANNELS, SSH_AGENT_IPC_CHANNELS } from "./models/ipc-channels";

const sshAgent = {
  init: async () => {
    await ipcRenderer.invoke(SSH_AGENT_IPC_CHANNELS.INIT);
  },
  replace: (keys: { name: string; privateKey: string; cipherId: string }[]): Promise<void> =>
    ipcRenderer.invoke(SSH_AGENT_IPC_CHANNELS.REPLACE, keys),
  signRequestResponse: async (requestId: number, accepted: boolean) => {
    await ipcRenderer.invoke(SSH_AGENT_IPC_CHANNELS.SIGN_REQUEST_RESPONSE, { requestId, accepted });
  },
  listRequestResponse: async (requestId: number, accepted: boolean) => {
    await ipcRenderer.invoke(SSH_AGENT_IPC_CHANNELS.LIST_KEYS_RESPONSE, { requestId, accepted });
  },
  isLoaded(): Promise<boolean> {
    return ipcRenderer.invoke(SSH_AGENT_IPC_CHANNELS.IS_LOADED);
  },
  stop: async () => ipcRenderer.invoke(SSH_AGENT_IPC_CHANNELS.STOP),
};

// MVP, delete with PM-41067
const autotypeMvp = {
  configure: (config: AutotypeConfig) => {
    ipcRenderer.send(AUTOTYPE_MVP_IPC_CHANNELS.CONFIGURE, config);
  },
  configureGlobalSearch: (shortcut: string[]) => {
    ipcRenderer.send(AUTOTYPE_MVP_IPC_CHANNELS.CONFIGURE_GLOBAL_SEARCH, { shortcut });
  },
  toggle: (enable: boolean) => {
    ipcRenderer.send(AUTOTYPE_MVP_IPC_CHANNELS.TOGGLE, enable);
  },
  listenRequest: (
    fn: (
      data: {
        windowTitle: string;
        processName: string;
        processPath: string;
        hwnd: number;
        isGlobalSearch: boolean;
      },
      completeCallback: (error: Error | null, response: AutotypeVaultData | null) => void,
    ) => void,
  ) => {
    ipcRenderer.on(
      AUTOTYPE_MVP_IPC_CHANNELS.LISTEN,
      (
        _event,
        data: {
          windowTitle: string;
          processName: string;
          processPath: string;
          hwnd: number;
          isGlobalSearch: boolean;
        },
      ) => {
        fn(data, (error, vaultData) => {
          if (error) {
            const matchError: AutotypeMatchError = {
              windowTitle: data.windowTitle,
              errorMessage: error.message,
            };
            ipcRenderer.send(AUTOTYPE_MVP_IPC_CHANNELS.EXECUTION_ERROR, matchError);
            return;
          }

          if (vaultData !== null) {
            ipcRenderer.send(AUTOTYPE_MVP_IPC_CHANNELS.EXECUTE, vaultData);
          }
        });
      },
    );
  },
  getRunningWindows: (): Promise<any[]> => {
    return ipcRenderer.invoke(AUTOTYPE_MVP_IPC_CHANNELS.GET_RUNNING_WINDOWS);
  },
  captureWindow: (): Promise<any | null> => {
    return ipcRenderer.invoke(AUTOTYPE_MVP_IPC_CHANNELS.CAPTURE_WINDOW);
  },
  openPicker: (data: any) => {
    ipcRenderer.send(AUTOTYPE_MVP_IPC_CHANNELS.OPEN_PICKER, data);
  },
  closePicker: () => {
    ipcRenderer.send(AUTOTYPE_MVP_IPC_CHANNELS.CLOSE_PICKER);
  },
  selectPicker: (data: any) => {
    ipcRenderer.send(
      AUTOTYPE_MVP_IPC_CHANNELS.PICKER_SELECT,
      Array.isArray(data) ? { tokens: data } : data,
    );
  },
  executeSequence: (data: { hwnd: number; tokens: any[]; useTcato: boolean }) => {
    ipcRenderer.send(AUTOTYPE_MVP_IPC_CHANNELS.EXECUTE_SEQUENCE, data);
  },
  onPickerInitData: (fn: (data: any) => void) => {
    ipcRenderer.on(AUTOTYPE_MVP_IPC_CHANNELS.PICKER_INIT_DATA, (_event, data) => fn(data));
  },
  onPickerItemChosen: (
    fn: (data: { cipherId: string; targetWindow: any; useTcato: boolean }) => void,
  ) => {
    ipcRenderer.on(AUTOTYPE_MVP_IPC_CHANNELS.PICKER_ITEM_CHOSEN, (_event, data) => fn(data));
  },
  copyPickerField: (data: {
    cipherId: string;
    field: "username" | "password" | "totp" | "url";
  }): Promise<{ success: boolean; message: string; timeoutSec?: number | null }> => {
    return ipcRenderer.invoke(AUTOTYPE_MVP_IPC_CHANNELS.PICKER_COPY_FIELD, data);
  },
  editPickerCipher: (data: { cipherId: string }) => {
    ipcRenderer.send(AUTOTYPE_MVP_IPC_CHANNELS.PICKER_EDIT_CIPHER, data);
  },
  clearClipboard: () => {
    ipcRenderer.send(AUTOTYPE_MVP_IPC_CHANNELS.PICKER_CLEAR_CLIPBOARD);
  },
  onPickerClearClipboard: (fn: () => void) => {
    ipcRenderer.on(AUTOTYPE_MVP_IPC_CHANNELS.PICKER_CLEAR_CLIPBOARD, () => fn());
  },
  onPickerCopyField: (
    fn: (data: { cipherId: string; field: string; replyChannel: string }) => void,
  ) => {
    ipcRenderer.on(AUTOTYPE_MVP_IPC_CHANNELS.PICKER_COPY_FIELD, (_event, data) => fn(data));
  },
  onPickerEditCipher: (fn: (data: { cipherId: string }) => void) => {
    ipcRenderer.on(AUTOTYPE_MVP_IPC_CHANNELS.PICKER_EDIT_CIPHER, (_event, data) => fn(data));
  },
  sendThemeChanged: (theme: string) => {
    ipcRenderer.send(AUTOTYPE_MVP_IPC_CHANNELS.PICKER_THEME_CHANGED, { theme });
  },
  onPickerThemeChanged: (fn: (data: { theme: string }) => void) => {
    ipcRenderer.on(AUTOTYPE_MVP_IPC_CHANNELS.PICKER_THEME_CHANGED, (_event, data) => fn(data));
  },
  sendReply: (channel: string, data: any) => {
    ipcRenderer.send(channel, data);
  },
};

export default {
  desktopAutofill: DesktopAutofillPreload,

  sshAgent,

  autotypeMvp,
};
