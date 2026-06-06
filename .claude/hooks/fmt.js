#!/usr/bin/env node
const { execFileSync } = require("child_process");
const path = require("path");

const ALLOWED_EXT = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".mts",
  ".md",
  ".mdx",
  ".json",
  ".css",
]);
const LINT_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".mts"]);

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const BIN = path.join(PROJECT_ROOT, "node_modules/.bin");

let input = "";
process.stdin.on("data", (chunk) => {
  input += chunk;
});
process.stdin.on("end", () => {
  try {
    const event = JSON.parse(input);
    if (event.tool_name !== "Write" && event.tool_name !== "Edit")
      process.exit(0);

    const filePath = event?.tool_input?.file_path;
    if (!filePath) process.exit(0);

    const ext = path.extname(filePath).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) process.exit(0);

    const opts = { cwd: PROJECT_ROOT, stdio: "pipe" };

    try {
      execFileSync(path.join(BIN, "prettier"), ["--write", filePath], opts);
    } catch (_) {}

    if (LINT_EXT.has(ext)) {
      try {
        execFileSync(
          path.join(BIN, "eslint"),
          ["--fix", "--no-warn-ignored", filePath],
          opts
        );
      } catch (_) {}
    }
  } catch (_) {}

  process.exit(0);
});
