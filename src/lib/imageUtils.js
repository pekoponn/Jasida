import { prepareUploadPhoto } from './imageUpload.js';

export function convertToWebp(file) {
  return prepareUploadPhoto(file);
}
