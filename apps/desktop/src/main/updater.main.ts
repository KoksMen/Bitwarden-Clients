import { dialog } from "electron";
import log from "electron-log";
import { autoUpdater, VerifyUpdateSupport } from "electron-updater";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/logging";

import { isAppImage, isDev, isMacAppStore, isWindowsPortable, isWindowsStore } from "../utils";

import { WindowMain } from "./window.main";

const UpdaterCheckInitialDelay = 5 * 1000; // 5 seconds
const UpdaterCheckInterval = 12 * 60 * 60 * 1000; // 12 hours

export class UpdaterMain {
  private doingUpdateCheck = false;
  private doingUpdateCheckWithFeedback = false;
  private canUpdate = false;
  private originalRolloutFunction: VerifyUpdateSupport | null = null;

  constructor(
    private i18nService: I18nService,
    private logService: LogService,
    private windowMain: WindowMain,
  ) {
    autoUpdater.logger = log;
    // This is a source-built fork. Updates must never be downloaded or installed
    // over the customized application.
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;

    this.originalRolloutFunction = autoUpdater.isUserWithinRollout;

    const linuxCanUpdate = process.platform === "linux" && isAppImage();
    const windowsCanUpdate =
      process.platform === "win32" && !isWindowsStore() && !isWindowsPortable();
    const macCanUpdate = process.platform === "darwin" && !isMacAppStore();
    this.canUpdate =
      !this.userDisabledUpdates() && (linuxCanUpdate || windowsCanUpdate || macCanUpdate);
  }

  async init() {
    global.setTimeout(async () => await this.checkForUpdate(), UpdaterCheckInitialDelay);
    global.setInterval(async () => await this.checkForUpdate(), UpdaterCheckInterval);

    autoUpdater.on("checking-for-update", () => {
      this.doingUpdateCheck = true;
    });

    autoUpdater.on("update-available", async () => {
      await this.showForkUpdateInstructions();
      this.reset();
    });

    autoUpdater.on("update-not-available", async () => {
      if (this.doingUpdateCheckWithFeedback && this.windowMain.win != null) {
        await dialog.showMessageBox(this.windowMain.win, {
          message: this.i18nService.t("noUpdatesAvailable"),
          buttons: [this.i18nService.t("ok")],
          defaultId: 0,
          noLink: true,
        });
      }

      this.reset();
    });

    autoUpdater.on("update-downloaded", async () => {
      // A previously cached official update must not be installed over this fork.
      this.logService.warning("Ignoring a downloaded update in the source-built fork");
      await this.showForkUpdateInstructions();
      this.reset();
    });

    autoUpdater.on("error", (error) => {
      if (this.doingUpdateCheckWithFeedback) {
        dialog.showErrorBox(
          this.i18nService.t("updateError"),
          error == null ? this.i18nService.t("unknown") : (error.stack || error).toString(),
        );
      }

      this.reset();
    });
  }

  async checkForUpdate(withFeedback = false) {
    if (isDev()) {
      return;
    }

    if (this.doingUpdateCheck) {
      return;
    }

    if (!this.canUpdate) {
      if (withFeedback) {
        await this.showForkUpdateInstructions();
      }

      return;
    }

    this.doingUpdateCheckWithFeedback = withFeedback;
    if (withFeedback) {
      // If the user has explicitly checked for updates, we want to bypass
      // the current staging rollout percentage
      autoUpdater.isUserWithinRollout = (info) => true;
    }

    await autoUpdater.checkForUpdates();
  }

  private reset() {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
    // Reset the rollout check to the default behavior
    if (this.originalRolloutFunction != null) {
      autoUpdater.isUserWithinRollout = this.originalRolloutFunction;
    }
    this.doingUpdateCheck = false;
  }

  private async showForkUpdateInstructions() {
    if (this.windowMain.win == null) {
      this.logService.info(this.i18nService.t("updateAvailableDesc"));
      return;
    }

    await dialog.showMessageBox(this.windowMain.win, {
      type: "info",
      title: this.i18nService.t("bitwarden") + " - " + this.i18nService.t("updateAvailable"),
      message: this.i18nService.t("updateAvailable"),
      detail: this.i18nService.t("updateAvailableDesc"),
      buttons: [this.i18nService.t("ok")],
      defaultId: 0,
      noLink: true,
    });
  }

  private userDisabledUpdates(): boolean {
    for (const arg of process.argv) {
      if (arg != null && arg.toUpperCase().indexOf("--ELECTRON_NO_UPDATER=1") > -1) {
        return true;
      }
      if (arg != null && arg.toUpperCase().indexOf("--BITWARDEN_NO_UPDATER=1") > -1) {
        return true;
      }
    }
    return process.env.ELECTRON_NO_UPDATER === "1" || process.env.BITWARDEN_NO_UPDATER === "1";
  }
}
