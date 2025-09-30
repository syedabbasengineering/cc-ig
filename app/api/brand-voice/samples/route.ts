import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workspace = await prisma.workspace.findFirst({
      where: {
        userId: session.user.id
      }
    });

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const samples = await prisma.brandVoiceSample.findMany({
      where: {
        workspaceId: workspace.id
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json(samples);
  } catch (error) {
    console.error('Error fetching samples:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { content, source, metadata } = await request.json();

    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    if (!source || !['user_provided', 'approved_content', 'external_url'].includes(source)) {
      return NextResponse.json({ error: 'Invalid source' }, { status: 400 });
    }

    const workspace = await prisma.workspace.findFirst({
      where: {
        userId: session.user.id
      }
    });

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const sample = await prisma.brandVoiceSample.create({
      data: {
        workspaceId: workspace.id,
        content: content.trim(),
        source,
        metadata: metadata || null
      }
    });

    return NextResponse.json(sample, { status: 201 });
  } catch (error) {
    console.error('Error creating sample:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}