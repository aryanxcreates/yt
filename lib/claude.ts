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
    model: 'claude-opus-4-8',
    max_tokens: 200,
    messages: [{
      role: 'user',
      content: `Generate an authentic YouTube comment for this video.

Channel: ${channelTitle}
Video title: ${videoTitle}
${context}

Write a genuine, engaging comment (1-3 sentences) that:
- Feels like a real viewer wrote it
- Relates specifically to the video content
- Could start a conversation
- Does NOT sound promotional or spammy
- Is friendly and positive

Reply with ONLY the comment text, nothing else.`,
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
    model: 'claude-opus-4-8',
    max_tokens: 200,
    messages: [{
      role: 'user',
      content: `Generate an authentic YouTube follow-up comment from a returning viewer.

Channel: ${channelTitle}
Video title: ${videoTitle}
${context}

Write a genuine comment (1-3 sentences) from someone who keeps watching this channel's videos. It should:
- Feel like a loyal viewer who comes back regularly
- Relate to this specific video's topic
- Be curious or enthusiastic
- NOT sound like spam or a bot
- NOT explicitly say "I'm back" or reference a previous comment

Reply with ONLY the comment text, nothing else.`,
    }],
  })

  const block = response.content[0]
  if (block.type !== 'text') throw new Error('Unexpected response type from Claude')
  return block.text.trim()
}
