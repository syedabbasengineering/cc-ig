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

    const scheduledContent = await prisma.content.findMany({
      where: {
        workspaceId: workspace.id,
        OR: [
          { status: 'scheduled' },
          { status: 'published' },
          { status: 'failed' }
        ]
      },
      orderBy: {
        scheduledFor: 'asc'
      }
    });

    return NextResponse.json(scheduledContent);
  } catch (error) {
    console.error('Error fetching scheduled content:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}