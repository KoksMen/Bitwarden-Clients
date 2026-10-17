namespace Bitwarden.Autotype;

using System.Runtime.InteropServices;
using System.Text.Json;
using Bitwarden.Autotype.Models;
using Bitwarden.Autotype.Native;
using Bitwarden.Autotype.Services;

internal static class Program
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    private static void Main(string[] args)
    {
        var windowService = new WindowService();
        var captureService = new WindowCaptureService();
        var tcatoService = new TcatoService(windowService);

        string command = args.Length > 0 ? args[0].ToLowerInvariant() : "daemon";

        switch (command)
        {
            case "get-active":
            {
                var active = windowService.GetActiveWindow();
                Console.WriteLine(JsonSerializer.Serialize(active, JsonOptions));
                break;
            }

            case "list-running":
            {
                var running = windowService.ListRunningWindows();
                Console.WriteLine(JsonSerializer.Serialize(running, JsonOptions));
                break;
            }

            case "capture-window":
            {
                var captured = captureService.CaptureInteractive();
                Console.WriteLine(JsonSerializer.Serialize(captured, JsonOptions));
                break;
            }

            case "focus-window":
            {
                if (args.Length > 1 && long.TryParse(args[1], out long hwnd))
                {
                    bool ok = windowService.FocusWindow((nint)hwnd);
                    Console.WriteLine(JsonSerializer.Serialize(new { success = ok }, JsonOptions));
                }
                else
                {
                    Console.WriteLine(JsonSerializer.Serialize(new { success = false, error = "Invalid HWND" }, JsonOptions));
                }
                break;
            }

            case "type-sequence":
            {
                string json = args.Length > 1 ? args[1] : Console.In.ReadToEnd();
                var req = JsonSerializer.Deserialize<SequenceRequest>(json, JsonOptions);
                if (req != null)
                {
                    bool ok = tcatoService.ExecuteSequence(req);
                    Console.WriteLine(JsonSerializer.Serialize(new { success = ok }, JsonOptions));
                }
                else
                {
                    Console.WriteLine(JsonSerializer.Serialize(new { success = false, error = "Invalid request payload" }, JsonOptions));
                }
                break;
            }

            case "daemon":
            default:
            {
                RunDaemon(windowService, captureService, tcatoService);
                break;
            }
        }
    }

    private static void RunDaemon(WindowService windowService, WindowCaptureService captureService, TcatoService tcatoService)
    {
        string? line;
        while ((line = Console.ReadLine()) != null)
        {
            if (string.IsNullOrWhiteSpace(line)) continue;

            DaemonCommand? cmd = null;
            try
            {
                cmd = JsonSerializer.Deserialize<DaemonCommand>(line, JsonOptions);
            }
            catch (Exception ex)
            {
                Console.WriteLine(JsonSerializer.Serialize(new DaemonResponse("unknown", false, null, ex.Message), JsonOptions));
                continue;
            }

            if (cmd == null) continue;

            try
            {
                switch (cmd.Cmd.ToLowerInvariant())
                {
                    case "get-active":
                    {
                        var active = windowService.GetActiveWindow();
                        Console.WriteLine(JsonSerializer.Serialize(new DaemonResponse(cmd.Id, true, active), JsonOptions));
                        break;
                    }

                    case "list-running":
                    {
                        var running = windowService.ListRunningWindows();
                        Console.WriteLine(JsonSerializer.Serialize(new DaemonResponse(cmd.Id, true, running), JsonOptions));
                        break;
                    }

                    case "capture-window":
                    {
                        var captured = captureService.CaptureInteractive();
                        Console.WriteLine(JsonSerializer.Serialize(new DaemonResponse(cmd.Id, true, captured), JsonOptions));
                        break;
                    }

                    case "focus-window":
                    {
                        bool ok = cmd.Hwnd.HasValue && windowService.FocusWindow((nint)cmd.Hwnd.Value);
                        Console.WriteLine(JsonSerializer.Serialize(new DaemonResponse(cmd.Id, ok), JsonOptions));
                        break;
                    }

                    case "type-sequence":
                    {
                        if (cmd.Payload != null)
                        {
                            bool ok = tcatoService.ExecuteSequence(cmd.Payload);
                            Console.WriteLine(JsonSerializer.Serialize(new DaemonResponse(cmd.Id, ok), JsonOptions));
                        }
                        else
                        {
                            Console.WriteLine(JsonSerializer.Serialize(new DaemonResponse(cmd.Id, false, null, "Payload missing"), JsonOptions));
                        }
                        break;
                    }

                    case "ping":
                    {
                        Console.WriteLine(JsonSerializer.Serialize(new DaemonResponse(cmd.Id, true, "pong"), JsonOptions));
                        break;
                    }

                    default:
                    {
                        Console.WriteLine(JsonSerializer.Serialize(new DaemonResponse(cmd.Id, false, null, $"Unknown command: {cmd.Cmd}"), JsonOptions));
                        break;
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine(JsonSerializer.Serialize(new DaemonResponse(cmd.Id, false, null, ex.Message), JsonOptions));
            }
        }
    }
}
