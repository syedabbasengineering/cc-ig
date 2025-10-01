import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/src/lib/auth';
import { prisma } from '@/src/lib/db/client';


// Mock analysis function - in production, this would use AI/NLP services
function runBrandVoiceAnalysis(samples: { content: string }[]) {
  if (samples.length === 0) {
    return null;
  }

  const allText = samples.map(s => s.content).join(' ');
  const words = allText.toLowerCase().split(/\s+/);
  const sentences = allText.split(/[.!?]+/).filter(s => s.trim().length > 0);

  const avgWordsPerSentence = words.length / Math.max(sentences.length, 1);

  // Sentiment analysis
  const positiveWords = ['great', 'amazing', 'excellent', 'fantastic', 'wonderful', 'love', 'best', 'awesome', 'incredible', 'outstanding'];
  const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'worst', 'horrible', 'disappointing', 'poor', 'weak'];

  const positiveCount = words.filter(word => positiveWords.includes(word)).length;
  const negativeCount = words.filter(word => negativeWords.includes(word)).length;
  const sentimentScore = (positiveCount - negativeCount) / Math.max(words.length, 1);

  // Readability score
  const avgSentenceLength = avgWordsPerSentence;
  const avgSyllablesPerWord = 1.5;
  const readabilityScore = Math.max(0, Math.min(100,
    206.835 - (1.015 * avgSentenceLength) - (84.6 * avgSyllablesPerWord)
  ));

  // Keyword extraction
  const wordFreq: { [key: string]: number } = {};
  words.forEach(word => {
    if (word.length > 3 && !['this', 'that', 'with', 'from', 'they', 'been', 'have', 'were', 'said', 'each', 'which', 'their'].includes(word)) {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    }
  });

  const keywords = Object.entries(wordFreq)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 8)
    .map(([word]) => word);

  // Tone detection
  const tones = [];
  if (positiveCount > negativeCount * 2) tones.push('Optimistic');
  if (words.some(w => ['professional', 'expert', 'quality', 'excellence'].includes(w))) tones.push('Professional');
  if (words.some(w => ['we', 'our', 'us', 'together'].includes(w))) tones.push('Inclusive');
  if (words.some(w => ['excited', 'energy', 'passion', 'thrilled'].includes(w))) tones.push('Enthusiastic');
  if (avgWordsPerSentence < 15) tones.push('Conversational');
  if (words.some(w => ['friendly', 'welcome', 'hello', 'thanks'].includes(w))) tones.push('Friendly');

  // Style detection
  const styles = [];
  if (avgWordsPerSentence < 12) styles.push('Concise');
  if (avgWordsPerSentence > 20) styles.push('Detailed');
  if (sentences.some(s => s.includes('?'))) styles.push('Engaging');
  if (words.some(w => ['tip', 'how', 'guide', 'learn', 'discover'].includes(w))) styles.push('Educational');
  if (words.some(w => ['story', 'journey', 'experience'].includes(w))) styles.push('Narrative');
  if (words.some(w => ['data', 'research', 'study', 'analysis'].includes(w))) styles.push('Analytical');

  // Common phrases
  const phrasePatterns = [
    /we believe in \w+/gi,
    /our mission is to \w+/gi,
    /join us \w*/gi,
    /let's \w+ together/gi,
    /we're excited to \w+/gi
  ];

  const commonPhrases: string[] = [];
  phrasePatterns.forEach(pattern => {
    const matches = allText.match(pattern);
    if (matches) {
      commonPhrases.push(...matches.slice(0, 2));
    }
  });

  // Generate recommendations
  const recommendations = [];

  if (sentimentScore < 0) {
    recommendations.push('Consider adding more positive language to improve sentiment.');
  } else if (sentimentScore > 0.1) {
    recommendations.push('Your content maintains a positive tone, which helps build trust.');
  }

  if (readabilityScore < 60) {
    recommendations.push('Try using shorter sentences and simpler words to improve readability.');
  } else if (readabilityScore > 80) {
    recommendations.push('Your content is very accessible and easy to read.');
  }

  if (avgWordsPerSentence > 25) {
    recommendations.push('Consider breaking up long sentences for better engagement.');
  }

  if (keywords.length < 5) {
    recommendations.push('Add more industry-specific keywords to strengthen your brand voice.');
  }

  if (!tones.includes('Professional') && !tones.includes('Friendly')) {
    recommendations.push('Consider adding more personality to your brand voice.');
  }

  return {
    tone: tones.length > 0 ? tones : ['Neutral'],
    style: styles.length > 0 ? styles : ['Balanced'],
    keywords,
    commonPhrases: commonPhrases.slice(0, 5),
    sentimentScore: Math.max(-1, Math.min(1, sentimentScore)),
    readabilityScore: Math.round(readabilityScore),
    avgWordsPerSentence: Math.round(avgWordsPerSentence * 10) / 10,
    recommendations: recommendations.slice(0, 5)
  };
}

export async function POST() {
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

    if (samples.length === 0) {
      return NextResponse.json({ error: 'No samples available for analysis' }, { status: 400 });
    }

    const analysis = runBrandVoiceAnalysis(samples);
    return NextResponse.json(analysis);
  } catch (error) {
    console.error('Error running analysis:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}