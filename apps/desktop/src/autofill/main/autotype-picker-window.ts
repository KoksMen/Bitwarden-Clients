import * as fs from "fs";
import * as path from "path";
import * as url from "url";

import { BrowserWindow, screen } from "electron";

import { LogService } from "@bitwarden/logging";

import { AUTOTYPE_MVP_IPC_CHANNELS } from "../models/ipc-channels";

import {
  WindowInfo,
  SequenceToken,
  MainAutotypeHelperService,
} from "./main-autotype-helper.service";

export interface AutotypePickerItem {
  id: string;
  name: string;
  username: string;
  matchType: "process" | "title" | "search";
  matchBadge?: string;
  sequencePreview: string;
}

export interface AutotypePickerOpenOptions {
  targetWindow: WindowInfo;
  mode: "picker" | "search";
  initialQuery?: string;
  positionMode?: "center" | "cursor";
  useTcato?: boolean;
  items?: AutotypePickerItem[];
}

export class AutotypePickerWindow {
  private win: BrowserWindow | null = null;
  private currentTargetWindow: WindowInfo | null = null;
  private currentUseTcato: boolean = false;

  constructor(
    private logService: LogService,
    private helperService: MainAutotypeHelperService,
  ) {}

  getCurrentTargetWindow(): WindowInfo | null {
    return this.currentTargetWindow;
  }

  getCurrentUseTcato(): boolean {
    return this.currentUseTcato;
  }

  private getPickerUrl(): string {
    const candidates = [
      path.join(__dirname, "picker.html"),
      path.join(__dirname, "resources", "autotype-picker", "picker.html"),
      path.join(process.resourcesPath || "", "autotype-picker", "picker.html"),
      path.join(process.resourcesPath || "", "app.asar", "picker.html"),
    ];

    for (const p of candidates) {
      if (p && fs.existsSync(p)) {
        return url.format({
          protocol: "file:",
          pathname: p,
          slashes: true,
        });
      }
    }

    return url.format({
      protocol: "file:",
      pathname: path.join(__dirname, "picker.html"),
      slashes: true,
    });
  }

  async open(options: AutotypePickerOpenOptions) {
    this.currentTargetWindow = options.targetWindow;
    this.currentUseTcato = options.useTcato ?? false;

    if (this.win == null || this.win.isDestroyed()) {
      this.win = new BrowserWindow({
        width: 540,
        height: 400,
        frame: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        show: false,
        backgroundColor: "#18181b",
        webPreferences: {
          preload: path.join(__dirname, "preload.js"),
          contextIsolation: true,
          nodeIntegration: false,
          spellcheck: false,
        },
      });

      this.win.on("blur", () => {
        // Auto-close on blur if user clicks elsewhere
        this.close();
      });

      await this.win.loadURL(this.getPickerUrl());
    }

    this.positionWindow(options.positionMode ?? "center");

    this.win.show();
    this.win.focus();

    // Send initialization data to the picker view
    this.win.webContents.send(AUTOTYPE_MVP_IPC_CHANNELS.PICKER_INIT_DATA, {
      targetWindow: options.targetWindow,
      mode: options.mode,
      initialQuery: options.initialQuery || "",
      items: options.items || [],
      useTcato: options.useTcato || false,
    });
  }

  close() {
    if (this.win && !this.win.isDestroyed()) {
      this.win.hide();
    }
  }

  private positionWindow(positionMode: "center" | "cursor") {
    if (!this.win) {
      return;
    }

    const width = 540;
    const height = 400;
    const cursorPoint = screen.getCursorScreenPoint();
    const currentDisplay = screen.getDisplayNearestPoint(cursorPoint);
    const workArea = currentDisplay.workArea;

    let x: number;
    let y: number;

    if (positionMode === "cursor") {
      x = Math.round(cursorPoint.x - width / 2);
      y = Math.round(cursorPoint.y - 20);

      // Clamp within work area
      x = Math.max(workArea.x + 10, Math.min(x, workArea.x + workArea.width - width - 10));
      y = Math.max(workArea.y + 10, Math.min(y, workArea.y + workArea.height - height - 10));
    } else {
      // Center on the active display
      x = Math.round(workArea.x + (workArea.width - width) / 2);
      y = Math.round(workArea.y + (workArea.height - height) / 2);
    }

    this.win.setBounds({ x, y, width, height });
  }

  async handlePickerSelect(tokens: SequenceToken[]) {
    this.close();

    if (!this.currentTargetWindow) {
      this.logService.info("handlePickerSelect called but no currentTargetWindow exists.");
      return;
    }

    const hwnd = this.currentTargetWindow.hwnd;
    this.logService.info(`Focusing window ${hwnd} and typing sequence...`);

    // Refocus target window
    await this.helperService.focusWindow(hwnd);

    // Short pause for focus switch
    await new Promise((r) => setTimeout(r, 120));

    // Execute sequence via helper (with TCATO if enabled)
    await this.helperService.typeSequence({
      hwnd,
      tokens,
      useTcato: this.currentUseTcato,
    });
  }

  dispose() {
    if (this.win && !this.win.isDestroyed()) {
      this.win.destroy();
      this.win = null;
    }
  }
}
