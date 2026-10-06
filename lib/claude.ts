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
      content: `Generate a short, highly personalized YouTube comment for the video below.

Channel: ${channelTitle}
Video title: ${videoTitle}
${context}

Your goal is to write a comment that feels like it was written by a real viewer who genuinely watched and understood the video, while naturally introducing the fact that you are a video editor.

STRICT FORMAT:

EXACTLY 2 lines.
Maximum 2 sentences.
Keep it short, crisp, and natural.
Line 1: Mention something SPECIFIC from the video — an idea, insight, story, example, hook, or opinion. Do not make a generic compliment.
Line 2: Briefly introduce yourself as a video editor and naturally explain how you could help them make their videos better.
The transition from the video observation to the editing offer should feel natural, NOT forced.
Do not use phrases like "I loved your video", "Great content", "Amazing video", or other generic compliments unless followed by something highly specific.
Do not sound like an advertisement, cold pitch, or AI-generated comment.
Do not mention that you analyzed the transcript.
Do not exaggerate or invent anything that is not present in the video.
Avoid emojis unless they genuinely fit the tone.
Do not include a portfolio link unless specifically requested.
Prioritize specificity over compliments.

STYLE:
Authentic, conversational, concise, confident, and friendly.

Think about the video first, identify the most interesting specific element, and then connect that element naturally to how a skilled video editor could improve the content's storytelling, pacing, retention, visuals, or overall presentation.

IMPORTANT:
The comment must be useful and relevant even if the creator ignores the editing offer.

Reply with ONLY the 2-line comment. No quotation marks, explanations, labels, or extra text.`,
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
      content: `Generate a short, highly personalized YouTube follow-up comment for the video below.

Channel: ${channelTitle}
Video title: ${videoTitle}
${context}

This is a FOLLOW-UP comment on a NEW video from a creator you have commented on before as a video editor. Write a comment that feels like it was written by a real viewer who keeps coming back and genuinely watched this new video, while gently reinforcing that you are a video editor — WITHOUT re-introducing yourself from scratch.

STRICT FORMAT:

EXACTLY 2 lines.
Maximum 2 sentences.
Keep it short, crisp, and natural.
Line 1: Mention something SPECIFIC from THIS video — an idea, insight, story, example, hook, or opinion. Do not make a generic compliment.
Line 2: Reinforce, as a video editor, one concrete way you could help elevate their videos — framed as a returning viewer following their work, NOT a first-time introduction.
The transition from the video observation to the editing angle should feel natural, NOT forced.
Do not say "I'm back", "as I mentioned before", or reference a previous comment.
Do not use phrases like "I loved your video", "Great content", "Amazing video", or other generic compliments unless followed by something highly specific.
Do not sound like an advertisement, cold pitch, or AI-generated comment.
Do not mention that you analyzed the transcript.
Do not exaggerate or invent anything that is not present in the video.
Avoid emojis unless they genuinely fit the tone.
Do not include a portfolio link unless specifically requested.
Prioritize specificity over compliments.

STYLE:
Authentic, conversational, concise, confident, and friendly.

Think about the video first, identify the most interesting specific element, and then connect that element naturally to how a skilled video editor could improve the content's storytelling, pacing, retention, visuals, or overall presentation.

IMPORTANT:
The comment must be useful and relevant even if the creator ignores the editing offer.

Reply with ONLY the 2-line comment. No quotation marks, explanations, labels, or extra text.`,
    }],
  })

  const block = response.content[0]
  if (block.type !== 'text') throw new Error('Unexpected response type from Claude')
  return block.text.trim()
}
