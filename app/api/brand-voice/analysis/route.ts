import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/src/lib/auth';
import { prisma } from '@/src/lib/db/client';

// Mock analysis function - in production, this would use AI/NLP services
function analyzeBrandVoice(samples: { content: string }[]) {
  if (samples.length === 0) {
    return null;
  }

  const allText = samples.map(s => s.content).join(' ');
  const words = allText.toLowerCase().split(/\s+/);
  const sentences = allText.split(/[.!?]+/).filter(s => s.trim().length > 0);

  // Simple analysis - in production, use proper NLP
  const avgWordsPerSentence = words.length / Math.max(sentences.length, 1);

  // Mock sentiment analysis
  const positiveWords = ['great', 'amazing', 'excellent', 'fantastic', 'wonderful', 'love', 'best', 'awesome'];
  const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'worst', 'horrible', 'disappointing'];

  const positiveCount = words.filter(word => positiveWords.includes(word)).length;
  const negativeCount = words.filter(word => negativeWords.includes(word)).length;
  const sentimentScore = (positiveCount - negativeCount) / Math.max(words.length, 1);

  // Mock readability score (Flesch Reading Ease approximation)
  const avgSentenceLength = avgWordsPerSentence;
  const avgSyllablesPerWord = 1.5; // Simplified
  const readabilityScore = Math.max(0, Math.min(100,
    206.835 - (1.015 * avgSentenceLength) - (84.6 * avgSyllablesPerWord)
  ));

  // Extract common words/phrases
  const wordFreq: { [key: string]: number } = {};
  words.forEach(word => {
    if (word.length > 3) {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    }
  });

  const keywords = Object.entries(wordFreq)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .map(([word]) => word);

  // Mock tone detection based on word analysis
  const tones = [];
  if (positiveCount > negativeCount) tones.push('Positive');
  if (avgWordsPerSentence < 15) tones.push('Conversational');
  if (words.some(w => ['we', 'our', 'us'].includes(w))) tones.push('Inclusive');
  if (words.some(w => ['excited', 'energy', 'passion'].includes(w))) tones.push('Enthusiastic');
  if (words.some(w => ['professional', 'expert', 'quality'].includes(w))) tones.push('Professional');

  // Mock style detection
  const styles = [];
  if (avgWordsPerSentence < 12) styles.push('Concise');
  if (avgWordsPerSentence > 20) styles.push('Detailed');
  if (sentences.some(s => s.includes('?'))) styles.push('Engaging');
  if (words.some(w => ['tip', 'how', 'guide', 'learn'].includes(w))) styles.push('Educational');

  // Mock common phrases
  const commonPhrases = [
    'we believe in',
    'our mission is',
    'join us',
    'let\'s create',
    'together we can'
  ].slice(0, 3);

  // Mock recommendations
  const recommendations = [
    'Your brand voice shows strong positive sentiment, which resonates well with audiences.',
    'Consider varying sentence length for better engagement.',
    'Your content is accessible and easy to read.',
    'Try incorporating more industry-specific keywords for better SEO.',
    'Your conversational tone helps build authentic connections.'
  ].slice(0, 3);

  return {
    tone: tones.length > 0 ? tones : ['Neutral'],
    style: styles.length > 0 ? styles : ['Balanced'],
    keywords,
    commonPhrases,
    sentimentScore: Math.max(-1, Math.min(1, sentimentScore)),
    readabilityScore: Math.round(readabilityScore),
    avgWordsPerSentence: Math.round(avgWordsPerSentence * 10) / 10,
    recommendations
  };
}

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
      select: {
        content: true
      }
    });

    const analysis = analyzeBrandVoice(samples);
    return NextResponse.json(analysis);
  } catch (error) {
    console.error('Error fetching analysis:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}