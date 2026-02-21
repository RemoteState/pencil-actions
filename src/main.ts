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
import { createServiceRenderer, ServiceRenderer } from './renderers/service';

const OUTPUT_DIR = '.pencil-screenshots';

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
          buildNoChangesComment(inputs.commentId),
          inputs.commentMode,
          inputs.commentId
        );
      }

      setOutputs({ screenshotsPath: '', changedFiles: [], framesRendered: 0 });
      return;
    }

    core.info(`Found ${changedFiles.length} changed .pen files`);

    if (inputs.reviewMode === 'diff') {
      await runDiffMode(inputs, octokit, prContext, changedFiles);
    } else {
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
    ensureScreenshotsDir(OUTPUT_DIR);

    // Process all files in parallel
    const fileResults = await Promise.all(changedFiles.map(async (file): Promise<PenFileCommentData> => {
      core.info(`Processing: ${file.path}`);

      if (file.status === 'deleted') {
        return { path: file.path, status: file.status, frames: [] };
      }

      try {
        const document = await loadPenDocument(file.path);
        const frames = getTopLevelFrames(document);
        const framesToProcess =
          inputs.maxFramesPerFile > 0
            ? frames.slice(0, inputs.maxFramesPerFile)
            : frames;

        core.info(`[${path.basename(file.path)}] Found ${frames.length} top-level frames, processing ${framesToProcess.length}`);

        // Render frames (fetchAllFrames is called once per file, then images download from cache)
        const frameResults: FrameCommentData[] = [];
        for (const frame of framesToProcess) {
          const outputPath = getOutputPath(OUTPUT_DIR, file.path, frame, inputs.imageFormat);
          const result = await renderer.renderFrame(file.path, frame, outputPath);
          frameResults.push({
            id: frame.id,
            name: frame.name,
            screenshotUrl: result.imageUrl,
            screenshotPath: result.success ? result.screenshotPath : undefined,
            error: result.error,
          });
        }

        return { path: file.path, status: file.status, frames: frameResults };
      } catch (error) {
        core.warning(`Failed to process ${file.path}: ${error}`);
        return {
          path: file.path,
          status: file.status,
          frames: [{
            id: 'error',
            name: 'Processing Error',
            error: error instanceof Error ? error.message : 'Unknown error',
          }],
        };
      }
    }));

    const totalFramesRendered = fileResults.reduce(
      (sum, f) => sum + f.frames.filter(fr => !fr.error).length, 0
    );

    // Upload screenshots as artifacts
    let artifactUrl: string | undefined;
    if (inputs.uploadArtifacts) {
      const uploadResult = await uploadScreenshots(OUTPUT_DIR);
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
        artifactUrl,
      };

      const commentBody = buildComment(commentData, inputs.commentId);
      const postedCommentId = await postComment(
        octokit,
        prContext.prNumber,
        commentBody,
        inputs.commentMode,
        inputs.commentId
      );

      if (postedCommentId) {
        core.setOutput('comment-id', postedCommentId.toString());
      }
    }

    // Set outputs
    setOutputs({
      screenshotsPath: OUTPUT_DIR,
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
    ensureScreenshotsDir(OUTPUT_DIR);

    // Process all files in parallel
    const rawResults = await Promise.all(changedFiles.map(async (file): Promise<DiffFileCommentData | null> => {
      core.info(`Processing (diff): ${file.path}`);

      if (file.status === 'deleted') {
        return inputs.includeDeleted ? { path: file.path, status: file.status } : null;
      }

      try {
        if (file.status === 'modified' || file.status === 'renamed') {
          const basePath = file.previousPath || file.path;
          const basePenBase64 = await getFileContentAtRef(octokit, basePath, prContext.baseSha);

          if (!basePenBase64) {
            core.warning(`Base version not found for ${file.path}, treating as added`);
            const frames = await renderFullFile(renderer, file, inputs);
            return { path: file.path, status: 'added' as const, frames };
          }

          const headPenBase64 = readLocalFileAsBase64(file.path);
          core.info(`Submitting diff for ${file.path}...`);
          const diffResult = await renderer.fetchDiff(basePenBase64, headPenBase64);
          return { path: file.path, status: file.status, diff: diffResult };

        } else if (file.status === 'added') {
          const frames = await renderFullFile(renderer, file, inputs);
          return { path: file.path, status: file.status, frames };
        }

        return null;
      } catch (error) {
        core.warning(`Failed to process ${file.path}: ${error}`);
        return {
          path: file.path,
          status: file.status,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }));

    const fileResults = rawResults.filter((r): r is DiffFileCommentData => r !== null);
    let totalFramesRendered = 0;
    for (const f of fileResults) {
      if (f.diff) {
        totalFramesRendered += f.diff.summary.added + (f.diff.summary.modified * 2);
      } else if (f.frames) {
        totalFramesRendered += f.frames.filter(fr => !fr.error).length;
      }
    }

    // Upload artifacts
    let artifactUrl: string | undefined;
    if (inputs.uploadArtifacts) {
      const uploadResult = await uploadScreenshots(OUTPUT_DIR);
      artifactUrl = uploadResult.artifactUrl;
    }

    // Build and post comment
    if (inputs.commentMode !== 'none') {
      const summary = calculateDiffSummary(fileResults);
      const commentData: DiffCommentData = {
        files: fileResults,
        summary,
        prNumber: prContext.prNumber,
        commitSha: prContext.headSha,
        artifactUrl,
        serviceUrl: inputs.serviceUrl,
      };

      const commentBody = buildDiffComment(commentData, inputs.commentId);
      const postedCommentId = await postComment(octokit, prContext.prNumber, commentBody, inputs.commentMode, inputs.commentId);

      if (postedCommentId) {
        core.setOutput('comment-id', postedCommentId.toString());
      }
    }

    setOutputs({
      screenshotsPath: OUTPUT_DIR,
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
  renderer: ServiceRenderer,
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
    const outputPath = getOutputPath(OUTPUT_DIR, file.path, frame, inputs.imageFormat);
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
async function initializeRenderer(inputs: ActionInputs): Promise<ServiceRenderer> {
  core.info('Using service renderer (pencil-screenshot-service)');
  const renderer = createServiceRenderer(
    inputs.serviceUrl!,
    inputs.serviceApiKey,
    inputs.imageFormat,
    inputs.imageScale,
    inputs.imageQuality
  );

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
