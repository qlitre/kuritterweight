import { MessageAPIResponseBase, TextMessage, WebhookEvent, MessageEvent } from '@line/bot-sdk'

export const textEventHandler = async (
  event: MessageEvent,
  accessToken: string,
  message: string
): Promise<MessageAPIResponseBase | undefined> => {
  const { replyToken } = event
  const response: TextMessage = {
    type: 'text',
    text: message,
  }
  await fetch('https://api.line.me/v2/bot/message/reply', {
    body: JSON.stringify({
      replyToken: replyToken,
      messages: [response],
    }),
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })
  return
}

export const processWebhookEvents = (events: WebhookEvent[]): MessageEvent | null => {
  const event = events
    .map((event: WebhookEvent) => {
      if (event.type != 'message') return
      if (event.message.type != 'text') return
      return event
    })
    .filter((event) => event)[0]

  return event || null
}
