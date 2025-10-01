# CDN Setup Guide

This application supports multiple CDN providers for image optimization and delivery:

1. **Cloudinary** (Recommended)
2. **AWS S3 + CloudFront**
3. **Generic CDN**

## Cloudinary Setup (Recommended)

Cloudinary provides automatic image optimization, format conversion, and responsive image delivery.

### 1. Create Account
1. Sign up at [cloudinary.com](https://cloudinary.com)
2. Get your Cloud Name, API Key, and API Secret from the dashboard

### 2. Configure Environment Variables
Add to `.env`:
```bash
CLOUDINARY_CLOUD_NAME="your_cloud_name"
CLOUDINARY_API_KEY="your_api_key"
CLOUDINARY_API_SECRET="your_api_secret"
```

### 3. Features
- ✅ Automatic WebP/AVIF conversion
- ✅ Responsive image generation
- ✅ On-the-fly transformations
- ✅ CDN delivery
- ✅ Image optimization
- ✅ Video support

### 4. Usage Example
```typescript
import { cdnService } from '@/src/lib/cdn/cdn-service';

// Upload image
const result = await cdnService.uploadImage(file, {
  folder: 'content',
  tags: ['instagram', 'post'],
});

// Get optimized URL
const url = cdnService.getOptimizedUrl(result.publicId, {
  width: 1080,
  quality: 80,
  format: 'auto',
});
```

## AWS S3 + CloudFront Setup

For self-hosted CDN with AWS infrastructure.

### 1. Create S3 Bucket
```bash
aws s3 mb s3://your-bucket-name --region us-east-1
```

### 2. Create CloudFront Distribution
1. Go to AWS CloudFront console
2. Create distribution pointing to your S3 bucket
3. Enable image optimization with Lambda@Edge (optional)

### 3. Configure Environment Variables
Add to `.env`:
```bash
AWS_S3_BUCKET="your-bucket-name"
AWS_CLOUDFRONT_DOMAIN="your-distribution.cloudfront.net"
AWS_REGION="us-east-1"
AWS_ACCESS_KEY_ID="your_access_key"
AWS_SECRET_ACCESS_KEY="your_secret_key"
```

### 4. Install AWS SDK
```bash
npm install @aws-sdk/client-s3
```

### 5. Features
- ✅ Full control over infrastructure
- ✅ CloudFront CDN delivery
- ✅ S3 storage
- ✅ Custom image processing with Lambda@Edge
- ⚠️ Requires manual optimization setup

## Generic CDN Setup

For custom CDN providers or existing infrastructure.

### 1. Configure Environment Variables
Add to `.env`:
```bash
CDN_URL="https://cdn.yoursite.com"
```

### 2. Usage
Images will be served from your CDN with query parameters for width and quality:
```
https://cdn.yoursite.com/path/to/image.jpg?w=1080&q=75
```

## Next.js Image Component

The application uses Next.js Image component with custom loader in production:

```tsx
import Image from 'next/image';

<Image
  src="/path/to/image.jpg"
  alt="Description"
  width={1080}
  height={1080}
  quality={80}
  priority // For above-the-fold images
/>
```

### Automatic Optimizations
- ✅ Format conversion (WebP/AVIF)
- ✅ Responsive images
- ✅ Lazy loading
- ✅ Blur placeholder
- ✅ CDN delivery

## Image Upload Hook

Use the `useImageUpload` hook in React components:

```tsx
'use client';

import { useImageUpload } from '@/src/hooks/use-image-upload';

function MyComponent() {
  const { uploadImage, uploading, progress, error } = useImageUpload({
    maxWidth: 1920,
    quality: 0.8,
    format: 'webp',
    maxSizeMB: 5,
  });

  const handleUpload = async (file: File) => {
    const result = await uploadImage(file);
    if (result) {
      console.log('Uploaded:', result.secureUrl);
    }
  };

  return (
    <div>
      <input type="file" onChange={(e) => e.target.files && handleUpload(e.target.files[0])} />
      {uploading && <p>Uploading: {progress?.percentage}%</p>}
      {error && <p>Error: {error}</p>}
    </div>
  );
}
```

## Performance Recommendations

### 1. Image Formats
- Use WebP for modern browsers (90%+ support)
- Fallback to AVIF for best compression
- Automatic format detection with `f_auto`

### 2. Responsive Images
Generate multiple sizes for different devices:
```typescript
const sizes = cdnService.generateResponsiveUrls(publicId, [640, 1080, 1920]);
```

### 3. Lazy Loading
Enable lazy loading for below-the-fold images:
```tsx
<Image loading="lazy" ... />
```

### 4. Preload Critical Images
Preload hero images and above-the-fold content:
```tsx
<link rel="preload" as="image" href="/hero.jpg" />
```

### 5. Caching
- CDN cache: 1 year (`max-age=31536000`)
- Next.js cache: 60 seconds minimum
- Browser cache: Automatic with Next.js Image

## Cost Optimization

### Cloudinary Free Tier
- 25 GB storage
- 25 GB bandwidth/month
- Unlimited transformations

### AWS Free Tier
- 5 GB S3 storage
- 15 GB transfer out/month (first 12 months)
- CloudFront: 1 TB transfer out/month (first 12 months)

### Best Practices
1. Compress images before upload
2. Use appropriate quality settings (75-85)
3. Generate responsive sizes only as needed
4. Enable CDN caching
5. Use WebP/AVIF formats

## Monitoring

Monitor CDN performance:
- Cloudinary: Analytics dashboard
- AWS: CloudWatch metrics
- Next.js: Built-in image optimization metrics

## Troubleshooting

### Images not loading
1. Check environment variables are set
2. Verify CDN configuration
3. Check Next.js remote patterns in `next.config.js`
4. Review browser console for errors

### Slow loading times
1. Enable CDN caching
2. Use appropriate image sizes
3. Enable lazy loading
4. Preload critical images
5. Check CDN distribution is active

### Upload failures
1. Check file size limits
2. Verify authentication
3. Review CDN quotas
4. Check API credentials

## Migration Guide

### From Local Storage to CDN
1. Set up CDN provider (Cloudinary recommended)
2. Configure environment variables
3. Upload existing images using migration script
4. Update image URLs in database
5. Test image loading
6. Deploy changes

### Migration Script
```bash
# Create migration script
node scripts/migrate-images-to-cdn.js
```

## Security

### Best Practices
1. Use secure HTTPS URLs
2. Implement signed URLs for private content
3. Set up CORS policies
4. Rate limit upload endpoints
5. Validate file types and sizes
6. Sanitize file names

### Cloudinary Security
- Signed uploads for private content
- Access control with private CDNs
- IP restrictions
- Transformation restrictions

### AWS Security
- S3 bucket policies
- CloudFront signed URLs
- IAM permissions
- Encryption at rest
