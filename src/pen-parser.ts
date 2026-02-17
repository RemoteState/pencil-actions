/**
 * Parser for .pen design files
 *
 * .pen files are JSON-based design files from Pencil.dev
 * This module extracts frame information from .pen design files
 */

import * as fs from 'fs';
import * as path from 'path';
import { PenDocument, PenFrame } from './types';

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

