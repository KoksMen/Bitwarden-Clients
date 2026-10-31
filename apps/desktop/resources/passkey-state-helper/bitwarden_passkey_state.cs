using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;

namespace BitwardenPasskeyState
{
    class Program
    {
        [DllImport("webauthn.dll", SetLastError = true)]
        private static extern int WebAuthNPluginGetAuthenticatorState(ref Guid rclsid, out int pluginAuthenticatorState);

        static int Main(string[] args)
        {
            if (args.Length > 0 && args[0] == "open-settings")
            {
                try
                {
                    Process.Start(new ProcessStartInfo("ms-settings:passkeys") { UseShellExecute = true });
                    return 0;
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine(ex.Message);
                    return 1;
                }
            }

            string clsidStr = "0f7dc5d9-69ce-4652-8572-6877fd695062";
            if (args.Length > 0 && !string.IsNullOrEmpty(args[0]) && args[0] != "get-state")
            {
                clsidStr = args[0];
            }
            else
            {
                try
                {
                    string dir = AppDomain.CurrentDomain.BaseDirectory;
                    string[] candidates = new string[]
                    {
                        Path.Combine(dir, "plugin_authenticator_config.json"),
                        Path.Combine(dir, "resources", "plugin_authenticator_config.json"),
                        Path.Combine(dir, "..", "resources", "plugin_authenticator_config.json"),
                        Path.Combine(dir, "..", "plugin_authenticator_config.json")
                    };

                    foreach (var path in candidates)
                    {
                        if (File.Exists(path))
                        {
                            string content = File.ReadAllText(path);
                            int idx = content.IndexOf("\"clsid\"");
                            if (idx >= 0)
                            {
                                int colon = content.IndexOf(':', idx);
                                int quote1 = content.IndexOf('"', colon + 1);
                                int quote2 = content.IndexOf('"', quote1 + 1);
                                if (quote1 >= 0 && quote2 > quote1)
                                {
                                    clsidStr = content.Substring(quote1 + 1, quote2 - quote1 - 1);
                                    break;
                                }
                            }
                        }
                    }
                }
                catch {}
            }

            Guid clsid;
            if (!Guid.TryParse(clsidStr, out clsid))
            {
                Console.WriteLine("{\"registered\":false,\"enabled\":false}");
                return 0;
            }

            try
            {
                int state = -1;
                int hr = WebAuthNPluginGetAuthenticatorState(ref clsid, out state);
                if (hr == 0)
                {
                    bool enabled = (state == 1);
                    Console.WriteLine("{\"registered\":true,\"enabled\":" + (enabled ? "true" : "false") + "}");
                    return 0;
                }
                else
                {
                    Console.WriteLine("{\"registered\":false,\"enabled\":false}");
                    return 0;
                }
            }
            catch
            {
                Console.WriteLine("{\"registered\":false,\"enabled\":false}");
                return 0;
            }
        }
    }
}
