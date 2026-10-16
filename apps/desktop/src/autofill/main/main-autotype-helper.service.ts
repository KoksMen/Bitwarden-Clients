import { ChildProcess, spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

import { app } from "electron";

import { LogService } from "@bitwarden/logging";

export interface WindowInfo {
  hwnd: number;
  windowTitle: string;
  processName: string;
  processPath: string;
  pid: number;
}

export interface SequenceToken {
  type: "text" | "key" | "delay";
  value?: string;
  key?: string;
  milliseconds?: number;
  isSensitive?: boolean;
}

export interface SequenceRequest {
  hwnd: number;
  tokens: SequenceToken[];
  useTcato: boolean;
}

interface DaemonResponse {
  id: string;
  success: boolean;
  data?: any;
  error?: string;
}

export class MainAutotypeHelperService {
  private childProcess: ChildProcess | null = null;
  private pendingRequests = new Map<
    string,
    { resolve: (value: any) => void; reject: (err: any) => void; timeout: NodeJS.Timeout }
  >();
  private requestCounter = 0;
  private helperPath: string | null = null;

  constructor(private logService: LogService) {
    this.findHelperExecutable();
    this.startDaemon();
  }

  private findHelperExecutable(): string | null {
    const candidates = [
      path.join(process.resourcesPath || "", "AutotypeHelper.exe"),
      path.join(path.dirname(process.execPath), "AutotypeHelper.exe"),
      path.join(app.getAppPath(), "resources", "autotype-helper", "AutotypeHelper.exe"),
      path.join(__dirname, "../../resources/autotype-helper/AutotypeHelper.exe"),
      path.join(process.cwd(), "apps/desktop/resources/autotype-helper/AutotypeHelper.exe"),
      path.join(process.cwd(), "resources/autotype-helper/AutotypeHelper.exe"),
    ];

    for (const cand of candidates) {
      if (fs.existsSync(cand)) {
        this.helperPath = cand;
        this.logService.info("Found AutotypeHelper executable at: " + cand);
        return cand;
      }
    }

    this.logService.info("AutotypeHelper.exe was not found in standard paths.");
    return null;
  }

  private startDaemon() {
    if (!this.helperPath) {
      return;
    }

    try {
      this.childProcess = spawn(this.helperPath, ["daemon"], {
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
      });

      if (!this.childProcess.stdout || !this.childProcess.stdin) {
        return;
      }

      const rl = readline.createInterface({ input: this.childProcess.stdout });
      rl.on("line", (line) => {
        try {
          const resp: DaemonResponse = JSON.parse(line);
          const pending = this.pendingRequests.get(resp.id);
          if (pending) {
            clearTimeout(pending.timeout);
            this.pendingRequests.delete(resp.id);
            if (resp.success) {
              pending.resolve(resp.data);
            } else {
              pending.reject(new Error(resp.error || "Daemon command failed"));
            }
          }
        } catch (e) {
          this.logService.error("Failed to parse response line from AutotypeHelper: " + line, e);
        }
      });

      this.childProcess.on("exit", (code) => {
        this.logService.info(`AutotypeHelper daemon exited with code ${code}.`);
        this.childProcess = null;
        for (const [, req] of this.pendingRequests) {
          clearTimeout(req.timeout);
          req.reject(new Error("AutotypeHelper process terminated."));
        }
        this.pendingRequests.clear();
      });

      this.childProcess.on("error", (err) => {
        this.logService.error("AutotypeHelper process error", err);
      });
    } catch (err) {
      this.logService.error("Failed to spawn AutotypeHelper daemon", err);
    }
  }

  private sendCommand<T>(
    cmd: string,
    args: { hwnd?: number; payload?: any } = {},
    timeoutMs = 25000,
  ): Promise<T> {
    if (!this.childProcess || !this.childProcess.stdin || this.childProcess.killed) {
      this.startDaemon();
    }

    if (!this.childProcess || !this.childProcess.stdin) {
      return Promise.reject(new Error("AutotypeHelper daemon is not running"));
    }

    const id = (++this.requestCounter).toString();
    const commandPayload = {
      id,
      cmd,
      hwnd: args.hwnd,
      payload: args.payload,
    };

    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`AutotypeHelper command '${cmd}' timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pendingRequests.set(id, { resolve, reject, timeout });

      try {
        this.childProcess!.stdin!.write(JSON.stringify(commandPayload) + "\n");
      } catch (err) {
        clearTimeout(timeout);
        this.pendingRequests.delete(id);
        reject(err);
      }
    });
  }

  async getActiveWindow(): Promise<WindowInfo | null> {
    try {
      return await this.sendCommand<WindowInfo | null>("get-active");
    } catch (e) {
      this.logService.error("Error in getActiveWindow", e);
      return null;
    }
  }

  async listRunningWindows(): Promise<WindowInfo[]> {
    try {
      const list = await this.sendCommand<WindowInfo[]>("list-running");
      return Array.isArray(list) ? list : [];
    } catch (e) {
      this.logService.error("Error in listRunningWindows", e);
      return [];
    }
  }

  async captureWindow(): Promise<WindowInfo | null> {
    try {
      return await this.sendCommand<WindowInfo | null>("capture-window", {}, 25000);
    } catch (e) {
      this.logService.error("Error in captureWindow", e);
      return null;
    }
  }

  async focusWindow(hwnd: number): Promise<boolean> {
    try {
      return await this.sendCommand<boolean>("focus-window", { hwnd }, 3000);
    } catch (e) {
      this.logService.error("Error in focusWindow", e);
      return false;
    }
  }

  async typeSequence(request: SequenceRequest): Promise<boolean> {
    try {
      return await this.sendCommand<boolean>("type-sequence", { payload: request }, 60000);
    } catch (e) {
      this.logService.error("Error in typeSequence", e);
      return false;
    }
  }

  dispose() {
    if (this.childProcess && !this.childProcess.killed) {
      this.childProcess.kill();
      this.childProcess = null;
    }
    for (const [, req] of this.pendingRequests) {
      clearTimeout(req.timeout);
      req.reject(new Error("Disposed"));
    }
    this.pendingRequests.clear();
  }
}
