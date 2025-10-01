/**
 * Image optimization utilities
 */

export interface ImageDimensions {
  width: number;
  height: number;
  aspectRatio: number;
}

export interface OptimizationOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'webp' | 'avif' | 'jpeg' | 'png';
}

/**
 * Get image dimensions from buffer
 */
export async function getImageDimensions(buffer: Buffer): Promise<ImageDimensions> {
  // Simple dimension detection for JPEG
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset < buffer.length) {
      if (buffer[offset] !== 0xff) break;
      offset++;

      const marker = buffer[offset];
      offset++;

      if (marker === 0xc0 || marker === 0xc2) {
        const height = buffer.readUInt16BE(offset + 3);
        const width = buffer.readUInt16BE(offset + 5);
        return {
          width,
          height,
          aspectRatio: width / height,
        };
      }

      const length = buffer.readUInt16BE(offset);
      offset += length;
    }
  }

  // Simple dimension detection for PNG
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    return {
      width,
      height,
      aspectRatio: width / height,
    };
  }

  throw new Error('Unsupported image format for dimension detection');
}

/**
 * Calculate responsive image sizes
 */
export function calculateResponsiveSizes(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number = 1920
): number[] {
  const sizes = [640, 750, 828, 1080, 1200, 1920, 2048];
  return sizes.filter((size) => size <= Math.min(originalWidth, maxWidth));
}

/**
 * Generate srcset for responsive images
 */
export function generateSrcSet(baseUrl: string, widths: number[]): string {
  return widths.map((width) => `${baseUrl}?w=${width} ${width}w`).join(', ');
}

/**
 * Generate sizes attribute for responsive images
 */
export function generateSizesAttribute(breakpoints: {
  [key: string]: string;
}): string {
  return Object.entries(breakpoints)
    .map(([query, size]) => `${query} ${size}`)
    .join(', ');
}

/**
 * Optimize image URL based on viewport
 */
export function getOptimizedImageUrl(
  src: string,
  viewportWidth: number,
  devicePixelRatio: number = 1
): string {
  const targetWidth = Math.min(viewportWidth * devicePixelRatio, 3840);

  // Find the closest standard size
  const standardSizes = [640, 750, 828, 1080, 1200, 1920, 2048, 3840];
  const closestSize =
    standardSizes.find((size) => size >= targetWidth) ||
    standardSizes[standardSizes.length - 1];

  return `${src}?w=${closestSize}&q=75`;
}

/**
 * Preload critical images
 */
export function preloadImage(src: string, as: 'image' = 'image'): void {
  if (typeof window === 'undefined') return;

  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = as;
  link.href = src;
  document.head.appendChild(link);
}

/**
 * Lazy load image with IntersectionObserver
 */
export function lazyLoadImage(
  img: HTMLImageElement,
  src: string,
  options: IntersectionObserverInit = {}
): void {
  if (typeof window === 'undefined') return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        img.src = src;
        observer.disconnect();
      }
    });
  }, options);

  observer.observe(img);
}

/**
 * Convert image to WebP format client-side
 */
export async function convertToWebP(
  file: File,
  quality: number = 0.8
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to convert image to WebP'));
          }
        },
        'image/webp',
        quality
      );
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Compress image before upload
 */
export async function compressImage(
  file: File,
  options: OptimizationOptions = {}
): Promise<Blob> {
  const { maxWidth = 1920, maxHeight = 1920, quality = 0.8, format = 'webp' } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;

      // Calculate new dimensions maintaining aspect ratio
      if (width > maxWidth || height > maxHeight) {
        const aspectRatio = width / height;
        if (width > height) {
          width = maxWidth;
          height = width / aspectRatio;
        } else {
          height = maxHeight;
          width = height * aspectRatio;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      const mimeType = `image/${format}`;
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to compress image'));
          }
        },
        mimeType,
        quality
      );
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Get blurhash placeholder for image
 */
export function getBlurhashPlaceholder(
  width: number,
  height: number,
  color: string = '#e5e7eb'
): string {
  // Simple SVG placeholder that can be replaced with actual blurhash
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}'%3E%3Crect width='${width}' height='${height}' fill='${color}'/%3E%3C/svg%3E`;
}
