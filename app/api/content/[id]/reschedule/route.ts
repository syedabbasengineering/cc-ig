import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/src/lib/auth';
import { prisma } from '@/src/lib/db/client';


export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { scheduledFor } = await request.json();

    if (!scheduledFor) {
      return NextResponse.json({ error: 'Scheduled date is required' }, { status: 400 });
    }

    const scheduledDate = new Date(scheduledFor);
    if (isNaN(scheduledDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
    }

    const workspace = await prisma.workspace.findFirst({
      where: {
        userId: session.user.id
      }
    });

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Verify the content belongs to the user's workspace
    const content = await prisma.content.findFirst({
      where: {
        id: id,
        workspaceId: workspace.id
      }
    });

    if (!content) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 });
    }

    // Update the scheduled date
    const updatedContent = await prisma.content.update({
      where: {
        id: id
      },
      data: {
        scheduledFor: scheduledDate,
        updatedAt: new Date()
      }
    });

    return NextResponse.json(updatedContent);
  } catch (error) {
    console.error('Error rescheduling content:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}