import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/src/lib/auth';
import { prisma } from '@/src/lib/db/client';


export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

    // Verify the sample belongs to the user's workspace
    const sample = await prisma.brandVoiceSample.findFirst({
      where: {
        id,
        workspaceId: workspace.id
      }
    });

    if (!sample) {
      return NextResponse.json({ error: 'Sample not found' }, { status: 404 });
    }

    await prisma.brandVoiceSample.delete({
      where: {
        id
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting sample:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}