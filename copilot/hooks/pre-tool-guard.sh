#!/usr/bin/env bash
set -euo pipefail

input="$(cat)"

decision="$(
  printf '%s' "$input" | node -e '
const data = require("fs").readFileSync(0, "utf8");
  try {
    const payload = JSON.parse(data || "{}");
    const toolName = payload.tool_name || payload.toolName || "";
    const toolInput = payload.tool_input || {};
    const rawToolArgs = payload.toolArgs || "";

    function collectStrings(value, output = []) {
      if (typeof value === "string") {
        output.push(value);
      } else if (Array.isArray(value)) {
        for (const item of value) {
          collectStrings(item, output);
        }
      } else if (value && typeof value === "object") {
        for (const item of Object.values(value)) {
          collectStrings(item, output);
        }
      }

      return output;
    }

    let command = "";
    if (typeof toolInput.command === "string") {
      command = toolInput.command;
    } else if (Array.isArray(toolInput.commands)) {
      command = toolInput.commands.join(" && ");
    } else if (typeof toolInput.commands === "string") {
      command = toolInput.commands;
    }

    if (!command && typeof rawToolArgs === "string" && rawToolArgs.length > 0) {
      try {
        const parsedArgs = JSON.parse(rawToolArgs);
        if (typeof parsedArgs.command === "string") {
          command = parsedArgs.command;
        } else if (Array.isArray(parsedArgs.commands)) {
          command = parsedArgs.commands.join(" && ");
        } else {
          command = rawToolArgs;
        }
      } catch {
        command = rawToolArgs;
      }
    }

    const haystack = `${toolName} ${command} ${collectStrings(toolInput).join(" ")} ${rawToolArgs}`;
    const dangerousCommandPatterns = [
      /(^|\s)rm\s+-rf\s+\//i,
      /git\s+reset\s+--hard/i,
      /git\s+checkout\s+--\s+/i,
      /chmod\s+-R\s+777\b/i,
      /\bmkfs\b/i
    ];
    const protectedBaseNames = new Set([
      ".env",
      ".env.local",
      ".env.development",
      ".env.production",
      ".env.staging",
      ".env.ci",
      ".env.test",
      ".envrc",
      "settings_local.php",
      "settings.ci.php",
      "app_local.php",
      "app.ci.php",
      "id_rsa",
      "id_ed25519",
      ".npmrc",
      ".pypirc",
      ".netrc"
    ]);

    function isSensitiveToken(token) {
      const normalised = token.replace(/\\\\/g, "/");
      const parts = normalised.split("/").filter(Boolean);
      const baseName = parts[parts.length - 1] || normalised;

      return protectedBaseNames.has(baseName)
        || /\\.(pem|key)$/i.test(baseName)
        || normalised.includes(".aws/credentials")
        || normalised.includes(".azure/");
    }

    const pathTokens = haystack
      .replace(/\\\\/g, "/")
      .split(/[^A-Za-z0-9_.\\/~:-]+/)
      .filter(Boolean);

    const isDangerousCommand = dangerousCommandPatterns.some((pattern) => pattern.test(haystack));
    const isSensitiveFileAccess = pathTokens.some(isSensitiveToken);
    const isBlocked = isDangerousCommand || isSensitiveFileAccess;
    if (!isBlocked) {
      process.stdout.write("");
      process.exit(0);
    }

    const reason = isSensitiveFileAccess
      ? "Blocked sensitive file access by local policy hook"
      : "Blocked dangerous command by local policy hook";
    const response = {
      permissionDecision: "deny",
      permissionDecisionReason: reason,
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: reason
      }
    };

    process.stdout.write(JSON.stringify(response));
  } catch {
    process.stdout.write("");
  }
'
)"

if [[ -n "$decision" ]]; then
  printf '%s\n' "$decision"
fi

exit 0
