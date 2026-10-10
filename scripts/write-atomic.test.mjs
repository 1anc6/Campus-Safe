import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { writeFileAtomic } from "./write-atomic.mjs";

const scratch = () => mkdtempSync(join(tmpdir(), "write-atomic-"));

test("replaces the target with the new contents", () => {
  const dir = scratch();
  const target = join(dir, "data.txt");
  writeFileSync(target, "old");
  writeFileAtomic(target, "new");
  assert.equal(readFileSync(target, "utf8"), "new");
});

test("creates missing parent directories", () => {
  const target = join(scratch(), "a", "b", "data.txt");
  writeFileAtomic(target, "hello");
  assert.equal(readFileSync(target, "utf8"), "hello");
});

test("leaves no temp file behind", () => {
  const dir = scratch();
  writeFileAtomic(join(dir, "data.txt"), "x");
  assert.deepEqual(readdirSync(dir), ["data.txt"]);
});

test("on a failed rename the original file is untouched and the temp is removed", () => {
  const dir = scratch();
  const target = join(dir, "data.txt");
  writeFileSync(target, "original");
  const failingRename = () => {
    throw Object.assign(new Error("cross-device link"), { code: "EXDEV" });
  };
  assert.throws(() => writeFileAtomic(target, "new", { rename: failingRename }), /cross-device/);
  assert.equal(readFileSync(target, "utf8"), "original");
  assert.deepEqual(readdirSync(dir), ["data.txt"]);
});
