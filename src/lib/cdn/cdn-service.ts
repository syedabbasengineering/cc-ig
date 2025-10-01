/**
 * CDN Service for uploading and managing images
 * Supports Cloudinary and AWS S3 + CloudFront
 */

import { v2 as cloudinary } from 'cloudinary';

export interface UploadOptions {
  folder?: string;
  public_id?: string;
  tags?: string[];
  transformation?: any;
  eager?: any[];
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

export class CDNService {
  private cloudinaryConfigured: boolean = false;
  private s3Configured: boolean = false;

  constructor() {
    // Configure Cloudinary if credentials are available
    if (
      process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
    ) {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
        secure: true,
      });
      this.cloudinaryConfigured = true;
    }

    // Check if S3 is configured
    if (
      process.env.AWS_S3_BUCKET &&
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY
    ) {
      this.s3Configured = true;
    }
  }

  /**
   * Upload image to CDN
   */
  async uploadImage(
    file: Buffer | string,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    // Try Cloudinary first
    if (this.cloudinaryConfigured) {
      return this.uploadToCloudinary(file, options);
    }

    // Fallback to S3
    if (this.s3Configured) {
      return this.uploadToS3(file, options);
    }

    throw new Error('No CDN service configured. Please set up Cloudinary or AWS S3.');
  }

  /**
   * Upload to Cloudinary
   */
  private async uploadToCloudinary(
    file: Buffer | string,
    options: UploadOptions
  ): Promise<UploadResult> {
    try {
      const uploadOptions: any = {
        folder: options.folder || 'content',
        public_id: options.public_id,
        tags: options.tags || [],
        resource_type: 'auto',
        // Auto-optimize images
        quality: 'auto:good',
        fetch_format: 'auto',
      };

      // Add transformations if specified
      if (options.transformation) {
        uploadOptions.transformation = options.transformation;
      }

      // Eager transformations for different sizes
      if (options.eager) {
        uploadOptions.eager = options.eager;
      } else {
        uploadOptions.eager = [
          { width: 640, height: 640, crop: 'limit', quality: 'auto', fetch_format: 'auto' },
          { width: 1080, height: 1080, crop: 'limit', quality: 'auto', fetch_format: 'auto' },
          { width: 1920, height: 1920, crop: 'limit', quality: 'auto', fetch_format: 'auto' },
        ];
      }

      let result;
      if (typeof file === 'string') {
        // Upload from URL or base64
        result = await cloudinary.uploader.upload(file, uploadOptions);
      } else {
        // Upload from buffer
        result = await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            uploadOptions,
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          uploadStream.end(file);
        });
      }

      return {
        url: (result as any).url,
        secureUrl: (result as any).secure_url,
        publicId: (result as any).public_id,
        width: (result as any).width,
        height: (result as any).height,
        format: (result as any).format,
        bytes: (result as any).bytes,
      };
    } catch (error) {
      console.error('Cloudinary upload error:', error);
      throw new Error(`Failed to upload to Cloudinary: ${error}`);
    }
  }

  /**
   * Upload to AWS S3 + CloudFront
   */
  private async uploadToS3(
    file: Buffer | string,
    options: UploadOptions
  ): Promise<UploadResult> {
    try {
      // Dynamic import to avoid loading AWS SDK if not needed
      const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');

      const s3Client = new S3Client({
        region: process.env.AWS_REGION || 'us-east-1',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      });

      // Convert file to buffer if it's a string (base64 or URL)
      let buffer: Buffer;
      if (typeof file === 'string') {
        if (file.startsWith('data:')) {
          // Base64
          const base64Data = file.split(',')[1];
          buffer = Buffer.from(base64Data, 'base64');
        } else if (file.startsWith('http')) {
          // Fetch from URL
          const response = await fetch(file);
          buffer = Buffer.from(await response.arrayBuffer());
        } else {
          throw new Error('Invalid file string format');
        }
      } else {
        buffer = file;
      }

      const key = options.folder
        ? `${options.folder}/${options.public_id || Date.now()}`
        : options.public_id || `${Date.now()}`;

      const command = new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET!,
        Key: key,
        Body: buffer,
        ContentType: 'image/jpeg', // Default, should be detected
        CacheControl: 'max-age=31536000', // 1 year
      });

      await s3Client.send(command);

      const cloudfrontDomain = process.env.AWS_CLOUDFRONT_DOMAIN;
      const url = cloudfrontDomain
        ? `https://${cloudfrontDomain}/${key}`
        : `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

      return {
        url,
        secureUrl: url,
        publicId: key,
        width: 0, // Would need image processing to get dimensions
        height: 0,
        format: 'unknown',
        bytes: buffer.length,
      };
    } catch (error) {
      console.error('S3 upload error:', error);
      throw new Error(`Failed to upload to S3: ${error}`);
    }
  }

  /**
   * Delete image from CDN
   */
  async deleteImage(publicId: string): Promise<void> {
    if (this.cloudinaryConfigured) {
      await cloudinary.uploader.destroy(publicId);
    } else if (this.s3Configured) {
      const { S3Client, DeleteObjectCommand } = await import('@aws-sdk/client-s3');

      const s3Client = new S3Client({
        region: process.env.AWS_REGION || 'us-east-1',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      });

      const command = new DeleteObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET!,
        Key: publicId,
      });

      await s3Client.send(command);
    }
  }

  /**
   * Generate responsive image URLs
   */
  generateResponsiveUrls(
    publicId: string,
    widths: number[] = [640, 1080, 1920]
  ): string[] {
    if (this.cloudinaryConfigured && process.env.CLOUDINARY_CLOUD_NAME) {
      return widths.map(
        (width) =>
          `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/w_${width},q_auto,f_auto/${publicId}`
      );
    }

    if (this.s3Configured && process.env.AWS_CLOUDFRONT_DOMAIN) {
      return widths.map(
        (width) =>
          `https://${process.env.AWS_CLOUDFRONT_DOMAIN}/${publicId}?width=${width}&format=auto`
      );
    }

    // Fallback
    return [publicId];
  }

  /**
   * Get optimized image URL
   */
  getOptimizedUrl(
    publicId: string,
    options: {
      width?: number;
      height?: number;
      quality?: number;
      format?: 'auto' | 'webp' | 'avif' | 'jpg' | 'png';
      crop?: 'limit' | 'fill' | 'fit';
    } = {}
  ): string {
    const { width, height, quality = 'auto', format = 'auto', crop = 'limit' } = options;

    if (this.cloudinaryConfigured && process.env.CLOUDINARY_CLOUD_NAME) {
      const transformations = [];
      if (width) transformations.push(`w_${width}`);
      if (height) transformations.push(`h_${height}`);
      transformations.push(`q_${quality}`);
      transformations.push(`f_${format}`);
      transformations.push(`c_${crop}`);

      return `https://res.cloudinary.com/${
        process.env.CLOUDINARY_CLOUD_NAME
      }/image/upload/${transformations.join(',')}/${publicId}`;
    }

    if (this.s3Configured && process.env.AWS_CLOUDFRONT_DOMAIN) {
      const params = new URLSearchParams();
      if (width) params.append('width', width.toString());
      if (height) params.append('height', height.toString());
      if (quality !== 'auto') params.append('quality', quality.toString());
      params.append('format', format);

      return `https://${process.env.AWS_CLOUDFRONT_DOMAIN}/${publicId}?${params.toString()}`;
    }

    // Fallback
    return publicId;
  }
}

// Singleton instance
export const cdnService = new CDNService();
