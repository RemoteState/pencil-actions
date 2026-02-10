/**
 * Pencil Design Review GitHub Action
 *
 * Main entry point that orchestrates the design review workflow
 */

import * as core from '@actions/core';
import * as github from '@actions/github';
import * as path from 'path';

import { getInputs, validateInputs } from './config';
import { ActionInputs, PenFile, PenFrame, RenderResult, PenFileCommentData, FrameCommentData, CommentData } from './types';
import { parsePenFile } from './pen-parser';
import { getChangedPenFiles, getPRContext, isPullRequestEvent } from './github/files';
import { postComment } from './github/comments';
import { uploadScreenshots, ensureScreenshotsDir } from './github/artifacts';
import { buildComment, calculateSummary, buildNoChangesComment } from './comment-builder';
import { MetadataRenderer } from './renderers/metadata';
import { ClaudeRenderer, createClaudeRenderer } from './renderers/claude';
import { BaseRenderer } from './renderers/base';

async function run(): Promise<void> {
  try {
    // Validate we're in a PR context
    if (!isPullRequestEvent()) {
      core.setFailed('This action can only be run on pull_request events');
      return;
    }

    // Get and validate inputs
    const inputs = getInputs();
    validateInputs(inputs);

    core.info('🎨 Starting Pencil Design Review');
    core.info(`Renderer: ${inputs.renderer}`);
    core.info(`Comment mode: ${inputs.commentMode}`);

    // Initialize GitHub client
    const octokit = github.getOctokit(inputs.githubToken);
    const prContext = getPRContext();

    // Get changed .pen files
    const changedFiles = await getChangedPenFiles(octokit, inputs.penFilesPattern);

    if (changedFiles.length === 0) {
      core.info('No .pen files changed in this PR');

      if (inputs.commentMode !== 'none') {
        await postComment(
          octokit,
          prContext.prNumber,
          buildNoChangesComment(),
          inputs.commentMode
        );
      }

      setOutputs({ screenshotsPath: '', changedFiles: [], framesRendered: 0 });
      return;
    }

    core.info(`Found ${changedFiles.length} changed .pen files`);

    // Initialize renderer
    const renderer = await initializeRenderer(inputs);

    // Process each file
    const fileResults: PenFileCommentData[] = [];
    let totalFramesRendered = 0;

    ensureScreenshotsDir(inputs.outputDir);

    for (const file of changedFiles) {
      core.info(`Processing: ${file.path}`);

      if (file.status === 'deleted') {
        // For deleted files, just note they were deleted
        fileResults.push({
          path: file.path,
          status: file.status,
          frames: [],
        });
        continue;
      }

      try {
        // Parse the .pen file to get frames
        const frames = await parsePenFile(file.path);

        // Limit frames if configured
        const framesToProcess =
          inputs.maxFramesPerFile > 0
            ? frames.slice(0, inputs.maxFramesPerFile)
            : frames;

        core.info(`Found ${frames.length} frames, processing ${framesToProcess.length}`);

        // Render each frame
        const frameResults: FrameCommentData[] = [];

        for (const frame of framesToProcess) {
          const outputPath = getOutputPath(inputs.outputDir, file.path, frame, inputs.imageFormat);

          const result = await renderer.renderFrame(file.path, frame, outputPath);

          frameResults.push({
            id: frame.id,
            name: frame.name,
            screenshotPath: result.success ? result.screenshotPath : undefined,
            error: result.error,
          });

          if (result.success) {
            totalFramesRendered++;
          }
        }

        fileResults.push({
          path: file.path,
          status: file.status,
          frames: frameResults,
        });
      } catch (error) {
        core.warning(`Failed to process ${file.path}: ${error}`);
        fileResults.push({
          path: file.path,
          status: file.status,
          frames: [
            {
              id: 'error',
              name: 'Processing Error',
              error: error instanceof Error ? error.message : 'Unknown error',
            },
          ],
        });
      }
    }

    // Upload screenshots as artifacts
    let artifactUrl: string | undefined;
    if (inputs.uploadArtifacts) {
      const uploadResult = await uploadScreenshots(inputs.outputDir);
      artifactUrl = uploadResult.artifactUrl;
    }

    // Build and post comment
    if (inputs.commentMode !== 'none') {
      const summary = calculateSummary(fileResults);

      const commentData: CommentData = {
        files: fileResults,
        summary,
        prNumber: prContext.prNumber,
        commitSha: prContext.headSha,
      };

      const commentBody = buildComment(commentData);
      const commentId = await postComment(
        octokit,
        prContext.prNumber,
        commentBody,
        inputs.commentMode
      );

      if (commentId) {
        core.setOutput('comment-id', commentId.toString());
      }
    }

    // Cleanup renderer
    await renderer.cleanup();

    // Set outputs
    setOutputs({
      screenshotsPath: inputs.outputDir,
      changedFiles: changedFiles.map(f => f.path),
      framesRendered: totalFramesRendered,
    });

    core.info(`✅ Design review complete! Processed ${totalFramesRendered} frames from ${changedFiles.length} files`);
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('An unexpected error occurred');
    }
  }
}

/**
 * Initialize the appropriate renderer based on configuration
 */
async function initializeRenderer(inputs: ActionInputs): Promise<BaseRenderer> {
  let renderer: BaseRenderer;

  if (inputs.renderer === 'claude' && inputs.claudeApiKey) {
    core.info('Using Claude renderer (visual mode)');
    renderer = createClaudeRenderer(inputs.claudeApiKey, inputs.imageFormat);
  } else {
    core.info('Using metadata renderer (no screenshots)');
    renderer = new MetadataRenderer();
  }

  await renderer.initialize();
  return renderer;
}

/**
 * Generate output path for a frame screenshot
 */
function getOutputPath(
  outputDir: string,
  penFilePath: string,
  frame: PenFrame,
  format: string
): string {
  // Create a safe filename from the frame name
  const safeName = frame.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const penFileName = path.basename(penFilePath, '.pen');

  return path.join(outputDir, penFileName, `${safeName}-${frame.id}.${format}`);
}

/**
 * Set action outputs
 */
function setOutputs(outputs: {
  screenshotsPath: string;
  changedFiles: string[];
  framesRendered: number;
  commentId?: number;
}): void {
  core.setOutput('screenshots-path', outputs.screenshotsPath);
  core.setOutput('changed-files', JSON.stringify(outputs.changedFiles));
  core.setOutput('frames-rendered', outputs.framesRendered.toString());

  if (outputs.commentId) {
    core.setOutput('comment-id', outputs.commentId.toString());
  }
}

run();
