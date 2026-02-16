/**
 * Configuration handling for the action
 */

import * as core from '@actions/core';
import {
  ActionInputs,
  RendererType,
  CommentMode,
  ImageFormat,
  ImageScale,
  ReviewMode,
} from './types';

export function getInputs(): ActionInputs {
  const renderer = (core.getInput('renderer') || 'service') as RendererType;
  const serviceUrl = core.getInput('service-url');
  const serviceApiKey = core.getInput('service-api-key');

  // Validate renderer configuration
  if (renderer === 'service' && !serviceUrl) {
    throw new Error(
      'service-url is required when using the "service" renderer'
    );
  }

  const inputs: ActionInputs = {
    githubToken: core.getInput('github-token', { required: true }),
    renderer: renderer,
    serviceUrl: serviceUrl || undefined,
    serviceApiKey: serviceApiKey || undefined,
    outputDir: core.getInput('output-dir') || '.pencil-screenshots',
    commentMode: (core.getInput('comment-mode') as CommentMode) || 'update',
    uploadArtifacts: core.getBooleanInput('upload-artifacts'),
    includeDeleted: core.getBooleanInput('include-deleted'),
    maxFramesPerFile: parseInt(core.getInput('max-frames-per-file') || '20', 10),
    imageFormat: (core.getInput('image-format') as ImageFormat) || 'webp',
    imageScale: parseInt(core.getInput('image-scale') || '2', 10) as ImageScale,
    imageQuality: parseInt(core.getInput('image-quality') || '90', 10),
    reviewMode: (core.getInput('review-mode') as ReviewMode) || 'full',
  };

  // Mask sensitive inputs
  if (inputs.serviceApiKey) {
    core.setSecret(inputs.serviceApiKey);
  }

  return inputs;
}

export function validateInputs(inputs: ActionInputs): void {
  if (!inputs.githubToken) {
    throw new Error('github-token is required');
  }

  if (!['metadata', 'service'].includes(inputs.renderer)) {
    throw new Error(`Invalid renderer: ${inputs.renderer}. Must be "service" or "metadata"`);
  }

  if (!['create', 'update', 'none'].includes(inputs.commentMode)) {
    throw new Error(`Invalid comment-mode: ${inputs.commentMode}. Must be "create", "update", or "none"`);
  }

  if (!['png', 'jpeg', 'webp'].includes(inputs.imageFormat)) {
    throw new Error(`Invalid image-format: ${inputs.imageFormat}. Must be "png", "jpeg", or "webp"`);
  }

  if (![1, 2, 3].includes(inputs.imageScale)) {
    throw new Error(`Invalid image-scale: ${inputs.imageScale}. Must be 1, 2, or 3`);
  }

  if (inputs.imageQuality < 1 || inputs.imageQuality > 100) {
    throw new Error(`Invalid image-quality: ${inputs.imageQuality}. Must be between 1 and 100`);
  }

  if (inputs.maxFramesPerFile < 0) {
    throw new Error('max-frames-per-file must be a non-negative integer');
  }

  if (!['full', 'diff'].includes(inputs.reviewMode)) {
    throw new Error(`Invalid review-mode: ${inputs.reviewMode}. Must be "full" or "diff"`);
  }
}
