'use client';

import { useState, useCallback } from 'react';
import { compressImage } from '@/src/lib/cdn/image-optimizer';

export interface UseImageUploadOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'webp' | 'avif' | 'jpeg' | 'png';
  maxSizeMB?: number;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface UploadResult {
  url: string;
  secureUrl: string;
  publicId: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
}

export function useImageUpload(options: UseImageUploadOptions = {}) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const uploadImage = useCallback(
    async (file: File): Promise<UploadResult | null> => {
      setUploading(true);
      setError(null);
      setProgress({ loaded: 0, total: 100, percentage: 0 });

      try {
        // Validate file type
        if (!file.type.startsWith('image/')) {
          throw new Error('File must be an image');
        }

        // Check file size
        const maxSizeMB = options.maxSizeMB || 10;
        if (file.size > maxSizeMB * 1024 * 1024) {
          throw new Error(`File size must be less than ${maxSizeMB}MB`);
        }

        setProgress({ loaded: 20, total: 100, percentage: 20 });

        // Compress image if needed
        let processedFile: File | Blob = file;
        if (options.maxWidth || options.maxHeight || options.quality || options.format) {
          processedFile = await compressImage(file, {
            maxWidth: options.maxWidth,
            maxHeight: options.maxHeight,
            quality: options.quality,
            format: options.format,
          });
        }

        setProgress({ loaded: 40, total: 100, percentage: 40 });

        // Convert to base64 for upload
        const base64 = await fileToBase64(processedFile);

        setProgress({ loaded: 60, total: 100, percentage: 60 });

        // Upload to server
        const response = await fetch('/api/upload/image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            file: base64,
            folder: 'content',
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Upload failed');
        }

        setProgress({ loaded: 90, total: 100, percentage: 90 });

        const result = await response.json();

        setProgress({ loaded: 100, total: 100, percentage: 100 });
        setUploading(false);

        return result;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Upload failed';
        setError(errorMessage);
        setUploading(false);
        setProgress(null);
        return null;
      }
    },
    [options]
  );

  const uploadMultiple = useCallback(
    async (files: File[]): Promise<(UploadResult | null)[]> => {
      const results: (UploadResult | null)[] = [];

      for (const file of files) {
        const result = await uploadImage(file);
        results.push(result);
      }

      return results;
    },
    [uploadImage]
  );

  const reset = useCallback(() => {
    setUploading(false);
    setProgress(null);
    setError(null);
  }, []);

  return {
    uploadImage,
    uploadMultiple,
    uploading,
    progress,
    error,
    reset,
  };
}

/**
 * Convert File/Blob to base64
 */
function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert file to base64'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}
