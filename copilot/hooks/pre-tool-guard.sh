#!/usr/bin/env bash
set -euo pipefail

input="$(cat)"

decision="$(
  printf '%s' "$input" | node -e '
let data = "";
process.stdin.on("data", (chunk) => { data += chunk; });
process.stdin.on("end", () => {
  try {
    const payload = JSON.parse(data || "{}");
    const toolName = payload.tool_name || payload.toolName || "";
    const toolInput = payload.tool_input || {};
    const rawToolArgs = payload.toolArgs || "";

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

    const haystack = `${toolName} ${command}`;
    const blockedPatterns = [
      /(^|\\s)rm\\s+-rf\\s+\\//i,
      /git\\s+reset\\s+--hard/i,
      /git\\s+checkout\\s+--\\s+/i,
      /chmod\\s+-R\\s+777\\b/i,
      /\\bmkfs\\b/i
    ];

    const isBlocked = blockedPatterns.some((pattern) => pattern.test(haystack));
    if (!isBlocked) {
      process.stdout.write("");
      return;
    }

    const reason = "Blocked dangerous command by local policy hook";
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
});
'
)"

if [[ -n "$decision" ]]; then
  printf '%s\n' "$decision"
fi

exit 0
