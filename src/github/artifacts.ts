/**
 * Artifact Upload
 *
 * Uploads screenshots as GitHub workflow artifacts
 */

import * as core from '@actions/core';
import * as artifact from '@actions/artifact';
import * as fs from 'fs';
import * as path from 'path';
import * as github from '@actions/github';

/**
 * Upload screenshots directory as an artifact
 */
export async function uploadScreenshots(
  screenshotsDir: string,
  artifactName: string = 'pencil-design-screenshots'
): Promise<{ artifactId?: number; artifactUrl?: string }> {
  if (!fs.existsSync(screenshotsDir)) {
    core.warning(`Screenshots directory not found: ${screenshotsDir}`);
    return {};
  }

  const files = getAllFiles(screenshotsDir);

  if (files.length === 0) {
    core.info('No files to upload as artifacts');
    return {};
  }

  core.info(`Uploading ${files.length} files as artifact: ${artifactName}`);

  try {
    const artifactClient = new artifact.DefaultArtifactClient();
    const rootDirectory = screenshotsDir;

    const { id, size } = await artifactClient.uploadArtifact(
      artifactName,
      files,
      rootDirectory
    );

    if (size === 0) {
      core.warning('Artifact upload completed but no files were uploaded');
      return {};
    }

    core.info(`Artifact uploaded successfully (${size} bytes)`);

    // Construct artifact URL
    const context = github.context;
    const artifactUrl = `https://github.com/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}/artifacts`;

    return {
      artifactId: id,
      artifactUrl,
    };
  } catch (error) {
    core.warning(`Failed to upload artifacts: ${error}`);
    return {};
  }
}

/**
 * Get all files in a directory recursively
 */
function getAllFiles(dir: string, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      getAllFiles(filePath, fileList);
    } else {
      fileList.push(filePath);
    }
  }

  return fileList;
}

/**
 * Create a summary of uploaded artifacts
 */
export function createArtifactsSummary(
  artifactUrl: string | undefined,
  fileCount: number
): string {
  if (!artifactUrl) {
    return '';
  }

  return `📦 [Download all screenshots (${fileCount} files)](${artifactUrl})`;
}

/**
 * Clean up screenshots directory
 */
export function cleanupScreenshots(screenshotsDir: string): void {
  if (fs.existsSync(screenshotsDir)) {
    fs.rmSync(screenshotsDir, { recursive: true, force: true });
    core.debug(`Cleaned up screenshots directory: ${screenshotsDir}`);
  }
}

/**
 * Ensure screenshots directory exists
 */
export function ensureScreenshotsDir(screenshotsDir: string): void {
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
    core.debug(`Created screenshots directory: ${screenshotsDir}`);
  }
}
