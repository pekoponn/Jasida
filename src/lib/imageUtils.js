import { prepareUploadPhoto } from './imageUpload.js';

/** Compatibility entrypoint: all uploads use the same WebP/99,999-byte validation. */
export function convertToWebp(file) {
  return prepareUploadPhoto(file);
}
