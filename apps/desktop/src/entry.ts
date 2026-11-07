// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";

import { app } from "electron";

import { DEV_ICON_FILE, isDev } from "./utils";

app.setName("Bitwarden");
if (process.platform === "win32") {
  // If running as a packaged app without package identity,
  // relaunch via shell:AppsFolder so Windows grants full AppModel identity (required for Windows Hello passkeys).
  if (app.isPackaged && !process.windowsStore && !process.argv.includes("--no-package-relaunch")) {
    const manifestPath = path.join(path.dirname(process.execPath), "AppxManifest.xml");
    const parentManifestPath = path.join(path.dirname(process.execPath), "..", "AppxManifest.xml");
    if (fs.existsSync(manifestPath) || fs.existsSync(parentManifestPath)) {
      try {
        const aumid = "8bitSolutionsLLC.bitwardendesktop_h4e712dmw3xyy!bitwardendesktop";
        const args = [
          `shell:AppsFolder\\${aumid}`,
          "--no-package-relaunch",
          ...process.argv.slice(1),
        ];
        const child = spawn("explorer.exe", args, { detached: true, stdio: "ignore" });
        child.unref();
        process.exit(0);
      } catch {
        // Fallback: proceed un-packaged if relaunch failed
      }
    }
  }

  // Set this before the first BrowserWindow is created so Windows uses the
  // Bitwarden identity in the taskbar, jump list, notifications, and pinned shortcuts.
  if (!process.windowsStore) {
    app.setAppUserModelId("com.bitwarden.desktop");
  }
}

if (
  process.platform === "darwin" &&
  process.argv.some((arg) => arg.indexOf("chrome-extension://") !== -1 || arg.indexOf("{") !== -1)
) {
  // If we're on MacOS, we need to support DuckDuckGo's IPC communication,
  // which for the moment is launching the Bitwarden process.
  // Ideally the browser would instead startup the desktop_proxy process
  // when available, but for now we'll just launch it here.

  app.on("ready", () => {
    app.dock.hide();
  });

  const proc = spawn(
    path.join(process.execPath, "..", "desktop_proxy.inherit"),
    process.argv.slice(1),
    {
      cwd: process.cwd(),
      stdio: "inherit",
      shell: false,
    },
  );

  proc.on("exit", (...args) => {
    // eslint-disable-next-line no-console
    console.error("Proxy process exited", args);
    process.exit(0);
  });
  proc.on("error", (...args) => {
    // eslint-disable-next-line no-console
    console.error("Proxy process errored", args);
    process.exit(1);
  });
} else {
  // macOS draws no window icon, so the dock is the only place a dev client can be told apart
  // from an installed one. __dirname is the build output directory at runtime.
  if (isDev() && process.platform === "darwin") {
    const devIcon = path.join(__dirname, "images", DEV_ICON_FILE);

    void app.whenReady().then(() => app.dock.setIcon(devIcon));
  }

  // eslint-disable-next-line
  const Main = require("./main").Main;

  const main = new Main();
  main.bootstrap();
}
