export const optionalBundledClusters = [
  "acpx",
  "diagnostics-otel",
  "diffs",
  "googlechat",
  "matrix",
  "memory-lancedb",
  "msteams",
  "nostr",
  "tlon",
  "twitch",
  "ui",
  "whatsapp",
  "zalouser",
];

export const optionalBundledClusterSet = new Set(optionalBundledClusters);

export const OPTIONAL_BUNDLED_BUILD_ENV = "OPENCLAW_INCLUDE_OPTIONAL_BUNDLED";
export const EXCLUDED_BUNDLED_PLUGINS_ENV = "OPENCLAW_EXCLUDE_BUNDLED_PLUGINS";

function parseBundledClusterList(raw) {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return [];
  }
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function isOptionalBundledCluster(cluster) {
  return optionalBundledClusterSet.has(cluster);
}

export function shouldIncludeOptionalBundledClusters(env = process.env) {
  // Release artifacts should preserve the last shipped upgrade surface by
  // default. Specific size-sensitive lanes can still opt out explicitly.
  return env[OPTIONAL_BUNDLED_BUILD_ENV] !== "0";
}

export function hasReleasedBundledInstall(packageJson) {
  return (
    typeof packageJson?.openclaw?.install?.npmSpec === "string" &&
    packageJson.openclaw.install.npmSpec.trim().length > 0
  );
}

export function getExcludedBundledPlugins(env = process.env) {
  return new Set(parseBundledClusterList(env[EXCLUDED_BUNDLED_PLUGINS_ENV]));
}

export function shouldBuildBundledCluster(cluster, env = process.env, options = {}) {
  return (
    !getExcludedBundledPlugins(env).has(cluster) &&
    (hasReleasedBundledInstall(options.packageJson) ||
      shouldIncludeOptionalBundledClusters(env) ||
      !isOptionalBundledCluster(cluster))
  );
}
