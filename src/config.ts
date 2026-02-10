/**
 * Configuration handling for the action
 */

import * as core from '@actions/core';
import {
  ActionInputs,
  RendererType,
  CommentMode,
  ImageFormat,
} from './types';

export function getInputs(): ActionInputs {
  const renderer = (core.getInput('renderer') || 'metadata') as RendererType;
  const claudeApiKey = core.getInput('anthropic-api-key');

  // Validate renderer configuration
  if (renderer === 'claude' && !claudeApiKey) {
    throw new Error(
      'anthropic-api-key is required when using the "claude" renderer'
    );
  }

  const inputs: ActionInputs = {
    githubToken: core.getInput('github-token', { required: true }),
    penFilesPattern: core.getInput('pen-files') || '**/*.pen',
    renderer: renderer,
    claudeApiKey: claudeApiKey || undefined,
    outputDir: core.getInput('output-dir') || '.pencil-screenshots',
    commentMode: (core.getInput('comment-mode') as CommentMode) || 'update',
    uploadArtifacts: core.getBooleanInput('upload-artifacts'),
    includeDeleted: core.getBooleanInput('include-deleted'),
    maxFramesPerFile: parseInt(core.getInput('max-frames-per-file') || '20', 10),
    imageFormat: (core.getInput('image-format') as ImageFormat) || 'png',
  };

  // Mask sensitive inputs
  if (inputs.claudeApiKey) {
    core.setSecret(inputs.claudeApiKey);
  }

  return inputs;
}

export function validateInputs(inputs: ActionInputs): void {
  if (!inputs.githubToken) {
    throw new Error('github-token is required');
  }

  if (!['claude', 'metadata'].includes(inputs.renderer)) {
    throw new Error(`Invalid renderer: ${inputs.renderer}. Must be "claude" or "metadata"`);
  }

  if (!['create', 'update', 'none'].includes(inputs.commentMode)) {
    throw new Error(`Invalid comment-mode: ${inputs.commentMode}. Must be "create", "update", or "none"`);
  }

  if (!['png', 'jpeg'].includes(inputs.imageFormat)) {
    throw new Error(`Invalid image-format: ${inputs.imageFormat}. Must be "png" or "jpeg"`);
  }

  if (inputs.maxFramesPerFile < 0) {
    throw new Error('max-frames-per-file must be a non-negative integer');
  }
}
