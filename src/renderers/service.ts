/**
 * Service renderer — calls pencil-screenshot-service API
 *
 * Handles the per-frame vs per-file mismatch: the API takes an entire .pen file
 * and returns all frames at once, but renderFrame() is called per frame.
 * Solution: batch-and-cache. On first call for a .pen file, send the whole file
 * to the API and cache all frame results. Subsequent calls return from cache.
 *
 * Uses async job queue: POST returns 202 with jobId, then we poll GET /jobs/:jobId
 * until the job completes. This avoids Cloudflare's 100s gateway timeout.
 *
 * Supports two auth modes:
 * - API key (paid): uses service-api-key input
 * - OIDC (free): requests GitHub Actions OIDC token for pencil.remotestate.com
 */

import * as core from '@actions/core';
import * as fs from 'fs';
import * as path from 'path';

import { BaseRenderer, createSuccessResult, createErrorResult } from './base';
import { PenFrame, ScreenshotResult, ImageFormat, ImageScale } from '../types';

interface ServiceRendererOptions {
  serviceUrl: string;
  apiKey?: string;
  imageFormat: ImageFormat;
  imageScale: ImageScale;
  imageQuality: number;
}

interface ServiceScreenshot {
  frameId: string;
  frameName: string;
  width: number;
  height: number;
  format: string;
  scale: number;
  imageUrl: string;
}

interface ServiceResponse {
  success: boolean;
  screenshots: ServiceScreenshot[];
  errors?: Array<{ frameId: string; frameName: string; error: string }>;
}

interface JobSubmitResponse {
  jobId: string;
  status: string;
  queuePosition: number;
  pollUrl: string;
}

interface JobStatusResponse {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  queuePosition: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  result?: ServiceResponse;
  error?: string;
}

/** Cached result for a single frame from the API */
interface CachedFrame {
  format: string;
  width: number;
  height: number;
  imageUrl: string;
}

const POLL_INITIAL_INTERVAL_MS = 2000;
const POLL_MULTIPLIER = 1.5;
const POLL_MAX_INTERVAL_MS = 15000;
const POLL_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const TOKEN_REFRESH_MS = 4 * 60 * 1000; // refresh OIDC token every 4 minutes

export class ServiceRenderer extends BaseRenderer {
  name = 'service';

  private serviceUrl: string;
  private apiKey?: string;
  private authToken?: string;
  private tokenAcquiredAt = 0;
  private imageFormat: ImageFormat;
  private imageScale: ImageScale;
  private imageQuality: number;

  /** Cache: penFilePath → Map<frameId, CachedFrame> */
  private cache = new Map<string, Map<string, CachedFrame>>();
  /** Track which files have been sent to the API (even if they returned errors) */
  private sentFiles = new Set<string>();

  constructor(options: ServiceRendererOptions) {
    super();
    this.serviceUrl = options.serviceUrl.replace(/\/+$/, ''); // strip trailing slash
    this.apiKey = options.apiKey;
    this.imageFormat = options.imageFormat;
    this.imageScale = options.imageScale;
    this.imageQuality = options.imageQuality;
  }

  async initialize(): Promise<void> {
    if (this.apiKey) {
      // Paid tier — use API key directly
      this.authToken = this.apiKey;
      core.info('Service renderer: using API key authentication');
    } else {
      // Free tier — request GitHub OIDC token
      await this.refreshOidcToken();
    }

    // Verify connectivity
    const healthUrl = `${this.serviceUrl}/health`;
    try {
      const resp = await fetch(healthUrl);
      if (!resp.ok) {
        core.warning(`Service health check returned ${resp.status}`);
      } else {
        const health = await resp.json() as { status: string; pencilConnected?: boolean };
        core.info(`Service health: ${health.status}, pencilConnected: ${health.pencilConnected}`);
      }
    } catch (err) {
      throw new Error(
        `Cannot reach screenshot service at ${healthUrl}: ${
          err instanceof Error ? err.message : err
        }`
      );
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const resp = await fetch(`${this.serviceUrl}/health`);
      return resp.ok;
    } catch {
      return false;
    }
  }

  async renderFrame(
    penFilePath: string,
    frame: PenFrame,
    outputPath: string
  ): Promise<ScreenshotResult> {
    try {
      // Ensure the .pen file has been sent to the API
      if (!this.sentFiles.has(penFilePath)) {
        await this.fetchAllFrames(penFilePath);
      }

      // Look up cached result for this frame
      const fileCache = this.cache.get(penFilePath);
      const cached = fileCache?.get(frame.id);

      if (!cached) {
        return createErrorResult(
          frame,
          penFilePath,
          `Frame ${frame.id} not found in API response`
        );
      }

      // Download image from service and write to disk
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const imgResp = await fetch(cached.imageUrl);
      if (!imgResp.ok) {
        return createErrorResult(frame, penFilePath, `Failed to download image: ${imgResp.status}`);
      }
      const buffer = Buffer.from(await imgResp.arrayBuffer());
      fs.writeFileSync(outputPath, buffer);

      const result = createSuccessResult(frame, penFilePath, outputPath);
      result.imageUrl = cached.imageUrl;
      return result;
    } catch (err) {
      return createErrorResult(
        frame,
        penFilePath,
        err instanceof Error ? err.message : 'Unknown error'
      );
    }
  }

  async cleanup(): Promise<void> {
    this.cache.clear();
    this.sentFiles.clear();
    this.authToken = undefined;
  }

  /**
   * Request a fresh OIDC token from GitHub Actions.
   */
  private async refreshOidcToken(): Promise<void> {
    core.info('Service renderer: requesting GitHub OIDC token');
    try {
      const oidcToken = await core.getIDToken('pencil.remotestate.com');
      this.authToken = oidcToken;
      this.tokenAcquiredAt = Date.now();
      core.setSecret(oidcToken);
      core.info('Service renderer: OIDC token acquired');
    } catch (err) {
      throw new Error(
        `Failed to get OIDC token. Ensure your workflow has "permissions: id-token: write". Error: ${
          err instanceof Error ? err.message : err
        }`
      );
    }
  }

  /**
   * Refresh the OIDC token if it's older than 4 minutes.
   * API keys never expire, so this is a no-op for paid tier.
   */
  private async ensureFreshToken(): Promise<void> {
    if (this.apiKey) return;
    if (Date.now() - this.tokenAcquiredAt >= TOKEN_REFRESH_MS) {
      await this.refreshOidcToken();
    }
  }

  /**
   * Submit the entire .pen file as an async job, then poll for completion.
   */
  private async fetchAllFrames(penFilePath: string): Promise<void> {
    this.sentFiles.add(penFilePath);

    const penFileContent = fs.readFileSync(penFilePath, 'utf-8');
    const penFileBase64 = Buffer.from(penFileContent).toString('base64');

    // Ensure token is fresh before submitting
    await this.ensureFreshToken();

    // Submit job
    const submitUrl = `${this.serviceUrl}/api/v1/screenshot`;
    const submitResp = await fetch(submitUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.authToken}`,
      },
      body: JSON.stringify({
        penFile: penFileBase64,
        format: this.imageFormat,
        scale: this.imageScale,
        quality: this.imageQuality,
      }),
    });

    if (!submitResp.ok) {
      const body = await submitResp.text();
      throw new Error(`Screenshot service returned ${submitResp.status}: ${body}`);
    }

    const submitData = (await submitResp.json()) as JobSubmitResponse;
    core.info(`Job ${submitData.jobId} submitted (queue position: ${submitData.queuePosition})`);

    // Log usage headers if present (free tier)
    const usageCurrent = submitResp.headers.get('X-Usage-Current');
    const usageLimit = submitResp.headers.get('X-Usage-Limit');
    const usageRemaining = submitResp.headers.get('X-Usage-Remaining');
    if (usageCurrent) {
      core.info(
        `Usage: ${usageCurrent}/${usageLimit} (${usageRemaining} remaining)`
      );
    }

    // Poll for completion
    const data = await this.pollForCompletion(submitData.jobId);

    // Cache all returned screenshots
    const frameMap = new Map<string, CachedFrame>();
    for (const screenshot of data.screenshots) {
      frameMap.set(screenshot.frameId, {
        format: screenshot.format,
        width: screenshot.width,
        height: screenshot.height,
        imageUrl: screenshot.imageUrl,
      });
    }
    this.cache.set(penFilePath, frameMap);

    // Log errors from the API
    if (data.errors && data.errors.length > 0) {
      for (const err of data.errors) {
        core.warning(
          `Service error for frame "${err.frameName}" (${err.frameId}): ${err.error}`
        );
      }
    }

    core.info(
      `Fetched ${data.screenshots.length} screenshots for ${path.basename(penFilePath)}`
    );
  }

  /**
   * Poll GET /jobs/:jobId with exponential backoff until completed or failed.
   */
  private async pollForCompletion(jobId: string): Promise<ServiceResponse> {
    const pollUrl = `${this.serviceUrl}/api/v1/jobs/${jobId}`;
    const startTime = Date.now();
    let interval = POLL_INITIAL_INTERVAL_MS;
    let lastQueuePosition = -1;

    while (true) {
      const elapsed = Date.now() - startTime;
      if (elapsed > POLL_TIMEOUT_MS) {
        throw new Error(`Job ${jobId} timed out after ${Math.round(elapsed / 1000)}s`);
      }

      await sleep(interval);

      // Refresh OIDC token if close to expiry
      await this.ensureFreshToken();

      const resp = await fetch(pollUrl, {
        headers: {
          Authorization: `Bearer ${this.authToken}`,
        },
      });

      if (!resp.ok) {
        throw new Error(`Job status request failed with ${resp.status}: ${await resp.text()}`);
      }

      const status = (await resp.json()) as JobStatusResponse;

      // Log queue position changes
      if (status.queuePosition !== lastQueuePosition) {
        if (status.status === 'queued') {
          core.info(`Job ${jobId}: queued (position ${status.queuePosition})`);
        } else if (status.status === 'processing') {
          core.info(`Job ${jobId}: processing...`);
        }
        lastQueuePosition = status.queuePosition;
      }

      if (status.status === 'completed') {
        if (!status.result) {
          throw new Error(`Job ${jobId} completed but returned no result`);
        }
        const duration = Math.round((Date.now() - startTime) / 1000);
        core.info(`Job ${jobId}: completed in ${duration}s`);
        return status.result;
      }

      if (status.status === 'failed') {
        throw new Error(`Job ${jobId} failed: ${status.error || 'Unknown error'}`);
      }

      // Exponential backoff, capped
      interval = Math.min(interval * POLL_MULTIPLIER, POLL_MAX_INTERVAL_MS);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function createServiceRenderer(
  serviceUrl: string,
  apiKey: string | undefined,
  imageFormat: ImageFormat,
  imageScale: ImageScale,
  imageQuality: number
): ServiceRenderer {
  return new ServiceRenderer({
    serviceUrl,
    apiKey,
    imageFormat,
    imageScale,
    imageQuality,
  });
}
