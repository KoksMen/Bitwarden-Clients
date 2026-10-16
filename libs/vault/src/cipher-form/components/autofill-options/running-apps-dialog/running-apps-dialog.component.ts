import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
  OnInit,
} from "@angular/core";
import { FormsModule } from "@angular/forms";

import {
  ButtonModule,
  CenterPositionStrategy,
  DialogModule,
  DialogRef,
  DialogService,
} from "@bitwarden/components";

export interface RunningAppItem {
  hwnd: number;
  windowTitle: string;
  processName: string;
  processPath: string;
  pid: number;
}

@Component({
  selector: "vault-running-apps-dialog",
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, DialogModule],
  templateUrl: "./running-apps-dialog.component.html",
  styles: [
    `
      .running-apps-container {
        display: flex;
        flex-direction: column;
        gap: 14px;
        width: 100%;
        min-width: 520px;
        max-width: 680px;
        text-align: left;
        box-sizing: border-box;
      }
      .search-box {
        position: relative;
        display: flex;
        align-items: center;
        width: 100%;
      }
      .search-box .search-icon {
        position: absolute;
        left: 12px;
        font-size: 14px;
        opacity: 0.6;
        pointer-events: none;
      }
      .search-box .filter-input {
        width: 100%;
        padding: 10px 36px 10px 38px;
        border-radius: 8px;
        border: 1px solid rgba(255, 255, 255, 0.15);
        background: rgba(0, 0, 0, 0.3);
        color: #f4f4f5;
        font-size: 13.5px;
        outline: none;
        box-sizing: border-box;
        transition:
          border-color 0.15s,
          box-shadow 0.15s;
      }
      .search-box .filter-input:focus {
        border-color: #3b82f6;
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.25);
      }
      .search-box .clear-btn {
        position: absolute;
        right: 10px;
        background: transparent;
        border: none;
        color: #a1a1aa;
        font-size: 13px;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
      }
      .search-box .clear-btn:hover {
        color: #f4f4f5;
        background: rgba(255, 255, 255, 0.1);
      }
      .state-container {
        padding: 40px 16px;
        text-align: center;
        color: #a1a1aa;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 6px;
      }
      .state-container .state-icon {
        font-size: 26px;
        margin-bottom: 4px;
      }
      .state-container .state-title {
        font-size: 14px;
        font-weight: 500;
        color: #d4d4d8;
      }
      .state-container .state-subtitle {
        font-size: 12px;
        color: #71717a;
      }
      .apps-list {
        max-height: 380px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding-right: 4px;
      }
      .apps-list::-webkit-scrollbar {
        width: 6px;
      }
      .apps-list::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.2);
        border-radius: 3px;
      }
      .apps-list .app-row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 14px;
        border-radius: 8px;
        cursor: pointer;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.06);
        text-align: left;
        transition:
          background 0.12s,
          border-color 0.12s;
      }
      .apps-list .app-row:hover {
        background: rgba(59, 130, 246, 0.12);
        border-color: rgba(59, 130, 246, 0.35);
      }
      .apps-list .app-row .proc-icon {
        font-size: 18px;
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(255, 255, 255, 0.06);
        border-radius: 8px;
        flex-shrink: 0;
      }
      .apps-list .app-row .app-info {
        flex: 1;
        min-width: 0;
        text-align: left;
      }
      .apps-list .app-row .app-info .proc-line {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .apps-list .app-row .app-info .proc-line .proc-name {
        font-size: 13.5px;
        font-weight: 600;
        color: #60a5fa;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      }
      .apps-list .app-row .app-info .proc-line .app-pid {
        font-size: 11px;
        color: #a1a1aa;
        background: rgba(255, 255, 255, 0.06);
        padding: 1px 6px;
        border-radius: 4px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      }
      .apps-list .app-row .app-info .title-line {
        font-size: 12.5px;
        color: #f4f4f5;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        margin-top: 2px;
        font-weight: 500;
      }
      .apps-list .app-row .app-info .path-line {
        font-size: 11px;
        color: #71717a;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        margin-top: 2px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      }
      .apps-list .app-row .action-btn-col {
        flex-shrink: 0;
        opacity: 0.85;
      }
      .apps-list .app-row:hover .action-btn-col {
        opacity: 1;
      }
      .footer-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
      }
      .footer-row .count-badge {
        font-size: 12px;
        color: #a1a1aa;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RunningAppsDialogComponent implements OnInit {
  protected readonly dialogRef = inject<DialogRef<RunningAppItem | null>>(DialogRef);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly searchQuery = "";
  readonly isLoading = true;
  readonly allApps: RunningAppItem[] = [];
  readonly filteredApps: RunningAppItem[] = [];

  static open(dialogService: DialogService): DialogRef<RunningAppItem | null> {
    return dialogService.open<RunningAppItem | null>(RunningAppsDialogComponent, {
      positionStrategy: new CenterPositionStrategy(),
    });
  }

  async ngOnInit() {
    try {
      if ((window as any).ipc?.autofill?.autotypeMvp?.getRunningWindows) {
        const apps = await (window as any).ipc.autofill.autotypeMvp.getRunningWindows();
        const rawList = Array.isArray(apps) ? apps : [];
        this.allApps = rawList.filter((app) => {
          const name = (app.processName || "").toLowerCase();
          return (
            !name.includes("bitwarden") &&
            !name.includes("electron") &&
            !name.includes("autotypehelper")
          );
        });
      }
    } catch {
      this.allApps = [];
    } finally {
      this.isLoading = false;
      this.applyFilter();
      this.cdr.markForCheck();
    }
  }

  onSearchChange() {
    this.applyFilter();
  }

  private applyFilter() {
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) {
      this.filteredApps = [...this.allApps];
    } else {
      this.filteredApps = this.allApps.filter(
        (app) =>
          (app.processName && app.processName.toLowerCase().includes(q)) ||
          (app.windowTitle && app.windowTitle.toLowerCase().includes(q)) ||
          (app.processPath && app.processPath.toLowerCase().includes(q)),
      );
    }
  }

  select(app: RunningAppItem) {
    void this.dialogRef.close(app);
  }

  cancel() {
    void this.dialogRef.close(null);
  }
}
