/**
 * Base renderer interface
 *
 * All renderers must implement this interface
 */

import { IRenderer, PenFrame, ScreenshotResult } from '../types';

/**
 * Abstract base class for renderers
 */
export abstract class BaseRenderer implements IRenderer {
  abstract name: string;

  /**
   * Initialize the renderer (install dependencies, etc.)
   */
  abstract initialize(): Promise<void>;

  /**
   * Render a single frame to an image file
   */
  abstract renderFrame(
    penFilePath: string,
    frame: PenFrame,
    outputPath: string
  ): Promise<ScreenshotResult>;

  /**
   * Clean up resources
   */
  abstract cleanup(): Promise<void>;

  /**
   * Check if the renderer is available (dependencies installed, etc.)
   */
  abstract isAvailable(): Promise<boolean>;
}

/**
 * Create a successful screenshot result
 */
export function createSuccessResult(
  frame: PenFrame,
  filePath: string,
  screenshotPath: string
): ScreenshotResult {
  return {
    frameId: frame.id,
    frameName: frame.name,
    filePath,
    screenshotPath,
    success: true,
    width: frame.width,
    height: frame.height,
  };
}

/**
 * Create a failed screenshot result
 */
export function createErrorResult(
  frame: PenFrame,
  filePath: string,
  error: string
): ScreenshotResult {
  return {
    frameId: frame.id,
    frameName: frame.name,
    filePath,
    screenshotPath: '',
    success: false,
    error,
  };
}
