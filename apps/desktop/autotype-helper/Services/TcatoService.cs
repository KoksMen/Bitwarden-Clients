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

        // Release any held modifier keys from hotkey activation
        ReleaseModifiers();
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
                            TypeWithTcato(token.Value);
                        }
                        else
                        {
                            TypeNormal(token.Value);
                        }
                    }
                    break;

                case "key":
                    SendSpecialKey(token.Key);
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

    private static void ReleaseModifiers()
    {
        var modifiers = new[] { Win32.VK_CONTROL, Win32.VK_MENU, Win32.VK_SHIFT, Win32.VK_LWIN, Win32.VK_RWIN };
        foreach (var vk in modifiers)
        {
            if ((Win32.GetAsyncKeyState(vk) & 0x8000) != 0)
            {
                var input = new Win32.INPUT[1];
                input[0].type = Win32.INPUT_KEYBOARD;
                input[0].mkhi.ki.wVk = vk;
                input[0].mkhi.ki.dwFlags = Win32.KEYEVENTF_KEYUP;
                Win32.SendInput(1, input, Marshal.SizeOf<Win32.INPUT>());
            }
        }
    }

    private static void TypeNormal(string text)
    {
        foreach (char c in text)
        {
            SendUnicodeChar(c);
            Thread.Sleep(5);
        }
    }

    private static void TypeWithTcato(string sensitiveText)
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
                    SendPaste();
                    Thread.Sleep(25);
                }
                else
                {
                    foreach (char c in chunk)
                    {
                        SendUnicodeChar(c);
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

    private static void SendSpecialKey(string? key)
    {
        if (string.IsNullOrWhiteSpace(key)) return;

        ushort vk = key.ToLowerInvariant() switch
        {
            "tab" => Win32.VK_TAB,
            "enter" or "return" => Win32.VK_RETURN,
            "space" => Win32.VK_SPACE,
            _ => 0
        };

        if (vk == 0) return;

        var inputs = new Win32.INPUT[2];

        inputs[0].type = Win32.INPUT_KEYBOARD;
        inputs[0].mkhi.ki.wVk = vk;

        inputs[1].type = Win32.INPUT_KEYBOARD;
        inputs[1].mkhi.ki.wVk = vk;
        inputs[1].mkhi.ki.dwFlags = Win32.KEYEVENTF_KEYUP;

        Win32.SendInput((uint)inputs.Length, inputs, Marshal.SizeOf<Win32.INPUT>());
    }

    private static void SendPaste()
    {
        var inputs = new Win32.INPUT[4];

        // Ctrl down
        inputs[0].type = Win32.INPUT_KEYBOARD;
        inputs[0].mkhi.ki.wVk = Win32.VK_CONTROL;

        // V down
        inputs[1].type = Win32.INPUT_KEYBOARD;
        inputs[1].mkhi.ki.wVk = Win32.VK_V;

        // V up
        inputs[2].type = Win32.INPUT_KEYBOARD;
        inputs[2].mkhi.ki.wVk = Win32.VK_V;
        inputs[2].mkhi.ki.dwFlags = Win32.KEYEVENTF_KEYUP;

        // Ctrl up
        inputs[3].type = Win32.INPUT_KEYBOARD;
        inputs[3].mkhi.ki.wVk = Win32.VK_CONTROL;
        inputs[3].mkhi.ki.dwFlags = Win32.KEYEVENTF_KEYUP;

        Win32.SendInput((uint)inputs.Length, inputs, Marshal.SizeOf<Win32.INPUT>());
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
