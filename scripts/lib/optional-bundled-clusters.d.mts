export const optionalBundledClusters: string[];
export const optionalBundledClusterSet: Set<string>;
export const OPTIONAL_BUNDLED_BUILD_ENV: "OPENCLAW_INCLUDE_OPTIONAL_BUNDLED";
export const EXCLUDED_BUNDLED_PLUGINS_ENV: "OPENCLAW_EXCLUDE_BUNDLED_PLUGINS";
export function isOptionalBundledCluster(cluster: string): boolean;
export function shouldIncludeOptionalBundledClusters(env?: NodeJS.ProcessEnv): boolean;
export function hasReleasedBundledInstall(packageJson: unknown): boolean;
export function getExcludedBundledPlugins(env?: NodeJS.ProcessEnv): Set<string>;
export function shouldBuildBundledCluster(
  cluster: string,
  env?: NodeJS.ProcessEnv,
  options?: { packageJson?: unknown },
): boolean;
