/**
 * Client-side image resizing utility.
 * Downscales images to max 1280px maintaining aspect ratio,
 * and encodes to JPEG at 0.8 quality to preserve bandwidth and meet S3/Bedrock limits.
 */

export interface ResizedImageResult {
  blob: Blob;
  previewUrl: string;
  originalSizeBytes: number;
  resizedSizeBytes: number;
  width: number;
  height: number;
}

export async function resizeImageForUpload(
  file: File,
  maxDimension: number = 1280,
  quality: number = 0.8
): Promise<ResizedImageResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to decode image data'));
      img.onload = () => {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to create canvas context'));
          return;
        }

        // Draw image smoothly
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to encode resized image'));
              return;
            }
            const previewUrl = URL.createObjectURL(blob);
            resolve({
              blob,
              previewUrl,
              originalSizeBytes: file.size,
              resizedSizeBytes: blob.size,
              width,
              height,
            });
          },
          'image/jpeg',
          quality
        );
      };

      img.src = reader.result as string;
    };

    reader.readAsDataURL(file);
  });
}
