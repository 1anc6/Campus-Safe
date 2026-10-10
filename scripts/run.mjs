#!/usr/bin/env node
/**
 * Run a project command (`vite dev`, `vite build`, …) as a CHILD PROCESS.
 *
 * Operating-system concepts in one small file:
 *   - Process creation: `spawn()` (fork + exec under the hood) starts the child.
 *   - Signals: SIGINT / SIGTERM / SIGHUP sent to this wrapper are forwarded to
 *     the child, so Ctrl+C stops the dev server cleanly.
 *   - Exit status: the child's exit code (or 128 + signal number, as a shell
 *     reports it) becomes this process's exit code — like `wait()` in UNIX.
 *   - Environment: the project's `node_modules/.bin` is prepended to PATH so
 *     local tools are found, as a shell would resolve them.
 */
import { spawn } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { constants as osConstants } from "node:os";
import { delimiter, dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Translate a child's `exit` `(code, signal)` into this process's exit status.
 *
 * `128 + signo` is what a shell reports for a signal-killed command, so a
 * cancelled `vite build` still counts as a failure.
 */
export function exitStatusFromChild(code, signal) {
  if (signal) {
    const signo = osConstants.signals[signal];
    return 128 + (typeof signo === "number" ? signo : 1);
  }
  return code ?? 1;
}

/** The project root (this file lives in `<root>/scripts/`). */
export function projectRoot() {
  return dirname(dirname(fileURLToPath(import.meta.url)));
}

/**
 * Whether `moduleUrl` is the script node was asked to run.
 *
 * Both sides are resolved through symlinks: node realpaths `import.meta.url`
 * but leaves `process.argv[1]` as typed, so comparing them raw makes a CLI
 * launched through a symlinked path (`/tmp` on macOS) a silent no-op.
 */
export function isMainModule(moduleUrl) {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return realpathSync(entry) === fileURLToPath(moduleUrl);
  } catch {
    return false;
  }
}

function pathEnvKey(env) {
  if (process.platform === "win32" && env.Path && !env.PATH) return "Path";
  return "PATH";
}

function withLocalBinPath(env) {
  const next = { ...env };
  const key = pathEnvKey(next);
  const bins = join(projectRoot(), "node_modules", ".bin");
  next[key] = `${bins}${delimiter}${next[key] || ""}`;
  return next;
}

/**
 * Resolve a local CLI so Windows can find `vite.cmd` and a missing
 * `npm install` fails with a useful message instead of spawn ENOENT.
 *
 * `vite` is run as `node node_modules/vite/bin/vite.js` — that avoids
 * `spawn('vite')` which cannot see `.cmd` shims on Windows without a shell.
 * Do not `require.resolve('vite/bin/vite.js')`: Vite 8's package exports
 * block that subpath.
 */
export function resolveSpawn(command, args) {
  if (command === "vite") {
    const viteJs = join(projectRoot(), "node_modules", "vite", "bin", "vite.js");
    if (existsSync(viteJs)) {
      return { file: process.execPath, args: [viteJs, ...args], shell: false };
    }
  }

  if (!command || isAbsolute(command) || command.includes("/") || command.includes("\\")) {
    return { file: command, args, shell: false };
  }

  const dir = join(projectRoot(), "node_modules", ".bin");
  if (process.platform === "win32") {
    for (const name of [`${command}.cmd`, `${command}.exe`, `${command}.bat`, command]) {
      const file = join(dir, name);
      if (existsSync(file)) {
        const shell = name.endsWith(".cmd") || name.endsWith(".bat");
        return { file, args, shell };
      }
    }
    return { file: command, args, shell: true };
  }

  const unix = join(dir, command);
  if (existsSync(unix)) return { file: unix, args, shell: false };
  return { file: command, args, shell: false };
}

function main(argv) {
  const [command, ...args] = argv;
  if (!command) {
    console.error("usage: node scripts/run.mjs <command> [args…]");
    process.exit(2);
  }
  const env = withLocalBinPath(process.env);
  const resolved = resolveSpawn(command, args);
  const child = spawn(resolved.file, resolved.args, {
    stdio: "inherit",
    env,
    cwd: projectRoot(),
    shell: resolved.shell,
    windowsHide: true,
  });
  // The dev server is long-running and is stopped by signalling this wrapper.
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
    process.on(signal, () => child.kill(signal));
  }
  child.on("error", (err) => {
    console.error(`[run] failed to run ${command}:`, err?.message || err);
    if (err && err.code === "ENOENT") {
      console.error(
        `[run] '${command}' was not found. In the folder that contains package.json, run:\n  npm install\n  npm run dev`,
      );
    }
    process.exit(127);
  });
  child.on("exit", (code, signal) => {
    process.exit(exitStatusFromChild(code, signal));
  });
}

if (isMainModule(import.meta.url)) {
  main(process.argv.slice(2));
}
