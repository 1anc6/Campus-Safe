import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { constants as osConstants } from "node:os";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { promisify } from "node:util";
import { exitStatusFromChild } from "./run.mjs";

const execFileAsync = promisify(execFile);
const RUNNER = fileURLToPath(new URL("./run.mjs", import.meta.url));

test("a normal exit code passes straight through", () => {
  assert.equal(exitStatusFromChild(0, null), 0);
  assert.equal(exitStatusFromChild(3, null), 3);
});

test("a signal-killed child reports 128 + the signal number, like a shell", () => {
  assert.equal(exitStatusFromChild(null, "SIGTERM"), 128 + osConstants.signals.SIGTERM);
});

test("the runner exits with its child's exit code", async () => {
  await assert.rejects(
    execFileAsync(process.execPath, [RUNNER, process.execPath, "-e", "process.exit(3)"]),
    (err) => err.code === 3,
  );
});

test("the runner refuses to start without a command", async () => {
  await assert.rejects(execFileAsync(process.execPath, [RUNNER]), (err) => err.code === 2);
});
