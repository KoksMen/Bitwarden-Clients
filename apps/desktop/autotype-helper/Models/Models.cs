namespace Bitwarden.Autotype.Models;

public sealed record WindowInfo(
    long Hwnd,
    string WindowTitle,
    string ProcessName,
    string ProcessPath,
    uint Pid
);

public sealed record SequenceToken(
    string Type,
    string? Value = null,
    string? Key = null,
    int? Milliseconds = null,
    bool IsSensitive = false
);

public sealed record SequenceRequest(
    long Hwnd,
    IReadOnlyList<SequenceToken> Tokens,
    bool UseTcato = false
);

public sealed record DaemonCommand(
    string Id,
    string Cmd,
    long? Hwnd = null,
    SequenceRequest? Payload = null
);

public sealed record DaemonResponse(
    string Id,
    bool Success,
    object? Data = null,
    string? Error = null
);
