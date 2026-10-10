#!/usr/bin/env node
/**
 * Atomic file write: replace a file so that no reader ever sees it half-written.
 *
 *   node scripts/write-atomic.mjs <source-file> <target-file>
 *
 * File-system concept: writing a file in place happens in many small steps, so
 * a program reading it at the same time can see a partly written file. Instead
 * we write the new bytes to a temporary file IN THE SAME DIRECTORY, then
 * `rename()` it over the target. rename(2) is atomic within one file system:
 * a reader sees either the old file or the new one, never a mix.
 *
 * The temp file must be in the target's directory — a rename across two file
 * systems is not atomic, and the OS refuses it with EXDEV.
 */
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Write `data` to `target` atomically. `rename` is injectable so tests can
 * simulate a failure; on any error the original `target` is left untouched.
 */
export function writeFileAtomic(target, data, { rename = renameSync } = {}) {
  const dir = dirname(target);
  mkdirSync(dir, { recursive: true });
  const temp = join(dir, `.${basename(target)}.${process.pid}.${Date.now()}.tmp`);
  writeFileSync(temp, data);
  try {
    rename(temp, target);
  } catch (err) {
    rmSync(temp, { force: true });
    throw err;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [source, target, ...rest] = process.argv.slice(2);
  if (!source || !target || rest.length > 0) {
    console.error("usage: node scripts/write-atomic.mjs <source-file> <target-file>");
    process.exit(1);
  }
  try {
    writeFileAtomic(resolve(target), readFileSync(resolve(source)));
  } catch (err) {
    console.error(`[write-atomic] ${source} → ${target} failed: ${err?.message || err}`);
    process.exit(1);
  }
  console.log(`[write-atomic] wrote ${target}`);
}
