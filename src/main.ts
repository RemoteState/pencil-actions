/**
 * Pencil Design Review GitHub Action
 *
 * Main entry point that orchestrates the design review workflow
 */

import * as core from '@actions/core';
import * as github from '@actions/github';
import * as path from 'path';

import { getInputs, validateInputs } from './config';
import { ActionInputs, PenFile, PenFrame, PenFileCommentData, FrameCommentData, CommentData, DiffFileCommentData, DiffCommentData } from './types';
import { loadPenDocument, getTopLevelFrames } from './pen-parser';
import { getChangedPenFiles, getPRContext, isPullRequestEvent, getFileContentAtRef, readLocalFileAsBase64 } from './github/files';
import { postComment } from './github/comments';
import { uploadScreenshots, ensureScreenshotsDir } from './github/artifacts';
import { buildComment, calculateSummary, buildNoChangesComment, buildDiffComment, calculateDiffSummary } from './comment-builder';
import { MetadataRenderer } from './renderers/metadata';
import { createServiceRenderer, ServiceRenderer } from './renderers/service';
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
    core.info(`Review mode: ${inputs.reviewMode}`);
    core.info(`Comment mode: ${inputs.commentMode}`);

    // Initialize GitHub client
    const octokit = github.getOctokit(inputs.githubToken);
    const prContext = getPRContext();

    // Get changed .pen files
    const changedFiles = await getChangedPenFiles(octokit);

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

    if (inputs.reviewMode === 'diff' && inputs.renderer === 'service') {
      await runDiffMode(inputs, octokit, prContext, changedFiles);
    } else {
      if (inputs.reviewMode === 'diff' && inputs.renderer !== 'service') {
        core.warning('Diff review mode requires renderer: "service". Falling back to full mode.');
      }
      await runFullMode(inputs, octokit, prContext, changedFiles);
    }
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('An unexpected error occurred');
    }
  }
}

/**
 * Run full review mode — renders all frames from every changed .pen file.
 */
async function runFullMode(
  inputs: ActionInputs,
  octokit: ReturnType<typeof github.getOctokit>,
  prContext: ReturnType<typeof getPRContext>,
  changedFiles: PenFile[]
): Promise<void> {
  // Initialize renderer
  const renderer = await initializeRenderer(inputs);

  try {
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
        // Parse the .pen file to get top-level frames (screens/artboards)
        const document = await loadPenDocument(file.path);
        const frames = getTopLevelFrames(document);

        // Limit frames if configured
        const framesToProcess =
          inputs.maxFramesPerFile > 0
            ? frames.slice(0, inputs.maxFramesPerFile)
            : frames;

        core.info(`Found ${frames.length} top-level frames, processing ${framesToProcess.length}`);

        // Render each frame
        const frameResults: FrameCommentData[] = [];

        for (const frame of framesToProcess) {
          const outputPath = getOutputPath(inputs.outputDir, file.path, frame, inputs.imageFormat);

          const result = await renderer.renderFrame(file.path, frame, outputPath);

          frameResults.push({
            id: frame.id,
            name: frame.name,
            screenshotUrl: result.imageUrl,
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

    // Set outputs
    setOutputs({
      screenshotsPath: inputs.outputDir,
      changedFiles: changedFiles.map(f => f.path),
      framesRendered: totalFramesRendered,
    });

    core.info(`✅ Design review complete! Processed ${totalFramesRendered} frames from ${changedFiles.length} files`);
  } finally {
    await renderer.cleanup();
  }
}

/**
 * Run diff review mode — only renders changed frames with before/after comparison.
 * Requires the service renderer.
 */
async function runDiffMode(
  inputs: ActionInputs,
  octokit: ReturnType<typeof github.getOctokit>,
  prContext: ReturnType<typeof getPRContext>,
  changedFiles: PenFile[]
): Promise<void> {
  const renderer = await initializeRenderer(inputs) as ServiceRenderer;

  try {
    const fileResults: DiffFileCommentData[] = [];
    let totalFramesRendered = 0;

    ensureScreenshotsDir(inputs.outputDir);

    for (const file of changedFiles) {
      core.info(`Processing (diff): ${file.path}`);

      if (file.status === 'deleted') {
        if (inputs.includeDeleted) {
          fileResults.push({ path: file.path, status: file.status });
        }
        continue;
      }

      try {
        if (file.status === 'modified' || file.status === 'renamed') {
          // Fetch base version from the base branch via GitHub API
          const basePath = file.previousPath || file.path;
          const basePenBase64 = await getFileContentAtRef(octokit, basePath, prContext.baseSha);

          if (!basePenBase64) {
            core.warning(`Base version not found for ${file.path}, treating as added`);
            const frames = await renderFullFile(renderer, file, inputs);
            fileResults.push({ path: file.path, status: 'added', frames });
            totalFramesRendered += frames.filter(f => !f.error).length;
            continue;
          }

          // Read head version from local checkout
          const headPenBase64 = readLocalFileAsBase64(file.path);

          // Call diff endpoint
          core.info(`Submitting diff for ${file.path}...`);
          const diffResult = await renderer.fetchDiff(basePenBase64, headPenBase64);

          fileResults.push({ path: file.path, status: file.status, diff: diffResult });
          totalFramesRendered += diffResult.summary.added + (diffResult.summary.modified * 2);

        } else if (file.status === 'added') {
          // Added files: render all frames
          const frames = await renderFullFile(renderer, file, inputs);
          fileResults.push({ path: file.path, status: file.status, frames });
          totalFramesRendered += frames.filter(f => !f.error).length;
        }
      } catch (error) {
        core.warning(`Failed to process ${file.path}: ${error}`);
        fileResults.push({
          path: file.path,
          status: file.status,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Upload artifacts
    if (inputs.uploadArtifacts) {
      await uploadScreenshots(inputs.outputDir);
    }

    // Build and post comment
    if (inputs.commentMode !== 'none') {
      const summary = calculateDiffSummary(fileResults);
      const commentData: DiffCommentData = {
        files: fileResults,
        summary,
        prNumber: prContext.prNumber,
        commitSha: prContext.headSha,
      };

      const commentBody = buildDiffComment(commentData);
      const commentId = await postComment(octokit, prContext.prNumber, commentBody, inputs.commentMode);

      if (commentId) {
        core.setOutput('comment-id', commentId.toString());
      }
    }

    setOutputs({
      screenshotsPath: inputs.outputDir,
      changedFiles: changedFiles.map(f => f.path),
      framesRendered: totalFramesRendered,
    });

    core.info(`✅ Diff review complete! Processed ${changedFiles.length} files, ${totalFramesRendered} frames rendered`);
  } finally {
    await renderer.cleanup();
  }
}

/**
 * Render all frames from a file using the full screenshot flow.
 * Used by diff mode for added files.
 */
async function renderFullFile(
  renderer: BaseRenderer,
  file: PenFile,
  inputs: ActionInputs
): Promise<FrameCommentData[]> {
  const document = await loadPenDocument(file.path);
  const frames = getTopLevelFrames(document);
  const framesToProcess = inputs.maxFramesPerFile > 0
    ? frames.slice(0, inputs.maxFramesPerFile)
    : frames;

  const frameResults: FrameCommentData[] = [];
  for (const frame of framesToProcess) {
    const outputPath = getOutputPath(inputs.outputDir, file.path, frame, inputs.imageFormat);
    const result = await renderer.renderFrame(file.path, frame, outputPath);
    frameResults.push({
      id: frame.id,
      name: frame.name,
      screenshotUrl: result.imageUrl,
      screenshotPath: result.success ? result.screenshotPath : undefined,
      error: result.error,
    });
  }
  return frameResults;
}

/**
 * Initialize the appropriate renderer based on configuration
 */
async function initializeRenderer(inputs: ActionInputs): Promise<BaseRenderer> {
  let renderer: BaseRenderer;

  if (inputs.renderer === 'service' && inputs.serviceUrl) {
    core.info('Using service renderer (pencil-screenshot-service)');
    renderer = createServiceRenderer(
      inputs.serviceUrl,
      inputs.serviceApiKey,
      inputs.imageFormat,
      inputs.imageScale,
      inputs.imageQuality
    );
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
