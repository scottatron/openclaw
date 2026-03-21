import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  BUNDLED_PLUGIN_EXCLUDE_ENV,
  collectBundledPluginCatalog,
  readEnvAssignment,
  upsertEnvAssignment,
} from "../../scripts/select-bundled-plugin-exclusions.mjs";

const tempDirs: string[] = [];

function makeRepoRoot(prefix: string): string {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(repoRoot);
  return repoRoot;
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

afterEach(() => {
  for (const dir of tempDirs.splice(0, tempDirs.length)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("collectBundledPluginCatalog", () => {
  it("lists default bundled plugins and preselects current exclusions", () => {
    const repoRoot = makeRepoRoot("openclaw-bundled-plugin-selector-");
    writeJson(path.join(repoRoot, "extensions", "slack", "package.json"), {
      name: "@openclaw/slack",
      description: "Slack channel plugin",
      openclaw: { channel: { id: "slack" } },
    });
    writeJson(path.join(repoRoot, "extensions", "slack", "openclaw.plugin.json"), {
      id: "slack",
    });
    writeJson(path.join(repoRoot, "extensions", "matrix", "package.json"), {
      name: "@openclaw/matrix",
      description: "Matrix channel plugin",
      openclaw: { channel: { id: "matrix" } },
    });
    writeJson(path.join(repoRoot, "extensions", "matrix", "openclaw.plugin.json"), {
      id: "matrix",
      providerAuthEnvVars: {
        matrix: ["MATRIX_TOKEN"],
      },
    });

    expect(
      collectBundledPluginCatalog({
        repoRoot,
        initiallyExcluded: "slack",
      }),
    ).toEqual([
      {
        value: "slack",
        label: "slack",
        hint: "channel:slack | Slack channel plugin",
        selected: true,
      },
    ]);
  });

  it("can include optional plugins in the selector", () => {
    const repoRoot = makeRepoRoot("openclaw-bundled-plugin-selector-optional-");
    writeJson(path.join(repoRoot, "extensions", "matrix", "package.json"), {
      name: "@openclaw/matrix",
      description: "Matrix channel plugin",
    });
    writeJson(path.join(repoRoot, "extensions", "matrix", "openclaw.plugin.json"), {
      id: "matrix",
      providerAuthEnvVars: {
        matrix: ["MATRIX_TOKEN"],
      },
    });

    expect(
      collectBundledPluginCatalog({
        repoRoot,
        includeOptional: true,
      }),
    ).toEqual([
      {
        value: "matrix",
        label: "matrix",
        hint: "providers:matrix | Matrix channel plugin",
        selected: false,
      },
    ]);
  });
});

describe("env file helpers", () => {
  it("reads an existing exclusion value from an env file", () => {
    const repoRoot = makeRepoRoot("openclaw-bundled-plugin-selector-env-");
    const envFile = path.join(repoRoot, ".env.local");
    fs.writeFileSync(envFile, `${BUNDLED_PLUGIN_EXCLUDE_ENV}="slack,zalo"\n`, "utf8");

    expect(readEnvAssignment(envFile, BUNDLED_PLUGIN_EXCLUDE_ENV)).toBe("slack,zalo");
  });

  it("upserts the exclusion value into an env file", () => {
    const repoRoot = makeRepoRoot("openclaw-bundled-plugin-selector-env-write-");
    const envFile = path.join(repoRoot, ".env.local");
    fs.writeFileSync(envFile, "FOO=bar\n", "utf8");

    upsertEnvAssignment(envFile, BUNDLED_PLUGIN_EXCLUDE_ENV, "slack,zalo");
    upsertEnvAssignment(envFile, BUNDLED_PLUGIN_EXCLUDE_ENV, "slack");

    expect(fs.readFileSync(envFile, "utf8")).toBe(`FOO=bar\n${BUNDLED_PLUGIN_EXCLUDE_ENV}=slack\n`);
  });
});
