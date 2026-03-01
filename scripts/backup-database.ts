/**
 * Database backup script
 *
 * Usage:
 *   npx tsx scripts/backup-database.ts              # Create backup via Supabase CLI
 *   npx tsx scripts/backup-database.ts --list       # List existing backups
 *   npx tsx scripts/backup-database.ts --clean=7    # Delete backups older than 7 days
 *   npx tsx scripts/backup-database.ts --help       # Show help
 *
 * Requirements:
 *   - Supabase CLI installed: npm install -g supabase
 *   - Logged in: supabase login
 *   - Project linked: supabase link --project-ref <ref>
 *
 * Alternative: Use Supabase Dashboard > Settings > Database > Backups
 */

import "dotenv/config";
import { execSync, spawnSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const BACKUP_DIR = path.join(process.cwd(), "backups");

/**
 * Check if Supabase CLI is available
 */
function checkSupabaseCli(): boolean {
  try {
    execSync("supabase --version", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Create a database backup using Supabase CLI
 */
async function createBackup(): Promise<string | null> {
  // Create backup directory if it doesn't exist
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log(`Created backup directory: ${BACKUP_DIR}`);
  }

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `backup-${timestamp}.sql`;
  const filepath = path.join(BACKUP_DIR, filename);

  console.log("=".repeat(50));
  console.log("Database Backup");
  console.log("=".repeat(50));
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log("");

  // Check for Supabase CLI
  if (!checkSupabaseCli()) {
    console.log("⚠️  Supabase CLI not found.");
    console.log("");
    console.log("Options for backup:");
    console.log("");
    console.log("1. Install Supabase CLI:");
    console.log("   npm install -g supabase");
    console.log("   supabase login");
    console.log("   supabase link --project-ref <your-project-ref>");
    console.log("   npm run db:backup");
    console.log("");
    console.log("2. Use Supabase Dashboard:");
    console.log("   → Settings → Database → Backups");
    console.log("   → Download latest backup");
    console.log("");
    console.log("3. Use direct connection (requires IP whitelist):");
    console.log("   Set DATABASE_DIRECT_URL in .env (not the pooler URL)");
    console.log("   pg_dump $DATABASE_DIRECT_URL > backup.sql");
    console.log("");
    return null;
  }

  console.log("Using Supabase CLI for backup...");
  console.log(`Output: ${filepath}`);
  console.log("");

  try {
    const startTime = Date.now();

    // Run supabase db dump
    const result = spawnSync("supabase", ["db", "dump", "-f", filepath], {
      stdio: ["pipe", "pipe", "pipe"],
      encoding: "utf-8",
    });

    if (result.status !== 0) {
      const error = result.stderr || result.stdout || "Unknown error";
      if (error.includes("not linked")) {
        console.log("⚠️  Project not linked to Supabase.");
        console.log("");
        console.log("Run these commands first:");
        console.log("  supabase login");
        console.log("  supabase link --project-ref <your-project-ref>");
        console.log("");
        console.log("Find your project ref in Supabase Dashboard → Settings → General");
        return null;
      }
      throw new Error(error);
    }

    // Compress the backup
    console.log("Compressing backup...");
    execSync(`gzip "${filepath}"`, { stdio: "pipe" });
    const compressedPath = `${filepath}.gz`;

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const stats = fs.statSync(compressedPath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

    console.log("");
    console.log("✅ Backup completed successfully!");
    console.log(`   File: ${compressedPath}`);
    console.log(`   Size: ${sizeMB} MB`);
    console.log(`   Duration: ${duration}s`);

    return compressedPath;
  } catch (error) {
    // Clean up partial file if exists
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }
    if (fs.existsSync(`${filepath}.gz`)) {
      fs.unlinkSync(`${filepath}.gz`);
    }
    throw error;
  }
}

/**
 * List existing backups
 */
function listBackups(): void {
  console.log("Existing backups:");
  console.log("");

  if (!fs.existsSync(BACKUP_DIR)) {
    console.log("  No backup directory found.");
    return;
  }

  const files = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith("backup-") && (f.endsWith(".sql.gz") || f.endsWith(".sql")))
    .sort()
    .reverse();

  if (files.length === 0) {
    console.log("  No backups found.");
    return;
  }

  let totalSize = 0;

  for (const file of files) {
    const filepath = path.join(BACKUP_DIR, file);
    const stats = fs.statSync(filepath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    const date = new Date(stats.mtime).toLocaleString("fr-FR");
    totalSize += stats.size;

    console.log(`  ${file}`);
    console.log(`    Size: ${sizeMB} MB | Modified: ${date}`);
  }

  console.log("");
  console.log(`Total: ${files.length} backup(s), ${(totalSize / (1024 * 1024)).toFixed(2)} MB`);
}

/**
 * Clean old backups
 */
function cleanBackups(daysToKeep: number): void {
  console.log(`Cleaning backups older than ${daysToKeep} days...`);
  console.log("");

  if (!fs.existsSync(BACKUP_DIR)) {
    console.log("  No backup directory found.");
    return;
  }

  const files = fs.readdirSync(BACKUP_DIR).filter((f) => f.startsWith("backup-"));

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  let deletedCount = 0;
  let deletedSize = 0;

  for (const file of files) {
    const filepath = path.join(BACKUP_DIR, file);
    const stats = fs.statSync(filepath);

    if (stats.mtime < cutoffDate) {
      console.log(`  Deleting: ${file}`);
      deletedSize += stats.size;
      fs.unlinkSync(filepath);
      deletedCount++;
    }
  }

  console.log("");
  if (deletedCount > 0) {
    console.log(
      `✅ Deleted ${deletedCount} backup(s), freed ${(deletedSize / (1024 * 1024)).toFixed(2)} MB`
    );
  } else {
    console.log("No old backups to delete.");
  }
}

/**
 * Show restore instructions
 */
function showRestoreInstructions(backupFile: string | null): void {
  if (!backupFile) return;

  console.log("");
  console.log("To restore this backup:");
  console.log("");
  console.log("  # 1. Decompress the backup");
  console.log(`  gunzip -k ${backupFile}`);
  console.log("");
  console.log("  # 2. Restore via Supabase CLI");
  console.log(`  supabase db reset --linked`);
  console.log(`  psql "$(supabase db url)" < ${backupFile.replace(".gz", "")}`);
  console.log("");
  console.log("  # Or via Supabase Dashboard:");
  console.log("  → Settings → Database → Reset database");
  console.log("  → Then import the SQL file");
  console.log("");
}

// Main
async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Database Backup Script (Supabase)

Usage:
  npx tsx scripts/backup-database.ts              Create a new backup
  npx tsx scripts/backup-database.ts --list       List existing backups
  npx tsx scripts/backup-database.ts --clean=7    Delete backups older than N days
  npx tsx scripts/backup-database.ts --help       Show this help message

Requirements:
  - Supabase CLI: npm install -g supabase
  - Logged in: supabase login
  - Project linked: supabase link --project-ref <ref>

Alternative (no CLI required):
  - Supabase Dashboard → Settings → Database → Backups
  - Download and store backups manually

Note: Supabase Pro ($25/mo) includes daily automatic backups + PITR (7 days)
    `);
    process.exit(0);
  }

  if (args.includes("--list")) {
    listBackups();
    process.exit(0);
  }

  const cleanArg = args.find((a) => a.startsWith("--clean="));
  if (cleanArg) {
    const days = parseInt(cleanArg.split("=")[1]!, 10);
    if (isNaN(days) || days < 1) {
      console.error("Invalid number of days");
      process.exit(1);
    }
    cleanBackups(days);
    process.exit(0);
  }

  // Default: create backup
  try {
    const backupFile = await createBackup();
    showRestoreInstructions(backupFile);
  } catch (error) {
    console.error("❌ Backup failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
