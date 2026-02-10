/**
 * Claude Code CLI Renderer
 *
 * Uses Claude Code CLI with Pencil MCP to generate actual screenshots.
 * Requires ANTHROPIC_API_KEY to be set.
 */

import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as fs from 'fs';
import * as path from 'path';
import { BaseRenderer, createSuccessResult, createErrorResult } from './base';
import { PenFrame, ScreenshotResult, ImageFormat } from '../types';

export interface ClaudeRendererOptions {
  apiKey: string;
  imageFormat: ImageFormat;
  timeout?: number;
}

export class ClaudeRenderer extends BaseRenderer {
  name = 'claude';
  private options: ClaudeRendererOptions;
  private isInitialized = false;

  constructor(options: ClaudeRendererOptions) {
    super();
    this.options = {
      timeout: 60000, // 60 seconds default timeout per frame
      ...options,
    };
  }

  async initialize(): Promise<void> {
    core.info('Initializing Claude Code CLI renderer');

    // Check if Claude CLI is installed
    const isInstalled = await this.isClaudeInstalled();
    if (!isInstalled) {
      core.info('Installing Claude Code CLI...');
      await this.installClaudeCli();
    }

    // Authenticate with API key
    await this.authenticate();

    this.isInitialized = true;
    core.info('Claude renderer initialized successfully');
  }

  async isAvailable(): Promise<boolean> {
    if (!this.options.apiKey) {
      return false;
    }

    try {
      const isInstalled = await this.isClaudeInstalled();
      return isInstalled;
    } catch {
      return false;
    }
  }

  private async isClaudeInstalled(): Promise<boolean> {
    try {
      let output = '';
      await exec.exec('claude', ['--version'], {
        silent: true,
        listeners: {
          stdout: (data: Buffer) => {
            output += data.toString();
          },
        },
        ignoreReturnCode: true,
      });
      return output.includes('claude');
    } catch {
      return false;
    }
  }

  private async installClaudeCli(): Promise<void> {
    await exec.exec('npm', ['install', '-g', '@anthropic-ai/claude-code'], {
      silent: false,
    });
  }

  private async authenticate(): Promise<void> {
    // Set the API key as environment variable for Claude CLI
    process.env.ANTHROPIC_API_KEY = this.options.apiKey;

    core.info('Claude CLI authentication configured');
  }

  async renderFrame(
    penFilePath: string,
    frame: PenFrame,
    outputPath: string
  ): Promise<ScreenshotResult> {
    if (!this.isInitialized) {
      throw new Error('Renderer not initialized. Call initialize() first.');
    }

    core.info(`Rendering frame: ${frame.name} (${frame.id})`);

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    try {
      // Build the prompt for Claude to generate the screenshot
      const prompt = this.buildScreenshotPrompt(penFilePath, frame, outputPath);

      // Execute Claude CLI with the prompt
      const result = await this.executeClaudeCommand(prompt, penFilePath);

      if (result.success && fs.existsSync(outputPath)) {
        return createSuccessResult(frame, penFilePath, outputPath);
      } else {
        return createErrorResult(
          frame,
          penFilePath,
          result.error || 'Screenshot file not created'
        );
      }
    } catch (error) {
      return createErrorResult(
        frame,
        penFilePath,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  private buildScreenshotPrompt(
    penFilePath: string,
    frame: PenFrame,
    outputPath: string
  ): string {
    const format = this.options.imageFormat;

    return `Generate a screenshot of a specific frame from a .pen design file.

File: ${penFilePath}
Frame ID: ${frame.id}
Frame Name: ${frame.name}
Output Path: ${outputPath}
Format: ${format}

Instructions:
1. Use the Pencil MCP tool 'get_screenshot' to capture the frame
2. Save the screenshot to the specified output path
3. Only output "SUCCESS" if the screenshot was saved, or "ERROR: <reason>" if it failed

Do not output anything else.`;
  }

  private async executeClaudeCommand(
    prompt: string,
    workingDir: string
  ): Promise<{ success: boolean; error?: string }> {
    let stdout = '';
    let stderr = '';

    try {
      const exitCode = await exec.exec(
        'claude',
        [
          '--print',
          '--dangerously-skip-permissions',
          prompt,
        ],
        {
          cwd: path.dirname(workingDir),
          env: {
            ...process.env,
            ANTHROPIC_API_KEY: this.options.apiKey,
          },
          silent: false,
          listeners: {
            stdout: (data: Buffer) => {
              stdout += data.toString();
            },
            stderr: (data: Buffer) => {
              stderr += data.toString();
            },
          },
          ignoreReturnCode: true,
        }
      );

      if (exitCode !== 0) {
        return {
          success: false,
          error: stderr || `Claude CLI exited with code ${exitCode}`,
        };
      }

      if (stdout.includes('SUCCESS')) {
        return { success: true };
      }

      if (stdout.includes('ERROR:')) {
        const errorMatch = stdout.match(/ERROR:\s*(.+)/);
        return {
          success: false,
          error: errorMatch?.[1] || 'Unknown error from Claude',
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to execute Claude CLI',
      };
    }
  }

  async cleanup(): Promise<void> {
    // Clear the API key from environment
    delete process.env.ANTHROPIC_API_KEY;
    this.isInitialized = false;
  }
}

/**
 * Create a Claude renderer with the given API key
 */
export function createClaudeRenderer(
  apiKey: string,
  imageFormat: ImageFormat = 'png'
): ClaudeRenderer {
  return new ClaudeRenderer({
    apiKey,
    imageFormat,
  });
}
