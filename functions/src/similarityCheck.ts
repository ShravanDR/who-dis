import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

/**
 * Fetches an image URL and returns it as a base64 data string.
 */
async function imageToBase64(url: string): Promise<{ data: string; mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' }> {
  const parsed = new URL(url)
  if (parsed.hostname !== 'firebasestorage.googleapis.com') {
    throw new Error('Only Firebase Storage URLs are allowed')
  }

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Fetch failed with status ${response.status}`)
  }
  const buffer = await response.arrayBuffer()
  const base64 = Buffer.from(buffer).toString('base64')
  const contentType = response.headers.get('content-type') ?? 'image/jpeg'
  const mediaType = contentType.startsWith('image/png') ? 'image/png' as const
    : contentType.startsWith('image/webp') ? 'image/webp' as const
    : contentType.startsWith('image/gif') ? 'image/gif' as const
    : 'image/jpeg' as const
  return { data: base64, mediaType }
}

/**
 * Returns true if two image URLs are conceptually similar.
 * Uses Claude vision to compare both images in a single call.
 */
export async function areImagesSimilar(urlA: string, urlB: string): Promise<boolean> {
  const [imgA, imgB] = await Promise.all([imageToBase64(urlA), imageToBase64(urlB)])

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 10,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: imgA.mediaType, data: imgA.data } },
        { type: 'image', source: { type: 'base64', media_type: imgB.mediaType, data: imgB.data } },
        { type: 'text', text: 'Are these two images conceptually similar — depicting the same idea, subject, or scene? Answer only YES or NO.' },
      ],
    }],
  })

  const answer = response.content[0].type === 'text' ? response.content[0].text.trim().toUpperCase() : ''
  return answer.startsWith('YES')
}
