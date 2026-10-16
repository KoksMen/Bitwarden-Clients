namespace Bitwarden.Autotype.Services;

using System.Diagnostics;
using System.Threading;
using Bitwarden.Autotype.Models;
using Bitwarden.Autotype.Native;

public sealed class WindowCaptureService
{
    public WindowInfo? CaptureInteractive(int timeoutSeconds = 20)
    {
        uint currentPid = (uint)Process.GetCurrentProcess().Id;
        var deadline = DateTime.UtcNow.AddSeconds(timeoutSeconds);

        // Wait for initial mouse button release if already pressed
        while ((Win32.GetAsyncKeyState(Win32.VK_LBUTTON) & 0x8000) != 0)
        {
            Thread.Sleep(20);
            if (DateTime.UtcNow > deadline)
            {
                return null;
            }
        }

        while (DateTime.UtcNow < deadline)
        {
            if ((Win32.GetAsyncKeyState(Win32.VK_ESCAPE) & 0x8000) != 0)
            {
                // User cancelled via Esc
                return null;
            }

            if ((Win32.GetAsyncKeyState(Win32.VK_LBUTTON) & 0x8000) != 0)
            {
                // Left click detected!
                if (Win32.GetCursorPos(out var pt))
                {
                    nint rawHwnd = Win32.WindowFromPoint(pt);
                    if (rawHwnd != 0)
                    {
                        nint rootHwnd = Win32.GetAncestor(rawHwnd, Win32.GA_ROOT);
                        nint target = rootHwnd != 0 ? rootHwnd : rawHwnd;

                        var info = WindowService.ResolveWindow(target);
                        if (info != null && info.Pid != currentPid && !WindowService.IsExcludedProcess(info.ProcessName))
                        {
                            return info;
                        }
                    }
                }

                // If clicked self or invalid/excluded process, wait for button release and continue
                while ((Win32.GetAsyncKeyState(Win32.VK_LBUTTON) & 0x8000) != 0)
                {
                    Thread.Sleep(20);
                }
            }

            Thread.Sleep(25);
        }

        return null;
    }
}
