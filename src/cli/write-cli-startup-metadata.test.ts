import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  readBundledChannelCatalogIds,
  writeCliStartupMetadata,
} from "../../scripts/write-cli-startup-metadata.ts";

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

describe("writeCliStartupMetadata", () => {
  it("omits explicitly excluded bundled channel plugins from the catalog", () => {
    const repoRoot = makeRepoRoot("openclaw-cli-startup-metadata-");
    writeJson(path.join(repoRoot, "extensions", "alpha", "package.json"), {
      name: "@openclaw/alpha",
      openclaw: {
        channel: {
          id: "alpha",
          order: 5,
          label: "Alpha",
        },
      },
    });
    writeJson(path.join(repoRoot, "extensions", "beta", "package.json"), {
      name: "@openclaw/beta",
      openclaw: {
        channel: {
          id: "beta",
          order: 10,
          label: "Beta",
        },
      },
    });

    expect(
      readBundledChannelCatalogIds({
        rootDir: repoRoot,
        env: { OPENCLAW_EXCLUDE_BUNDLED_PLUGINS: "alpha" },
      }),
    ).toEqual(["beta"]);
  });

  it("writes deduped core and bundled channel options", () => {
    const repoRoot = makeRepoRoot("openclaw-cli-startup-metadata-write-");
    writeJson(path.join(repoRoot, "extensions", "zalo", "package.json"), {
      name: "@openclaw/zalo",
      openclaw: {
        channel: {
          id: "zalo",
          order: 20,
          label: "Zalo",
        },
      },
    });

    writeCliStartupMetadata({ rootDir: repoRoot, env: {} });

    const written = JSON.parse(
      fs.readFileSync(path.join(repoRoot, "dist", "cli-startup-metadata.json"), "utf8"),
    ) as {
      channelOptions?: string[];
    };
    expect(written.channelOptions).toContain("telegram");
    expect(written.channelOptions).toContain("zalo");
    expect(written.channelOptions?.filter((value) => value === "whatsapp")).toHaveLength(1);
  });
});
