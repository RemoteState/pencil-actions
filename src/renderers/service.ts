/**
 * Service renderer — calls pencil-screenshot-service API
 *
 * Handles the per-frame vs per-file mismatch: the API takes an entire .pen file
 * and returns all frames at once, but renderFrame() is called per frame.
 * Solution: batch-and-cache. On first call for a .pen file, send the whole file
 * to the API and cache all frame results. Subsequent calls return from cache.
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
  imageBase64: string;
  format: string;
  scale: number;
}

interface ServiceResponse {
  success: boolean;
  screenshots: ServiceScreenshot[];
  errors?: Array<{ frameId: string; frameName: string; error: string }>;
}

/** Cached result for a single frame from the API */
interface CachedFrame {
  imageBase64: string;
  format: string;
  width: number;
  height: number;
}

export class ServiceRenderer extends BaseRenderer {
  name = 'service';

  private serviceUrl: string;
  private apiKey?: string;
  private authToken?: string;
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
      core.info('Service renderer: requesting GitHub OIDC token');
      try {
        const oidcToken = await core.getIDToken('pencil.remotestate.com');
        this.authToken = oidcToken;
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

      // Write the image to disk
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const buffer = Buffer.from(cached.imageBase64, 'base64');
      fs.writeFileSync(outputPath, buffer);

      return createSuccessResult(frame, penFilePath, outputPath);
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
   * Send the entire .pen file to the API and cache all frame results.
   */
  private async fetchAllFrames(penFilePath: string): Promise<void> {
    this.sentFiles.add(penFilePath);

    const penFileContent = fs.readFileSync(penFilePath, 'utf-8');
    const penFileBase64 = Buffer.from(penFileContent).toString('base64');

    const url = `${this.serviceUrl}/api/v1/screenshot`;

    const resp = await fetch(url, {
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

    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`Screenshot service returned ${resp.status}: ${body}`);
    }

    const data = (await resp.json()) as ServiceResponse;

    // Log usage headers if present (free tier)
    const usageCurrent = resp.headers.get('X-Usage-Current');
    const usageLimit = resp.headers.get('X-Usage-Limit');
    const usageRemaining = resp.headers.get('X-Usage-Remaining');
    if (usageCurrent) {
      core.info(
        `Usage: ${usageCurrent}/${usageLimit} (${usageRemaining} remaining)`
      );
    }

    // Cache all returned screenshots
    const frameMap = new Map<string, CachedFrame>();
    for (const screenshot of data.screenshots) {
      frameMap.set(screenshot.frameId, {
        imageBase64: screenshot.imageBase64,
        format: screenshot.format,
        width: screenshot.width,
        height: screenshot.height,
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
