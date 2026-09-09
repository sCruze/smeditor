#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const lockfilePath = join(root, "pnpm-lock.yaml");
const workspacePath = join(root, "pnpm-workspace.yaml");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function readWorkspacePatterns() {
  const text = readFileSync(workspacePath, "utf8");
  const patterns = [];
  let inPackages = false;

  for (const line of text.split(/\r?\n/)) {
    if (/^packages:\s*$/.test(line)) {
      inPackages = true;
    } else if (inPackages && /^\S/.test(line)) {
      inPackages = false;
    }

    if (inPackages) {
      const match = line.match(/^\s*-\s+["']?([^"']+)["']?\s*$/);
      if (match) {
        patterns.push(match[1]);
      }
    }
  }

  return patterns;
}

function expandWorkspacePattern(pattern) {
  if (!pattern.endsWith("/*")) {
    return [pattern];
  }

  const parentRelative = pattern.slice(0, -2);
  const parent = join(root, parentRelative);
  if (!existsSync(parent)) {
    return [];
  }

  return readdirSync(parent, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `${parentRelative}/${entry.name}`)
    .filter((relativePath) => existsSync(join(root, relativePath, "package.json")));
}

function listWorkspaceImporters() {
  const importers = new Map([[".", join(root, "package.json")]]);

  for (const pattern of readWorkspacePatterns()) {
    for (const relativePath of expandWorkspacePattern(pattern)) {
      importers.set(relativePath, join(root, relativePath, "package.json"));
    }
  }

  return importers;
}

function packageDependencies(packageJson) {
  const dependencies = new Map();

  for (const section of ["dependencies", "devDependencies", "optionalDependencies"]) {
    const values = packageJson[section] ?? {};
    for (const [name, specifier] of Object.entries(values)) {
      dependencies.set(`${section}:${name}`, { section, name, specifier });
    }
  }

  return dependencies;
}

function unquote(value) {
  return value.replace(/^['"]|['"]$/g, "");
}

function parseLockfileImporters() {
  const text = readFileSync(lockfilePath, "utf8");
  const importers = new Map();
  let inImporters = false;
  let currentImporter = null;
  let currentSection = null;
  let currentDependency = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+$/, "");

    if (line === "importers:") {
      inImporters = true;
      continue;
    }

    if (inImporters && line === "packages:") {
      break;
    }

    if (!inImporters) {
      continue;
    }

    const importerMatch = line.match(/^  ([^ ].*):$/);
    if (importerMatch) {
      currentImporter = importerMatch[1];
      currentSection = null;
      currentDependency = null;
      importers.set(currentImporter, new Map());
      continue;
    }

    const sectionMatch = line.match(/^    (dependencies|devDependencies|optionalDependencies):$/);
    if (currentImporter && sectionMatch) {
      currentSection = sectionMatch[1];
      currentDependency = null;
      continue;
    }

    const dependencyMatch = line.match(/^      (.+):$/);
    if (currentImporter && currentSection && dependencyMatch) {
      currentDependency = unquote(dependencyMatch[1]);
      continue;
    }

    const specifierMatch = line.match(/^        specifier: (.+)$/);
    if (currentImporter && currentSection && currentDependency && specifierMatch) {
      importers.get(currentImporter).set(`${currentSection}:${currentDependency}`, {
        section: currentSection,
        name: currentDependency,
        specifier: unquote(specifierMatch[1]),
      });
    }
  }

  return importers;
}

const workspaceImporters = listWorkspaceImporters();
const lockImporters = parseLockfileImporters();
const issues = [];

for (const [importerPath, packageJsonPath] of workspaceImporters) {
  const packageJson = readJson(packageJsonPath);
  const expected = packageDependencies(packageJson);
  const actual = lockImporters.get(importerPath);

  if (!actual) {
    if (expected.size > 0) {
      issues.push(`${importerPath}: missing importer in pnpm-lock.yaml`);
    }
    continue;
  }

  for (const [key, dependency] of expected) {
    const locked = actual.get(key);
    if (!locked) {
      issues.push(
        `${importerPath}: missing ${dependency.section}.${dependency.name} (${dependency.specifier})`,
      );
    } else if (locked.specifier !== dependency.specifier) {
      issues.push(
        `${importerPath}: ${dependency.section}.${dependency.name} specifier is ${locked.specifier}, expected ${dependency.specifier}`,
      );
    }
  }

  for (const [key, dependency] of actual) {
    if (!expected.has(key)) {
      issues.push(
        `${importerPath}: stale ${dependency.section}.${dependency.name} (${dependency.specifier})`,
      );
    }
  }
}

for (const importerPath of lockImporters.keys()) {
  if (!workspaceImporters.has(importerPath)) {
    issues.push(`${importerPath}: stale importer in pnpm-lock.yaml`);
  }
}

if (issues.length > 0) {
  console.error("pnpm-lock.yaml is out of sync with workspace package.json files.");
  console.error("Run `pnpm install` and commit the updated pnpm-lock.yaml.");
  console.error("");
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log("pnpm-lock.yaml matches workspace package.json dependency specifiers.");
