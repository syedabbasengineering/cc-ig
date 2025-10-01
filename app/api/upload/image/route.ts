import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/src/lib/auth';
import { cdnService } from '@/src/lib/cdn/cdn-service';
import { z } from 'zod';

const uploadSchema = z.object({
  file: z.string(), // Base64 encoded image
  folder: z.string().optional(),
  public_id: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate request body
    const body = await req.json();
    const { file, folder, public_id, tags } = uploadSchema.parse(body);

    // Upload to CDN
    const result = await cdnService.uploadImage(file, {
      folder: folder || 'content',
      public_id,
      tags,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Image upload error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to upload image', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get public_id from query params
    const { searchParams } = new URL(req.url);
    const publicId = searchParams.get('publicId');

    if (!publicId) {
      return NextResponse.json({ error: 'Missing publicId parameter' }, { status: 400 });
    }

    // Delete from CDN
    await cdnService.deleteImage(publicId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Image deletion error:', error);

    return NextResponse.json(
      { error: 'Failed to delete image' },
      { status: 500 }
    );
  }
}
