/**
 * Artifact Manager
 *
 * Handles test artifact collection, packaging, and upload.
 */

import { mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { arch, platform } from 'node:os';
import { createHash } from 'node:crypto';
import type { ArtifactConfig } from '../../types/ci';

/**
 * Artifact metadata
 */
export interface ArtifactMetadata {
  /** Artifact name */
  name: string;
  /** Artifact size in bytes */
  size: number;
  /** File count */
  fileCount: number;
  /** Checksum (SHA256) */
  checksum: string;
  /** Created at timestamp */
  createdAt: string;
  /** Platform info */
  platform: string;
  /** Architecture */
  arch: string;
}

/**
 * Artifact collection result
 */
export interface ArtifactCollection {
  /** Metadata */
  metadata: ArtifactMetadata;
  /** Collected files */
  files: string[];
}

/**
 * Artifact Manager
 *
 * Manages test artifacts like screenshots, videos, logs, etc.
 */
export class ArtifactManager {
  private config: ArtifactConfig;

  constructor(config: ArtifactConfig) {
    this.config = config;
  }

  /**
   * Collect artifacts based on configuration
   */
  async collect(baseDir: string): Promise<ArtifactCollection> {
    if (!this.config.enabled) {
      return {
        metadata: this.createMetadata([], 0),
        files: [],
      };
    }

    const files: string[] = [];
    const seen = new Set<string>();

    for (const pattern of this.config.includePaths) {
      const resolvedPath = join(baseDir, pattern);

      try {
        const stats = statSync(resolvedPath);

        if (stats.isFile()) {
          if (this.shouldInclude(resolvedPath) && !seen.has(resolvedPath)) {
            files.push(resolvedPath);
            seen.add(resolvedPath);
          }
        } else if (stats.isDirectory()) {
          this.collectDirectory(resolvedPath, files, seen);
        }
      } catch {
        // Path doesn't exist or is inaccessible - skip
        continue;
      }
    }

    // Calculate total size
    let totalSize = 0;
    for (const file of files) {
      try {
        totalSize += statSync(file).size;
      } catch {
        // Skip files that can't be read
      }
    }

    return {
      metadata: this.createMetadata(files, totalSize),
      files,
    };
  }

  /**
   * Generate artifact manifest
   */
  generateManifest(collection: ArtifactCollection): string {
    const manifest = {
      metadata: collection.metadata,
      files: collection.files.map((file) => ({
        path: relative(process.cwd(), file),
        size: statSync(file).size,
        modified: statSync(file).mtime.toISOString(),
      })),
    };

    return JSON.stringify(manifest, null, 2);
  }

  /**
   * Save artifact manifest to file
   */
  async saveManifest(
    collection: ArtifactCollection,
    outputDir: string,
  ): Promise<string> {
    const manifestPath = join(outputDir, 'artifact-manifest.json');
    const manifestContent = this.generateManifest(collection);

    // Ensure output directory exists
    mkdirSync(outputDir, { recursive: true });

    writeFileSync(manifestPath, manifestContent, 'utf-8');
    return manifestPath;
  }

  /**
   * Create artifact metadata
   */
  private createMetadata(files: string[], totalSize: number): ArtifactMetadata {
    const timestamp = new Date().toISOString();
    const checksum = this.generateChecksum(files);

    return {
      name: this.resolveArtifactName(),
      size: totalSize,
      fileCount: files.length,
      checksum,
      createdAt: timestamp,
      platform: platform(),
      arch: arch(),
    };
  }

  /**
   * Generate SHA256 checksum for files
   */
  private generateChecksum(files: string[]): string {
    const hash = createHash('sha256');

    // Sort files for consistent checksums
    const sorted = [...files].sort();

    for (const file of sorted) {
      try {
        const stats = statSync(file);
        // Include file path, size, and mtime in checksum
        hash.update(relative(process.cwd(), file));
        hash.update(stats.size.toString());
        hash.update(stats.mtimeMs.toString());
      } catch {
        // Skip files that can't be read
      }
    }

    return hash.digest('hex').substring(0, 16);
  }

  /**
   * Resolve artifact name from pattern
   */
  private resolveArtifactName(): string {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-');

    return this.config.namePattern
      .replace('{timestamp}', timestamp)
      .replace('{date}', now.toISOString().split('T')[0])
      .replace('{time}', now.toTimeString().split(' ')[0].replace(/:/g, '-'))
      .replace('{platform}', platform())
      .replace('{arch}', arch());
  }

  /**
   * Recursively collect files from directory
   */
  private collectDirectory(
    dirPath: string,
    files: string[],
    seen: Set<string>,
  ): void {
    try {
      const entries = readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dirPath, entry.name);

        if (entry.isDirectory()) {
          this.collectDirectory(fullPath, files, seen);
        } else if (entry.isFile() && this.shouldInclude(fullPath)) {
          if (!seen.has(fullPath)) {
            files.push(fullPath);
            seen.add(fullPath);
          }
        }
      }
    } catch {
      // Directory not readable - skip
    }
  }

  /**
   * Check if path should be included based on exclusion rules
   */
  private shouldInclude(path: string): boolean {
    const normalized = path.replace(/\\/g, '/');

    for (const exclude of this.config.excludePaths) {
      if (normalized.includes(exclude.replace(/\\/g, '/'))) {
        return false;
      }
    }

    return true;
  }
}

/**
 * Create artifact manager with config
 */
export function createArtifactManager(
  config: Partial<ArtifactConfig> = {},
): ArtifactManager {
  const defaultConfig: ArtifactConfig = {
    enabled: true,
    namePattern: 'midscene-artifacts-{timestamp}',
    includePaths: ['./test-results', './screenshots', './videos'],
    excludePaths: ['node_modules', '.git', 'dist', 'build'],
    retentionDays: 30,
  };

  return new ArtifactManager({ ...defaultConfig, ...config });
}
