#!/usr/bin/env node

// Version management for the SMEditor monorepo.
//
// The npm packages under `@smeditor/*` are versioned by Changesets — use
// `pnpm changeset` and `pnpm version-packages` for those. This script owns the
// one thing Changesets does not touch: the Ruby gem `smeditor`. It also
// prints a single read-only view of every version in the repo.
//
// Usage:
//   node scripts/bump-version.mjs [status]            Show all versions (default)
//   node scripts/bump-version.mjs gem <bump|version>  Bump the gem version
//
// <bump> is one of: patch minor major premajor preminor prepatch prerelease
// <version> is an explicit RubyGems version, e.g. 1.2.0 or 1.2.0.rc.1
//
// Versions use RubyGems format (dot-separated), NOT SemVer: a prerelease is
// `1.2.0.rc.1`, not `1.2.0-rc.1`, and build metadata (`+meta`) is not allowed —
// RubyGems cannot parse either. Applying patch/minor/major to a prerelease
// finalizes it (drops the prerelease tag) rather than incrementing.
//
// Flags for `gem`:
//   --dry-run   Print what would change without writing files
//   --force     Allow setting a version lower than the current one
//
// Examples:
//   node scripts/bump-version.mjs
//   node scripts/bump-version.mjs gem patch
//   node scripts/bump-version.mjs gem minor --dry-run
//   node scripts/bump-version.mjs gem 1.0.0

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const gemVersionFile = join(
  root,
  "gems/smeditor/lib/smeditor/rails/version.rb",
);
const gemLockFile = join(root, "gems/smeditor/Gemfile.lock");
const packagesDir = join(root, "packages");
const changesetDir = join(root, ".changeset");

const RELEASE_TYPES = new Set([
  "major",
  "minor",
  "patch",
  "premajor",
  "preminor",
  "prepatch",
  "prerelease",
]);
const PRERELEASE_ID = "rc";

// --- RubyGems version model ---------------------------------------------------
//
// A RubyGems version is dot-separated: three leading numeric segments
// (major.minor.patch) followed by an optional prerelease tail of dot-separated
// alphanumeric segments (e.g. `1.2.0.rc.1`). Unlike SemVer there is no `-`
// separator and no `+build` metadata. This is what `gem build` consumes, so the
// tooling speaks it directly rather than translating from SemVer.

const RUBYGEMS_VERSION_RE = /^\d+\.\d+\.\d+(?:\.[0-9A-Za-z]+)*$/;

function parseVersion(value) {
  const raw = String(value).trim();
  if (!RUBYGEMS_VERSION_RE.test(raw)) return null;
  const [major, minor, patch, ...pre] = raw.split(".");
  return {
    major: Number(major),
    minor: Number(minor),
    patch: Number(patch),
    pre,
    raw,
  };
}

// A version is a prerelease when any tail segment contains a letter.
function isPrerelease(parsed) {
  return parsed.pre.some((segment) => /[A-Za-z]/.test(segment));
}

function formatVersion({ major, minor, patch, pre }) {
  return [major, minor, patch, ...pre].join(".");
}

function applyBump(current, type) {
  const c = parseVersion(current);
  if (!c)
    throw new Error(`current version "${current}" is not a valid version`);

  // patch/minor/major on a prerelease finalize it to the release core, so the
  // three keyword bumps behave consistently on a release candidate.
  if (
    isPrerelease(c) &&
    (type === "patch" || type === "minor" || type === "major")
  ) {
    return { major: c.major, minor: c.minor, patch: c.patch, pre: [] };
  }

  switch (type) {
    case "major":
      return { major: c.major + 1, minor: 0, patch: 0, pre: [] };
    case "minor":
      return { major: c.major, minor: c.minor + 1, patch: 0, pre: [] };
    case "patch":
      return { major: c.major, minor: c.minor, patch: c.patch + 1, pre: [] };
    case "premajor":
      return {
        major: c.major + 1,
        minor: 0,
        patch: 0,
        pre: [PRERELEASE_ID, "0"],
      };
    case "preminor":
      return {
        major: c.major,
        minor: c.minor + 1,
        patch: 0,
        pre: [PRERELEASE_ID, "0"],
      };
    case "prepatch":
      return {
        major: c.major,
        minor: c.minor,
        patch: c.patch + 1,
        pre: [PRERELEASE_ID, "0"],
      };
    case "prerelease": {
      if (isPrerelease(c)) {
        const pre = [...c.pre];
        const last = pre.length - 1;
        if (/^\d+$/.test(pre[last])) {
          pre[last] = String(Number(pre[last]) + 1);
        } else {
          pre.push("0");
        }
        return { major: c.major, minor: c.minor, patch: c.patch, pre };
      }
      return {
        major: c.major,
        minor: c.minor,
        patch: c.patch + 1,
        pre: [PRERELEASE_ID, "0"],
      };
    }
    default:
      throw new Error(`unknown release type "${type}"`);
  }
}

// RubyGems ordering: compare dot segments left to right. A version that runs out
// of segments outranks one whose next segment is a string (a release is newer
// than its prerelease) but is older than one whose next segment is numeric.
function compareVersion(a, b) {
  const as = String(a).split(".");
  const bs = String(b).split(".");
  const len = Math.max(as.length, bs.length);
  for (let i = 0; i < len; i += 1) {
    const x = as[i];
    const y = bs[i];
    if (x === undefined) return /^\d+$/.test(y) ? -1 : 1;
    if (y === undefined) return /^\d+$/.test(x) ? 1 : -1;
    const xNum = /^\d+$/.test(x);
    const yNum = /^\d+$/.test(y);
    if (xNum && yNum) {
      if (Number(x) !== Number(y)) return Number(x) < Number(y) ? -1 : 1;
    } else if (xNum !== yNum) {
      return xNum ? 1 : -1; // a numeric segment outranks a string segment
    } else if (x !== y) {
      return x < y ? -1 : 1;
    }
  }
  return 0;
}

// --- Gem version file ---------------------------------------------------------

function readGemVersion() {
  const text = readFileSync(gemVersionFile, "utf8");
  const match = text.match(/VERSION\s*=\s*["']([^"']+)["']/);
  if (!match) throw new Error(`could not find VERSION in ${gemVersionFile}`);
  return { text, version: match[1] };
}

function writeGemVersion(oldVersion, newVersion) {
  const { text } = readGemVersion();
  const updated = text.replace(
    /(VERSION\s*=\s*["'])[^"']+(["'])/,
    `$1${newVersion}$2`,
  );
  writeFileSync(gemVersionFile, updated);

  // Keep Gemfile.lock in sync: the path gem is named in both the PATH `specs`
  // block and the CHECKSUMS block. A literal string swap avoids touching any of
  // the resolved dependency versions. Report what actually happened so the
  // caller does not claim a sync that did not occur.
  const result = {
    lockExists: existsSync(gemLockFile),
    lockHadMatch: false,
    lockUpdated: false,
  };
  if (result.lockExists) {
    const lock = readFileSync(gemLockFile, "utf8");
    const needle = `smeditor (${oldVersion})`;
    result.lockHadMatch = lock.includes(needle);
    const synced = lock.split(needle).join(`smeditor (${newVersion})`);
    if (synced !== lock) {
      writeFileSync(gemLockFile, synced);
      result.lockUpdated = true;
    }
  }
  return result;
}

// --- npm workspace snapshot ---------------------------------------------------

function readNpmPackages() {
  if (!existsSync(packagesDir)) return [];
  return readdirSync(packagesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(packagesDir, entry.name, "package.json"))
    .filter(existsSync)
    .map((file) => {
      try {
        return JSON.parse(readFileSync(file, "utf8"));
      } catch (err) {
        // One malformed package.json should not blank the whole status report.
        console.warn(`warning: skipping ${rel(file)} (${err.message})`);
        return null;
      }
    })
    .filter((pkg) => pkg && pkg.name)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function countPendingChangesets() {
  if (!existsSync(changesetDir)) return 0;
  return readdirSync(changesetDir).filter(
    (f) => f.endsWith(".md") && f !== "README.md",
  ).length;
}

// --- Commands -----------------------------------------------------------------

function printStatus() {
  const packages = readNpmPackages();
  const publishable = packages.filter((pkg) => !pkg.private);
  const pending = countPendingChangesets();
  const { version: gemVersion } = readGemVersion();

  console.log("SMEditor versions\n");

  console.log(`  gem  smeditor  ${gemVersion}`);
  console.log(
    "       (bump with: node scripts/bump-version.mjs gem <patch|minor|major>)\n",
  );

  console.log(
    `  npm  ${publishable.length} publishable @smeditor/* packages (Changesets):`,
  );
  for (const pkg of publishable) {
    console.log(`         ${pkg.name.padEnd(38)} ${pkg.version}`);
  }

  const priv = packages.length - publishable.length;
  if (priv > 0) {
    console.log(
      `\n       (${priv} private package(s) not shown — never published)`,
    );
  }

  console.log(
    `\n  ${pending} pending changeset(s). ` +
      (pending === 0
        ? "Add one with `pnpm changeset` before an npm release."
        : "Apply with `pnpm version-packages`."),
  );
}

function bumpGem(positionals, flags) {
  const arg = positionals[0];
  if (!arg) {
    fail(
      "missing bump type or version.\n" +
        "  usage: node scripts/bump-version.mjs gem <patch|minor|major|premajor|preminor|prepatch|prerelease|X.Y.Z>",
    );
  }

  const { version: current } = readGemVersion();
  if (!parseVersion(current)) {
    fail(
      `version.rb holds "${current}", which is not a valid RubyGems version.`,
    );
  }

  let target;
  if (RELEASE_TYPES.has(arg)) {
    target = formatVersion(applyBump(current, arg));
  } else if (parseVersion(arg)) {
    target = parseVersion(arg).raw;
  } else {
    fail(
      `"${arg}" is neither a release type nor a valid RubyGems version.\n` +
        "  Use dot format, e.g. 1.2.0 or 1.2.0.rc.1 (not 1.2.0-rc.1 or 1.2.0+build).",
    );
  }

  const cmp = compareVersion(target, current);
  if (cmp === 0) fail(`gem is already at ${current} — nothing to do.`);
  if (cmp < 0 && !flags.has("--force")) {
    fail(
      `refusing to move the gem version backwards (${current} -> ${target}). Pass --force to override.`,
    );
  }

  if (flags.has("--dry-run")) {
    console.log(`[dry run] smeditor ${current} -> ${target}`);
    console.log(`          would edit ${rel(gemVersionFile)}`);
    if (existsSync(gemLockFile)) {
      const hasMatch = readFileSync(gemLockFile, "utf8").includes(
        `smeditor (${current})`,
      );
      console.log(
        hasMatch
          ? `          would sync ${rel(gemLockFile)}`
          : `          note: ${rel(gemLockFile)} does not pin smeditor (${current}); run \`bundle install\` to re-sync`,
      );
    }
    return;
  }

  const lock = writeGemVersion(current, target);
  console.log(`smeditor ${current} -> ${target}`);
  console.log(`  updated ${rel(gemVersionFile)}`);
  if (lock.lockUpdated) {
    console.log(`  synced  ${rel(gemLockFile)}`);
  } else if (lock.lockExists && !lock.lockHadMatch) {
    console.log(
      `  warning: ${rel(gemLockFile)} did not pin smeditor (${current}); ` +
        "run `bundle install` in gems/smeditor to re-sync",
    );
  }
  console.log("\nNext:");
  console.log(`  1. Add a CHANGELOG.md entry for smeditor ${target}`);
  console.log(
    "  2. cd gems/smeditor && bundle install && bundle exec rspec",
  );
  console.log(
    "  3. Publish with `pnpm release:gem` (or the release-gem workflow)",
  );
}

// --- helpers ------------------------------------------------------------------

function rel(path) {
  return path.startsWith(root) ? path.slice(root.length + 1) : path;
}

function fail(message) {
  console.error(`error: ${message}`);
  process.exit(1);
}

function printHelp() {
  // Print the leading `//` comment block (skipping the shebang), stopping at the
  // first line after it that is not a comment — so this stays correct if the
  // file is reformatted.
  const lines = readFileSync(fileURLToPath(import.meta.url), "utf8").split(
    "\n",
  );
  const out = [];
  let started = false;
  for (const line of lines.slice(1)) {
    if (line.startsWith("//")) {
      started = true;
      out.push(line.replace(/^\/\/ ?/, ""));
    } else if (started) {
      break; // end of the leading comment block
    }
    // otherwise: a blank line before the comment block — keep scanning
  }
  console.log(out.join("\n").trim());
}

// --- entry point --------------------------------------------------------------

function main() {
  const argv = process.argv.slice(2);
  const flags = new Set(argv.filter((a) => a.startsWith("--")));
  const positionals = argv.filter((a) => !a.startsWith("--"));
  const command = positionals[0] ?? "status";

  if (flags.has("--help") || flags.has("-h") || command === "help") {
    printHelp();
    return;
  }

  switch (command) {
    case "status":
      printStatus();
      break;
    case "gem":
      bumpGem(positionals.slice(1), flags);
      break;
    default:
      fail(`unknown command "${command}". Run with --help for usage.`);
  }
}

try {
  main();
} catch (err) {
  fail(err.message);
}
