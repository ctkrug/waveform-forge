/**
 * File-type validation for the intake screen. Kept independent of the
 * DOM `File` type (a plain `{name, type, size}` shape) so it's testable
 * without a browser environment.
 */

export interface FileLike {
  name: string;
  type: string;
  size: number;
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

/** Extensions accepted even when the browser reports an empty/generic MIME type. */
const ACCEPTED_EXTENSIONS = ["mp3", "wav", "aac", "m4a", "flac", "ogg", "oga", "webm"];

/** MIME type prefixes/values accepted outright. */
const ACCEPTED_MIME_PREFIXES = ["audio/"];

/** Hard ceiling to keep an accidental multi-gigabyte drop from locking up the tab. */
export const MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024;

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? "" : filename.slice(dot + 1).toLowerCase();
}

/** Validates a dropped/selected file against size and format constraints. */
export function validateAudioFile(file: FileLike): ValidationResult {
  if (file.size === 0) {
    return { valid: false, reason: `"${file.name}" is empty.` };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    const limitMb = Math.round(MAX_FILE_SIZE_BYTES / (1024 * 1024));
    return {
      valid: false,
      reason: `"${file.name}" is larger than the ${limitMb}MB limit.`,
    };
  }

  const hasAudioMime = ACCEPTED_MIME_PREFIXES.some((prefix) =>
    file.type.startsWith(prefix),
  );
  const hasAudioExtension = ACCEPTED_EXTENSIONS.includes(extensionOf(file.name));

  if (!hasAudioMime && !hasAudioExtension) {
    return {
      valid: false,
      reason: `"${file.name}" doesn't look like an audio file Cathode can read.`,
    };
  }

  return { valid: true };
}
