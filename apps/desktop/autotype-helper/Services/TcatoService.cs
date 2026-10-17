namespace Bitwarden.Autotype.Services;

using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Threading;
using Bitwarden.Autotype.Models;
using Bitwarden.Autotype.Native;

public sealed class TcatoService
{
    private readonly WindowService _windowService;

    public TcatoService(WindowService windowService)
    {
        _windowService = windowService;
    }

    public bool ExecuteSequence(SequenceRequest request)
    {
        if (request.Hwnd != 0)
        {
            _windowService.FocusWindow((nint)request.Hwnd);
            Thread.Sleep(150);
        }

        // Target window keyboard layout for accurate scan-code mapping
        uint targetThread = request.Hwnd != 0 ? Win32.GetWindowThreadProcessId((nint)request.Hwnd, out _) : 0;
        nint hkl = targetThread != 0 ? Win32.GetKeyboardLayout(targetThread) : Win32.GetKeyboardLayout(0);
        if (hkl == 0)
        {
            hkl = Win32.GetKeyboardLayout(0);
        }

        // Release any held modifier keys from hotkey activation
        ReleaseModifiers(hkl);
        Thread.Sleep(50);

        foreach (var token in request.Tokens)
        {
            switch (token.Type.ToLowerInvariant())
            {
                case "text":
                    if (!string.IsNullOrEmpty(token.Value))
                    {
                        if (token.IsSensitive && request.UseTcato)
                        {
                            TypeWithTcato(token.Value, hkl);
                        }
                        else
                        {
                            TypeNormal(token.Value, hkl);
                        }
                    }
                    break;

                case "key":
                    SendSpecialKey(token.Key, hkl);
                    break;

                case "clearfield":
                    SendClearField(hkl);
                    break;

                case "delay":
                    int ms = token.Milliseconds ?? 100;
                    Thread.Sleep(Math.Clamp(ms, 10, 10000));
                    break;
            }

            // Small breathing gap between tokens
            Thread.Sleep(30);
        }

        return true;
    }

    private static void ReleaseModifiers(nint hkl)
    {
        var modifiers = new[] { Win32.VK_CONTROL, Win32.VK_MENU, Win32.VK_SHIFT, Win32.VK_LWIN, Win32.VK_RWIN };
        foreach (var vk in modifiers)
        {
            if ((Win32.GetAsyncKeyState(vk) & 0x8000) != 0)
            {
                SendKeyUpScanCode(vk, hkl);
            }
        }
    }

    private static void TypeNormal(string text, nint hkl)
    {
        foreach (char c in text)
        {
            SendCharScanCode(c, hkl);
            Thread.Sleep(5);
        }
    }

    private static void TypeWithTcato(string sensitiveText, nint hkl)
    {
        string? previousClipboard = ReadClipboardText();
        char[] chars = sensitiveText.ToCharArray();

        try
        {
            var random = Random.Shared;
            int idx = 0;

            while (idx < chars.Length)
            {
                int chunkLen = Math.Min(random.Next(1, 4), chars.Length - idx);
                string chunk = new string(chars, idx, chunkLen);
                idx += chunkLen;

                bool useClipboard = random.Next(2) == 0;

                if (useClipboard)
                {
                    SetClipboardText(chunk);
                    Thread.Sleep(15);
                    SendPaste(hkl);
                    Thread.Sleep(25);
                }
                else
                {
                    foreach (char c in chunk)
                    {
                        SendCharScanCode(c, hkl);
                        Thread.Sleep(random.Next(5, 15));
                    }
                }
            }
        }
        finally
        {
            // Hygiene: zero out sensitive char array in memory
            Array.Clear(chars, 0, chars.Length);

            // Restore original clipboard
            Thread.Sleep(30);
            if (!string.IsNullOrEmpty(previousClipboard))
            {
                SetClipboardText(previousClipboard);
            }
            else
            {
                ClearClipboard();
            }
        }
    }

    /// <summary>
    /// Types a character using hardware Scan-codes (KEYEVENTF_SCANCODE) matching KeePassXC.
    /// If the character cannot be mapped to the current layout, falls back to KEYEVENTF_UNICODE.
    /// </summary>
    private static void SendCharScanCode(char c, nint hkl)
    {
        short res = Win32.VkKeyScanExW(c, hkl);
        if (res == -1)
        {
            // Fallback to unicode injection for characters outside the active layout
            SendUnicodeChar(c);
            return;
        }

        byte vk = (byte)(res & 0xFF);
        byte shiftState = (byte)((res >> 8) & 0xFF);

        bool shift = (shiftState & 1) != 0;
        bool ctrl = (shiftState & 2) != 0;
        bool alt = (shiftState & 4) != 0;

        if (shift) SendKeyDownScanCode(Win32.VK_SHIFT, hkl);
        if (ctrl) SendKeyDownScanCode(Win32.VK_CONTROL, hkl);
        if (alt) SendKeyDownScanCode(Win32.VK_MENU, hkl);

        SendKeyScanCode(vk, hkl);

        if (alt) SendKeyUpScanCode(Win32.VK_MENU, hkl);
        if (ctrl) SendKeyUpScanCode(Win32.VK_CONTROL, hkl);
        if (shift) SendKeyUpScanCode(Win32.VK_SHIFT, hkl);
    }

    private static void SendKeyScanCode(ushort vk, nint hkl, bool isExtended = false)
    {
        uint scan = Win32.MapVirtualKeyExW(vk, Win32.MAPVK_VK_TO_VSC_EX, hkl);
        if (scan == 0)
        {
            scan = Win32.MapVirtualKeyExW(vk, Win32.MAPVK_VK_TO_VSC, hkl);
        }

        bool ext = isExtended || (scan > 0xFF) || ((scan & 0xFF00) == 0xE000);
        ushort scanCode = (ushort)(scan & 0xFF);
        uint baseFlags = Win32.KEYEVENTF_SCANCODE | (ext ? Win32.KEYEVENTF_EXTENDEDKEY : 0);

        var inputs = new Win32.INPUT[2];
        // Down
        inputs[0].type = Win32.INPUT_KEYBOARD;
        inputs[0].mkhi.ki.wVk = 0;
        inputs[0].mkhi.ki.wScan = scanCode;
        inputs[0].mkhi.ki.dwFlags = baseFlags;

        // Up
        inputs[1].type = Win32.INPUT_KEYBOARD;
        inputs[1].mkhi.ki.wVk = 0;
        inputs[1].mkhi.ki.wScan = scanCode;
        inputs[1].mkhi.ki.dwFlags = baseFlags | Win32.KEYEVENTF_KEYUP;

        Win32.SendInput(2, inputs, Marshal.SizeOf<Win32.INPUT>());
    }

    private static void SendKeyDownScanCode(ushort vk, nint hkl, bool isExtended = false)
    {
        uint scan = Win32.MapVirtualKeyExW(vk, Win32.MAPVK_VK_TO_VSC_EX, hkl);
        if (scan == 0)
        {
            scan = Win32.MapVirtualKeyExW(vk, Win32.MAPVK_VK_TO_VSC, hkl);
        }

        bool ext = isExtended || (scan > 0xFF) || ((scan & 0xFF00) == 0xE000);
        ushort scanCode = (ushort)(scan & 0xFF);

        var inputs = new Win32.INPUT[1];
        inputs[0].type = Win32.INPUT_KEYBOARD;
        inputs[0].mkhi.ki.wVk = 0;
        inputs[0].mkhi.ki.wScan = scanCode;
        inputs[0].mkhi.ki.dwFlags = Win32.KEYEVENTF_SCANCODE | (ext ? Win32.KEYEVENTF_EXTENDEDKEY : 0);

        Win32.SendInput(1, inputs, Marshal.SizeOf<Win32.INPUT>());
    }

    private static void SendKeyUpScanCode(ushort vk, nint hkl, bool isExtended = false)
    {
        uint scan = Win32.MapVirtualKeyExW(vk, Win32.MAPVK_VK_TO_VSC_EX, hkl);
        if (scan == 0)
        {
            scan = Win32.MapVirtualKeyExW(vk, Win32.MAPVK_VK_TO_VSC, hkl);
        }

        bool ext = isExtended || (scan > 0xFF) || ((scan & 0xFF00) == 0xE000);
        ushort scanCode = (ushort)(scan & 0xFF);

        var inputs = new Win32.INPUT[1];
        inputs[0].type = Win32.INPUT_KEYBOARD;
        inputs[0].mkhi.ki.wVk = 0;
        inputs[0].mkhi.ki.wScan = scanCode;
        inputs[0].mkhi.ki.dwFlags = Win32.KEYEVENTF_SCANCODE | (ext ? Win32.KEYEVENTF_EXTENDEDKEY : 0) | Win32.KEYEVENTF_KEYUP;

        Win32.SendInput(1, inputs, Marshal.SizeOf<Win32.INPUT>());
    }

    /// <summary>
    /// Clears the active input field (KeePassXC {CLEARFIELD} equivalent: Ctrl+A followed by Backspace).
    /// </summary>
    private static void SendClearField(nint hkl)
    {
        // Select All (Ctrl+A)
        SendKeyDownScanCode(Win32.VK_CONTROL, hkl);
        Thread.Sleep(15);
        SendKeyScanCode(Win32.VK_A, hkl);
        Thread.Sleep(15);
        SendKeyUpScanCode(Win32.VK_CONTROL, hkl);
        Thread.Sleep(25);

        // Delete selection with Backspace
        SendKeyScanCode(Win32.VK_BACK, hkl);
        Thread.Sleep(25);
    }

    private static void SendUnicodeChar(char c)
    {
        var inputs = new Win32.INPUT[2];

        inputs[0].type = Win32.INPUT_KEYBOARD;
        inputs[0].mkhi.ki.wVk = 0;
        inputs[0].mkhi.ki.wScan = c;
        inputs[0].mkhi.ki.dwFlags = Win32.KEYEVENTF_UNICODE;

        inputs[1].type = Win32.INPUT_KEYBOARD;
        inputs[1].mkhi.ki.wVk = 0;
        inputs[1].mkhi.ki.wScan = c;
        inputs[1].mkhi.ki.dwFlags = Win32.KEYEVENTF_UNICODE | Win32.KEYEVENTF_KEYUP;

        Win32.SendInput((uint)inputs.Length, inputs, Marshal.SizeOf<Win32.INPUT>());
    }

    private static void SendSpecialKey(string? key, nint hkl)
    {
        if (string.IsNullOrWhiteSpace(key)) return;

        switch (key.ToLowerInvariant())
        {
            case "tab":
                SendKeyScanCode(Win32.VK_TAB, hkl);
                break;
            case "enter" or "return":
                SendKeyScanCode(Win32.VK_RETURN, hkl);
                break;
            case "space":
                SendKeyScanCode(Win32.VK_SPACE, hkl);
                break;
            case "backspace":
                SendKeyScanCode(Win32.VK_BACK, hkl);
                break;
            case "delete":
                SendKeyScanCode(Win32.VK_DELETE, hkl, isExtended: true);
                break;
            case "home":
                SendKeyScanCode(Win32.VK_HOME, hkl, isExtended: true);
                break;
            case "end":
                SendKeyScanCode(Win32.VK_END, hkl, isExtended: true);
                break;
            case "up":
                SendKeyScanCode(Win32.VK_UP, hkl, isExtended: true);
                break;
            case "down":
                SendKeyScanCode(Win32.VK_DOWN, hkl, isExtended: true);
                break;
            case "left":
                SendKeyScanCode(Win32.VK_LEFT, hkl, isExtended: true);
                break;
            case "right":
                SendKeyScanCode(Win32.VK_RIGHT, hkl, isExtended: true);
                break;
        }
    }

    private static void SendPaste(nint hkl)
    {
        SendKeyDownScanCode(Win32.VK_CONTROL, hkl);
        Thread.Sleep(15);
        SendKeyScanCode(Win32.VK_V, hkl);
        Thread.Sleep(15);
        SendKeyUpScanCode(Win32.VK_CONTROL, hkl);
    }

    private static string? ReadClipboardText()
    {
        for (int i = 0; i < 5; i++)
        {
            if (Win32.OpenClipboard(0))
            {
                try
                {
                    nint hData = Win32.GetClipboardData(Win32.CF_UNICODETEXT);
                    if (hData != 0)
                    {
                        nint pData = Win32.GlobalLock(hData);
                        if (pData != 0)
                        {
                            try
                            {
                                return Marshal.PtrToStringUni(pData);
                            }
                            finally
                            {
                                Win32.GlobalUnlock(hData);
                            }
                        }
                    }
                    return null;
                }
                finally
                {
                    Win32.CloseClipboard();
                }
            }
            Thread.Sleep(10);
        }
        return null;
    }

    private static void SetClipboardText(string text)
    {
        for (int i = 0; i < 5; i++)
        {
            if (Win32.OpenClipboard(0))
            {
                try
                {
                    Win32.EmptyClipboard();
                    byte[] bytes = System.Text.Encoding.Unicode.GetBytes(text + "\0");
                    nint hMem = Win32.GlobalAlloc(Win32.GMEM_MOVEABLE, (nuint)bytes.Length);
                    if (hMem != 0)
                    {
                        nint pMem = Win32.GlobalLock(hMem);
                        if (pMem != 0)
                        {
                            Marshal.Copy(bytes, 0, pMem, bytes.Length);
                            Win32.GlobalUnlock(hMem);
                            Win32.SetClipboardData(Win32.CF_UNICODETEXT, hMem);
                        }
                    }
                    return;
                }
                finally
                {
                    Win32.CloseClipboard();
                }
            }
            Thread.Sleep(10);
        }
    }

    private static void ClearClipboard()
    {
        for (int i = 0; i < 5; i++)
        {
            if (Win32.OpenClipboard(0))
            {
                try
                {
                    Win32.EmptyClipboard();
                    return;
                }
                finally
                {
                    Win32.CloseClipboard();
                }
            }
            Thread.Sleep(10);
        }
    }
}
