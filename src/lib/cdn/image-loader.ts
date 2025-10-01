/**
 * Custom image loader for CDN integration
 * Supports Cloudinary and AWS CloudFront
 */

export interface ImageLoaderProps {
  src: string;
  width: number;
  quality?: number;
}

/**
 * Custom image loader that routes images through CDN
 */
export default function cdnImageLoader({
  src,
  width,
  quality = 75,
}: ImageLoaderProps): string {
  const cdnUrl = process.env.CDN_URL || process.env.NEXT_PUBLIC_CDN_URL;
  const cloudinaryName = process.env.CLOUDINARY_CLOUD_NAME;
  const cloudfrontDomain = process.env.AWS_CLOUDFRONT_DOMAIN;

  // If Cloudinary is configured and src is not already a full URL
  if (cloudinaryName && !src.startsWith('http')) {
    return buildCloudinaryUrl(cloudinaryName, src, width, quality);
  }

  // If CloudFront is configured
  if (cloudfrontDomain && !src.startsWith('http')) {
    return buildCloudfrontUrl(cloudfrontDomain, src, width, quality);
  }

  // If generic CDN is configured
  if (cdnUrl && !src.startsWith('http')) {
    return `${cdnUrl}/${src}?w=${width}&q=${quality}`;
  }

  // If src is already a full URL from an allowed domain, return as-is
  if (src.startsWith('http')) {
    return src;
  }

  // Fallback to default Next.js behavior
  return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=${quality}`;
}

/**
 * Build Cloudinary URL with transformations
 */
function buildCloudinaryUrl(
  cloudName: string,
  src: string,
  width: number,
  quality: number
): string {
  // Remove leading slash if present
  const path = src.startsWith('/') ? src.slice(1) : src;

  // Cloudinary transformation parameters
  const transformations = [
    `w_${width}`,
    `q_${quality}`,
    'f_auto', // Auto format (WebP/AVIF support)
    'c_limit', // Limit size (don't upscale)
  ].join(',');

  return `https://res.cloudinary.com/${cloudName}/image/upload/${transformations}/${path}`;
}

/**
 * Build CloudFront URL with query parameters
 */
function buildCloudfrontUrl(
  domain: string,
  src: string,
  width: number,
  quality: number
): string {
  // Remove leading slash if present
  const path = src.startsWith('/') ? src.slice(1) : src;

  // CloudFront with Lambda@Edge image resizing
  return `https://${domain}/${path}?width=${width}&quality=${quality}&format=auto`;
}
