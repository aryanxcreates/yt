import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function buildContext(description: string, transcript: string | null | undefined): string {
  if (transcript?.trim()) {
    return `Video transcript:\n${transcript.slice(0, 3000)}`
  }
  return `Video description:\n${description.slice(0, 600)}`
}

export async function generateFirstComment(
  videoTitle: string,
  videoDescription: string,
  channelTitle: string,
  transcript?: string | null
): Promise<string> {
  const context = buildContext(videoDescription, transcript)

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 400,
    messages: [{
      role: 'user',
      content: `Write a YouTube comment for the video below, as a real person who actually watched it and happens to be a video editor.

Channel: ${channelTitle}
Video title: ${videoTitle}
${context}

GOAL:
Sound like a genuine viewer leaving a quick comment, who casually mentions they edit videos and could help. Not a pitch, not an ad, not an AI.

HARD RULES:
Maximum 250 characters total. Count them. Shorter is better.
Mention one SPECIFIC thing from the video (an idea, moment, line, example, or opinion). Never a generic compliment.
Then casually work in that you edit videos and could help make theirs hit harder. Keep it low key.

SOUND HUMAN, NOT AI:
Never use em dashes, en dashes, or hyphens to join clauses. Use commas, periods, or just start a new sentence.
Write the way people actually type comments: casual, a little loose, lowercase is fine, contractions are good.
No corporate or marketing words (elevate, leverage, unlock, game changer, next level, take it to the next level).
No "I loved your video", "Great content", "Amazing video", or any filler compliment.
Do not sound polished or structured. A tiny imperfection is fine.
No emojis unless one genuinely fits.
Do not mention transcripts, analysis, or that you are an editor "offering services".
Do not invent anything that is not in the video. No portfolio links.

Reply with ONLY the comment text. No quotes, labels, or extra text.`,
    }],
  })

  const block = response.content[0]
  if (block.type !== 'text') throw new Error('Unexpected response type from Claude')
  return block.text.trim()
}

export async function generateFollowUpComment(
  videoTitle: string,
  videoDescription: string,
  channelTitle: string,
  transcript?: string | null
): Promise<string> {
  const context = buildContext(videoDescription, transcript)

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 400,
    messages: [{
      role: 'user',
      content: `Write a YouTube follow-up comment for the video below, as a real person who keeps watching this creator and happens to be a video editor.

Channel: ${channelTitle}
Video title: ${videoTitle}
${context}

CONTEXT:
You have commented on this creator before. This is a NEW video. Do not re-introduce yourself. Just sound like a regular viewer who keeps showing up.

GOAL:
Sound like a genuine returning viewer leaving a quick comment, who casually reminds them you edit videos and could help. Not a pitch, not an ad, not an AI.

HARD RULES:
Maximum 250 characters total. Count them. Shorter is better.
Mention one SPECIFIC thing from THIS video (an idea, moment, line, example, or opinion). Never a generic compliment.
Then casually reinforce that you edit videos and could help, framed as someone who follows their stuff.
Do not say "I'm back", "as I said before", or reference your past comment.

SOUND HUMAN, NOT AI:
Never use em dashes, en dashes, or hyphens to join clauses. Use commas, periods, or just start a new sentence.
Write the way people actually type comments: casual, a little loose, lowercase is fine, contractions are good.
No corporate or marketing words (elevate, leverage, unlock, game changer, next level, take it to the next level).
No "I loved your video", "Great content", "Amazing video", or any filler compliment.
Do not sound polished or structured. A tiny imperfection is fine.
No emojis unless one genuinely fits.
Do not mention transcripts, analysis, or that you are an editor "offering services".
Do not invent anything that is not in the video. No portfolio links.

Reply with ONLY the comment text. No quotes, labels, or extra text.`,
    }],
  })

  const block = response.content[0]
  if (block.type !== 'text') throw new Error('Unexpected response type from Claude')
  return block.text.trim()
}
