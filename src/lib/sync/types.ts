/**
 * Shared types for sync scripts
 */

/**
 * Options passed to sync handlers
 */
export interface SyncOptions {
  dryRun?: boolean;
  limit?: number;
  verbose?: boolean;
  [key: string]: unknown;
}

/**
 * Result returned by sync handlers
 */
export interface SyncResult {
  success: boolean;
  duration: number;
  stats: Record<string, number>;
  errors: string[];
}

/**
 * CLI option definition for help display
 */
export interface CLIOptionDefinition {
  name: string; // "--limit"
  alias?: string; // "-l"
  type: "boolean" | "number" | "string";
  description: string;
  default?: unknown;
}

/**
 * Sync handler interface - implemented by each sync script
 */
export interface SyncHandler {
  /** Display name for the script */
  name: string;

  /** Short description shown in headers */
  description: string;

  /** Custom CLI options beyond the standard ones */
  options?: CLIOptionDefinition[];

  /** Display help message */
  showHelp(): void;

  /** Display current statistics */
  showStats(): Promise<void>;

  /** Run the sync operation */
  sync(options: SyncOptions): Promise<SyncResult>;
}
