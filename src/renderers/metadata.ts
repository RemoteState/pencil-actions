/**
 * Metadata-only renderer
 *
 * This renderer doesn't generate actual screenshots.
 * It extracts frame information from .pen files for display in PR comments.
 * Used when no screenshot service is configured.
 */

import * as core from '@actions/core';
import { BaseRenderer, createSuccessResult } from './base';
import { PenFrame, ScreenshotResult } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export class MetadataRenderer extends BaseRenderer {
  name = 'metadata';

  async initialize(): Promise<void> {
    core.info('Initializing metadata renderer (no screenshots will be generated)');
  }

  async isAvailable(): Promise<boolean> {
    // Metadata renderer is always available
    return true;
  }

  /**
   * For metadata mode, we don't generate actual screenshots
   * We just validate that the frame exists and return success
   */
  async renderFrame(
    penFilePath: string,
    frame: PenFrame,
    outputPath: string
  ): Promise<ScreenshotResult> {
    core.debug(`Processing frame metadata: ${frame.name} (${frame.id})`);

    // Create a placeholder file with frame info (for artifact upload)
    const placeholderPath = outputPath.replace(/\.(png|jpe?g|webp)$/i, '.json');

    try {
      const frameInfo = {
        id: frame.id,
        name: frame.name,
        type: frame.type,
        width: frame.width,
        height: frame.height,
        x: frame.x,
        y: frame.y,
        reusable: frame.reusable,
        sourceFile: penFilePath,
        renderedAt: new Date().toISOString(),
        renderer: 'metadata',
      };

      // Ensure output directory exists
      const outputDir = path.dirname(placeholderPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      fs.writeFileSync(placeholderPath, JSON.stringify(frameInfo, null, 2));

      return createSuccessResult(frame, penFilePath, placeholderPath);
    } catch (error) {
      return {
        frameId: frame.id,
        frameName: frame.name,
        filePath: penFilePath,
        screenshotPath: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async cleanup(): Promise<void> {
    // Nothing to clean up for metadata renderer
  }
}
