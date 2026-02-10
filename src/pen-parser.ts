/**
 * Parser for .pen design files
 *
 * .pen files are JSON-based design files from Pencil.dev
 * This module extracts frame information for the metadata renderer
 */

import * as fs from 'fs';
import * as path from 'path';
import { PenDocument, PenNode, PenFrame } from './types';

/**
 * Parse a .pen file and extract all frames
 */
export async function parsePenFile(filePath: string): Promise<PenFrame[]> {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${absolutePath}`);
  }

  const content = fs.readFileSync(absolutePath, 'utf-8');

  let document: PenDocument;
  try {
    document = JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to parse .pen file as JSON: ${filePath}`);
  }

  return extractFrames(document);
}

/**
 * Extract all frames from a pen document
 * Frames are nodes with type "frame" at any level of the hierarchy
 */
function extractFrames(document: PenDocument): PenFrame[] {
  const frames: PenFrame[] = [];

  if (document.children) {
    for (const child of document.children) {
      collectFrames(child, frames);
    }
  }

  return frames;
}

/**
 * Recursively collect frames from a node tree
 */
function collectFrames(node: PenNode, frames: PenFrame[], parentPath = ''): void {
  // Check if this node is a frame
  if (node.type === 'frame') {
    frames.push({
      id: node.id,
      name: node.name || `Frame ${node.id}`,
      type: node.type,
      width: parseNumericValue(node.width),
      height: parseNumericValue(node.height),
      x: node.x,
      y: node.y,
      reusable: node.reusable,
    });
  }

  // Recursively process children
  if (node.children && Array.isArray(node.children)) {
    const currentPath = parentPath ? `${parentPath}/${node.name || node.id}` : node.name || node.id;
    for (const child of node.children) {
      collectFrames(child, frames, currentPath);
    }
  }
}

/**
 * Parse a numeric value that might be a number or a string (e.g., "fill_container")
 */
function parseNumericValue(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

/**
 * Get top-level frames only (screens/artboards)
 * These are typically the main design screens
 */
export function getTopLevelFrames(document: PenDocument): PenFrame[] {
  const frames: PenFrame[] = [];

  if (document.children) {
    for (const child of document.children) {
      if (child.type === 'frame') {
        frames.push({
          id: child.id,
          name: child.name || `Frame ${child.id}`,
          type: child.type,
          width: parseNumericValue(child.width),
          height: parseNumericValue(child.height),
          x: child.x,
          y: child.y,
          reusable: child.reusable,
        });
      }
    }
  }

  return frames;
}

/**
 * Get reusable components (design system components)
 */
export function getReusableComponents(document: PenDocument): PenFrame[] {
  const components: PenFrame[] = [];

  function collectReusable(node: PenNode): void {
    if (node.reusable) {
      components.push({
        id: node.id,
        name: node.name || `Component ${node.id}`,
        type: node.type,
        width: parseNumericValue(node.width),
        height: parseNumericValue(node.height),
        x: node.x,
        y: node.y,
        reusable: true,
      });
    }

    if (node.children) {
      for (const child of node.children) {
        collectReusable(child);
      }
    }
  }

  if (document.children) {
    for (const child of document.children) {
      collectReusable(child);
    }
  }

  return components;
}

/**
 * Load and validate a .pen file
 */
export async function loadPenDocument(filePath: string): Promise<PenDocument> {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${absolutePath}`);
  }

  const content = fs.readFileSync(absolutePath, 'utf-8');

  try {
    const document = JSON.parse(content) as PenDocument;
    return document;
  } catch (error) {
    throw new Error(`Failed to parse .pen file: ${filePath}`);
  }
}

/**
 * Get document metadata
 */
export function getDocumentInfo(document: PenDocument): {
  version?: string;
  frameCount: number;
  componentCount: number;
  hasVariables: boolean;
} {
  const frames = extractFrames(document);
  const components = getReusableComponents(document);

  return {
    version: document.version,
    frameCount: frames.length,
    componentCount: components.length,
    hasVariables: !!document.variables && Object.keys(document.variables).length > 0,
  };
}
