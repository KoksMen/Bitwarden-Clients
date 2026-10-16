namespace Bitwarden.Autotype.Services;

using System.Diagnostics;
using System.IO;
using Bitwarden.Autotype.Models;
using Bitwarden.Autotype.Native;

public sealed class WindowService
{
    public static bool IsExcludedProcess(string? processName)
    {
        if (string.IsNullOrWhiteSpace(processName))
        {
            return true;
        }

        string name = processName.Trim().ToLowerInvariant();
        if (name.EndsWith(".exe", StringComparison.OrdinalIgnoreCase))
        {
            name = name[..^4];
        }

        if (name.Contains("bitwarden", StringComparison.OrdinalIgnoreCase) ||
            name.Contains("autotypehelper", StringComparison.OrdinalIgnoreCase) ||
            name.Equals("electron", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        return name switch
        {
            "svchost" or "conhost" or "dwm" or "sihost" or "taskhostw" or
            "runtimebroker" or "shellexperiencehost" or "searchhost" or
            "searchapp" or "startmenuexperiencehost" or "textinputhost" or
            "applicationframehost" or "systemsettings" or "lockapp" or
            "fontdrvhost" or "ctfmon" or "smss" or "csrss" or "wininit" or
            "winlogon" or "lsass" or "services" or "spoolsv" => true,
            _ => false
        };
    }

    public WindowInfo? GetActiveWindow()
    {
        nint hwnd = Win32.GetForegroundWindow();
        if (hwnd == 0)
        {
            return null;
        }

        return ResolveWindow(hwnd);
    }

    public IReadOnlyList<WindowInfo> ListRunningWindows()
    {
        var list = new Dictionary<string, WindowInfo>(StringComparer.OrdinalIgnoreCase);
        int currentSession = Process.GetCurrentProcess().SessionId;
        uint currentPid = (uint)Process.GetCurrentProcess().Id;

        // 1. Enumerate visible top-level windows with handles
        Win32.EnumWindows((hwnd, _) =>
        {
            if (!Win32.IsWindowVisible(hwnd))
            {
                return true;
            }

            int exStyle = Win32.GetWindowLongW(hwnd, Win32.GWL_EXSTYLE);
            if ((exStyle & Win32.WS_EX_TOOLWINDOW) != 0)
            {
                return true;
            }

            var info = ResolveWindow(hwnd);
            if (info != null && info.Pid != currentPid && !IsExcludedProcess(info.ProcessName))
            {
                string key = $"{info.ProcessName}::{info.WindowTitle}";
                if (!list.ContainsKey(key))
                {
                    list[key] = info;
                }
            }

            return true;
        }, 0);

        // 2. Also incorporate running user-session processes so that every running app is available in the dropdown
        try
        {
            foreach (var proc in Process.GetProcesses())
            {
                try
                {
                    if (proc.SessionId != currentSession || proc.Id == currentPid)
                    {
                        continue;
                    }

                    string procName = proc.ProcessName + ".exe";
                    if (IsExcludedProcess(procName))
                    {
                        continue;
                    }

                    string title = proc.MainWindowTitle;
                    nint hwnd = proc.MainWindowHandle;
                    string key = $"{procName}::{title}";

                    if (!list.ContainsKey(key))
                    {
                        string path = string.Empty;
                        try { path = proc.MainModule?.FileName ?? string.Empty; } catch { }

                        list[key] = new WindowInfo(hwnd, title, procName, path, (uint)proc.Id);
                    }
                }
                catch
                {
                    // Ignore access denied for protected system processes
                }
                finally
                {
                    proc.Dispose();
                }
            }
        }
        catch
        {
            // Session process enumeration fallback
        }

        return list.Values
            .OrderByDescending(w => !string.IsNullOrEmpty(w.WindowTitle))
            .ThenBy(w => !string.IsNullOrEmpty(w.WindowTitle) ? w.WindowTitle : w.ProcessName, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    public static WindowInfo? ResolveWindow(nint hwnd)
    {
        int titleLength = Win32.GetWindowTextLengthW(hwnd);
        string title = string.Empty;
        if (titleLength > 0)
        {
            char[] titleBuffer = new char[titleLength + 1];
            int read = Win32.GetWindowTextW(hwnd, titleBuffer, titleBuffer.Length);
            title = new string(titleBuffer, 0, Math.Max(0, read)).Trim();
        }

        Win32.GetWindowThreadProcessId(hwnd, out uint pid);
        if (pid == 0)
        {
            return new WindowInfo(hwnd, title, string.Empty, string.Empty, 0);
        }

        string fullPath = string.Empty;
        string procName = string.Empty;

        using (var safeHandle = Win32.OpenProcess(Win32.PROCESS_QUERY_LIMITED_INFORMATION, false, pid))
        {
            if (!safeHandle.IsInvalid)
            {
                char[] pathBuffer = new char[1024];
                uint size = (uint)pathBuffer.Length;
                if (Win32.QueryFullProcessImageNameW(safeHandle, 0, pathBuffer, ref size))
                {
                    fullPath = new string(pathBuffer, 0, (int)size);
                    procName = Path.GetFileName(fullPath);
                }
            }
        }

        if (string.IsNullOrEmpty(procName))
        {
            try
            {
                using var proc = Process.GetProcessById((int)pid);
                procName = proc.ProcessName + ".exe";
            }
            catch
            {
                // Process may have exited or access denied
            }
        }

        return new WindowInfo(hwnd, title, procName, fullPath, pid);
    }

    public bool FocusWindow(nint hwnd)
    {
        if (hwnd == 0 || !Win32.IsWindow(hwnd))
        {
            return false;
        }

        nint foreground = Win32.GetForegroundWindow();
        if (foreground == hwnd)
        {
            return true;
        }

        uint targetThread = Win32.GetWindowThreadProcessId(hwnd, out _);
        uint currentThread = Win32.GetCurrentThreadId();
        uint foregroundThread = foreground != 0 ? Win32.GetWindowThreadProcessId(foreground, out _) : 0;

        bool attachedToTarget = false;
        bool attachedToForeground = false;

        Win32.AllowSetForegroundWindow(Win32.ASFW_ANY);

        if (targetThread != 0 && targetThread != currentThread)
        {
            attachedToTarget = Win32.AttachThreadInput(currentThread, targetThread, true);
        }

        if (foregroundThread != 0 && foregroundThread != currentThread)
        {
            attachedToForeground = Win32.AttachThreadInput(currentThread, foregroundThread, true);
        }

        try
        {
            if (Win32.IsIconic(hwnd))
            {
                Win32.ShowWindow(hwnd, 9); // SW_RESTORE
            }

            Win32.BringWindowToTop(hwnd);
            bool result = Win32.SetForegroundWindow(hwnd);

            // Wait a brief moment for Windows to switch focus
            for (int i = 0; i < 10 && Win32.GetForegroundWindow() != hwnd; i++)
            {
                Thread.Sleep(20);
                Win32.SetForegroundWindow(hwnd);
            }

            return result;
        }
        finally
        {
            if (attachedToForeground)
            {
                Win32.AttachThreadInput(currentThread, foregroundThread, false);
            }
            if (attachedToTarget)
            {
                Win32.AttachThreadInput(currentThread, targetThread, false);
            }
        }
    }
}
