using System;
using System.Diagnostics;
using System.IO;
using System.Text;

// A BROWSER executable for unmodified Claude Code on Windows. No shell, auth
// exchange or credential access. The JS router enforces provider/redirect rules.
public static class MyLimitsClaudeBrowser {
    static string Quote(string value) {
        var result = new StringBuilder("\""); int slashes = 0;
        foreach (char ch in value) {
            if (ch == '\\') { slashes++; continue; }
            if (ch == '"') result.Append('\\', slashes * 2 + 1);
            else result.Append('\\', slashes);
            result.Append(ch); slashes = 0;
        }
        result.Append('\\', slashes * 2); return result.Append('"').ToString();
    }
    public static int Main(string[] args) {
        try {
            if (args.Length != 1 || args[0].Length > 16000) return 1;
            string node = Environment.GetEnvironmentVariable("MYLIMITS_AUTH_ROUTER_NODE");
            string script = Environment.GetEnvironmentVariable("MYLIMITS_AUTH_ROUTER_SCRIPT");
            if (String.IsNullOrEmpty(node) || String.IsNullOrEmpty(script) || !Path.IsPathRooted(node) || !Path.IsPathRooted(script) || !File.Exists(node) || !File.Exists(script)) return 1;
            string encoded = Convert.ToBase64String(Encoding.UTF8.GetBytes(args[0]));
            var start = new ProcessStartInfo(node, Quote(script) + " --encoded " + encoded);
            start.UseShellExecute = false; start.CreateNoWindow = true;
            using (var child = Process.Start(start)) { child.WaitForExit(); return child.ExitCode; }
        } catch { return 1; }
    }
}
