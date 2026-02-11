/**
 * Core type definitions for Pencil Design Review Action
 */

export interface ActionInputs {
  githubToken: string;
  penFilesPattern: string;
  renderer: RendererType;
  serviceUrl?: string;      // URL for pencil-screenshot-service
  serviceApiKey?: string;   // API key for screenshot service
  outputDir: string;
  commentMode: CommentMode;
  uploadArtifacts: boolean;
  includeDeleted: boolean;
  maxFramesPerFile: number;
  imageFormat: ImageFormat;
  imageScale: ImageScale;   // Export scale: 1, 2, or 3
  imageQuality: number;     // Quality for webp/jpeg: 1-100
}

export type RendererType = 'metadata' | 'service';
export type CommentMode = 'create' | 'update' | 'none';
export type ImageFormat = 'png' | 'jpeg' | 'webp';
export type ImageScale = 1 | 2 | 3;

export interface PenFile {
  path: string;
  status: FileStatus;
  frames: PenFrame[];
}

export type FileStatus = 'added' | 'modified' | 'deleted' | 'renamed';

export interface PenFrame {
  id: string;
  name: string;
  type: string;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  reusable?: boolean;
}

export interface ScreenshotResult {
  frameId: string;
  frameName: string;
  filePath: string;
  screenshotPath: string;
  success: boolean;
  error?: string;
  width?: number;
  height?: number;
}

export interface RenderResult {
  penFile: string;
  screenshots: ScreenshotResult[];
  totalFrames: number;
  successCount: number;
  errorCount: number;
}

export interface ActionOutputs {
  screenshotsPath: string;
  changedFiles: string[];
  framesRendered: number;
  commentId?: number;
}

export interface CommentData {
  files: PenFileCommentData[];
  summary: CommentSummary;
  prNumber: number;
  commitSha: string;
}

export interface PenFileCommentData {
  path: string;
  status: FileStatus;
  frames: FrameCommentData[];
}

export interface FrameCommentData {
  id: string;
  name: string;
  screenshotUrl?: string;
  screenshotPath?: string;
  error?: string;
}

export interface CommentSummary {
  totalFiles: number;
  totalFrames: number;
  successfulRenders: number;
  failedRenders: number;
  addedFiles: number;
  modifiedFiles: number;
  deletedFiles: number;
}

/**
 * Pen file node structure (simplified)
 * Based on the .pen file format
 */
export interface PenNode {
  id: string;
  type: string;
  name?: string;
  reusable?: boolean;
  x?: number;
  y?: number;
  width?: number | string;
  height?: number | string;
  children?: PenNode[];
  [key: string]: unknown;
}

export interface PenDocument {
  version?: string;
  children?: PenNode[];
  variables?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Renderer interface that all renderers must implement
 */
export interface IRenderer {
  name: string;
  initialize(): Promise<void>;
  renderFrame(
    penFilePath: string,
    frame: PenFrame,
    outputPath: string
  ): Promise<ScreenshotResult>;
  cleanup(): Promise<void>;
}
