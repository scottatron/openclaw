import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { cancel, isCancel, multiselect, note, outro } from "@clack/prompts";
import {
  isOptionalBundledCluster,
  optionalBundledClusters,
} from "./lib/optional-bundled-clusters.mjs";

export const BUNDLED_PLUGIN_EXCLUDE_ENV = "OPENCLAW_EXCLUDE_BUNDLED_PLUGINS";

function parseCsvList(raw) {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return [];
  }
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function readJsonIfExists(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function buildPluginHint(params) {
  const segments = [];
  if (params.channelId) {
    segments.push(`channel:${params.channelId}`);
  }
  if (params.providerIds.length > 0) {
    segments.push(`providers:${params.providerIds.join("/")}`);
  }
  if (params.description) {
    segments.push(params.description);
  }
  return segments.length > 0 ? segments.join(" | ") : undefined;
}

export function collectBundledPluginCatalog(params = {}) {
  const repoRoot = path.resolve(params.repoRoot ?? process.cwd());
  const includeOptional = params.includeOptional === true;
  const initiallyExcluded = new Set(parseCsvList(params.initiallyExcluded));
  const extensionsRoot = path.join(repoRoot, "extensions");
  if (!fs.existsSync(extensionsRoot)) {
    return [];
  }

  const entries = [];
  for (const dirent of fs.readdirSync(extensionsRoot, { withFileTypes: true })) {
    if (!dirent.isDirectory()) {
      continue;
    }
    if (!includeOptional && isOptionalBundledCluster(dirent.name)) {
      continue;
    }

    const packageJson = readJsonIfExists(path.join(extensionsRoot, dirent.name, "package.json"));
    const manifest = readJsonIfExists(
      path.join(extensionsRoot, dirent.name, "openclaw.plugin.json"),
    );
    if (!packageJson && !manifest) {
      continue;
    }

    const providerIds = Object.keys(manifest?.providerAuthEnvVars ?? {});
    const channelId =
      typeof packageJson?.openclaw?.channel?.id === "string"
        ? packageJson.openclaw.channel.id.trim()
        : typeof manifest?.channel?.id === "string"
          ? manifest.channel.id.trim()
          : "";
    const description =
      typeof packageJson?.description === "string" ? packageJson.description.trim() : "";
    entries.push({
      value: dirent.name,
      label: dirent.name,
      hint: buildPluginHint({ channelId, description, providerIds }),
      selected: initiallyExcluded.has(dirent.name),
    });
  }

  return entries.toSorted((left, right) => left.label.localeCompare(right.label));
}

function formatExcludeEnvValue(excluded) {
  return excluded.join(",");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripOptionalQuotes(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function readEnvAssignment(filePath, key) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const pattern = new RegExp(`^(?:export\\s+)?${escapeRegExp(key)}=(.*)$`, "m");
    const match = raw.match(pattern);
    if (!match) {
      return undefined;
    }
    return stripOptionalQuotes(match[1] ?? "");
  } catch {
    return undefined;
  }
}

export function upsertEnvAssignment(filePath, key, value) {
  const line = `${key}=${value}`;
  let current = "";
  try {
    current = fs.readFileSync(filePath, "utf8");
  } catch {
    current = "";
  }
  const pattern = new RegExp(`^(?:export\\s+)?${escapeRegExp(key)}=.*$`, "m");
  const next = pattern.test(current)
    ? current.replace(pattern, line)
    : `${current.replace(/\s*$/u, "")}${current.trim().length > 0 ? "\n" : ""}${line}\n`;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, next, "utf8");
}

function parseCliArgs(argv) {
  let includeOptional = false;
  let writeFile;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--include-optional") {
      includeOptional = true;
      continue;
    }
    if (arg === "--write-file") {
      const next = argv[index + 1];
      if (!next || next.startsWith("--")) {
        throw new Error("--write-file requires a path");
      }
      writeFile = next;
      index += 1;
      continue;
    }
    if (arg?.startsWith("--write-file=")) {
      writeFile = arg.slice("--write-file=".length);
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return { includeOptional, writeFile };
}

export async function selectBundledPluginExclusions(params = {}) {
  const repoRoot = path.resolve(params.repoRoot ?? process.cwd());
  const includeOptional = params.includeOptional === true;
  const writeFile = params.writeFile ? path.resolve(repoRoot, params.writeFile) : undefined;
  const currentExcludeValue =
    params.initiallyExcluded ??
    (writeFile ? readEnvAssignment(writeFile, BUNDLED_PLUGIN_EXCLUDE_ENV) : undefined) ??
    process.env[BUNDLED_PLUGIN_EXCLUDE_ENV] ??
    "";
  const options = collectBundledPluginCatalog({
    repoRoot,
    includeOptional,
    initiallyExcluded: currentExcludeValue,
  });
  const selected = await multiselect({
    message: "Select bundled plugins to exclude from the package",
    options,
    initialValues: options.filter((option) => option.selected).map((option) => option.value),
    required: false,
  });

  if (isCancel(selected)) {
    cancel("Bundled plugin selection cancelled.");
    process.exit(0);
  }

  const excluded = selected.toSorted((left, right) => left.localeCompare(right));
  const excludeValue = formatExcludeEnvValue(excluded);
  if (writeFile) {
    upsertEnvAssignment(writeFile, BUNDLED_PLUGIN_EXCLUDE_ENV, excludeValue);
  }
  const lines = [
    `Excluded plugins (${excluded.length}): ${excluded.length > 0 ? excludeValue : "(none)"}`,
    `Export: ${BUNDLED_PLUGIN_EXCLUDE_ENV}="${excludeValue}"`,
    `Build: ${BUNDLED_PLUGIN_EXCLUDE_ENV}="${excludeValue}" pnpm build`,
  ];
  if (writeFile) {
    lines.push(`Saved to: ${path.relative(repoRoot, writeFile) || path.basename(writeFile)}`);
  }
  if (!includeOptional) {
    lines.push(
      `Optional plugins not shown: ${optionalBundledClusters.filter((id) => id !== "ui").join(", ")}`,
    );
  }
  note(lines.join("\n"), "Bundled plugin exclude list");
  outro("Selection complete.");
  return {
    excluded,
    excludeValue,
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const args = parseCliArgs(process.argv.slice(2));
  await selectBundledPluginExclusions(args);
}
