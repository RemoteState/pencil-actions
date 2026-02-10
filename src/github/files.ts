/**
 * GitHub file detection utilities
 *
 * Detects changed .pen files in a pull request
 */

import * as core from '@actions/core';
import * as github from '@actions/github';
import { PenFile, FileStatus } from '../types';

type Octokit = ReturnType<typeof github.getOctokit>;

/**
 * Get all .pen files that were changed in the current PR
 */
export async function getChangedPenFiles(
  octokit: Octokit,
  pattern: string = '**/*.pen'
): Promise<PenFile[]> {
  const context = github.context;

  if (!context.payload.pull_request) {
    throw new Error('This action can only be run on pull_request events');
  }

  const prNumber = context.payload.pull_request.number;
  const owner = context.repo.owner;
  const repo = context.repo.repo;

  core.info(`Fetching changed files for PR #${prNumber}`);

  // Fetch all files changed in the PR (paginated)
  const changedFiles: PenFile[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const response = await octokit.rest.pulls.listFiles({
      owner,
      repo,
      pull_number: prNumber,
      page,
      per_page: perPage,
    });

    for (const file of response.data) {
      // Check if file matches .pen pattern
      if (file.filename.endsWith('.pen')) {
        changedFiles.push({
          path: file.filename,
          status: mapFileStatus(file.status),
          frames: [], // Will be populated by the parser
        });
      }
    }

    // Check if there are more pages
    if (response.data.length < perPage) {
      break;
    }
    page++;
  }

  core.info(`Found ${changedFiles.length} changed .pen files`);

  return changedFiles;
}

/**
 * Map GitHub file status to our FileStatus type
 */
function mapFileStatus(status: string): FileStatus {
  switch (status) {
    case 'added':
      return 'added';
    case 'removed':
      return 'deleted';
    case 'modified':
    case 'changed':
      return 'modified';
    case 'renamed':
      return 'renamed';
    default:
      return 'modified';
  }
}

/**
 * Get the base and head SHAs for the PR
 */
export function getPRContext(): {
  baseSha: string;
  headSha: string;
  prNumber: number;
  owner: string;
  repo: string;
} {
  const context = github.context;

  if (!context.payload.pull_request) {
    throw new Error('This action can only be run on pull_request events');
  }

  return {
    baseSha: context.payload.pull_request.base.sha,
    headSha: context.payload.pull_request.head.sha,
    prNumber: context.payload.pull_request.number,
    owner: context.repo.owner,
    repo: context.repo.repo,
  };
}

/**
 * Check if we're running in a PR context
 */
export function isPullRequestEvent(): boolean {
  return !!github.context.payload.pull_request;
}

/**
 * Get file content from a specific ref
 */
export async function getFileContent(
  octokit: Octokit,
  filePath: string,
  ref: string
): Promise<string | null> {
  const context = github.context;

  try {
    const response = await octokit.rest.repos.getContent({
      owner: context.repo.owner,
      repo: context.repo.repo,
      path: filePath,
      ref,
    });

    if ('content' in response.data && response.data.content) {
      return Buffer.from(response.data.content, 'base64').toString('utf-8');
    }

    return null;
  } catch (error) {
    // File doesn't exist at this ref
    return null;
  }
}
