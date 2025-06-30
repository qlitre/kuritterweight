import { Hono } from 'hono'
import { WebhookEvent } from "@line/bot-sdk";
import { getLatestWeight, saveWeight } from './database/operations';
import { textEventHandler, processWebhookEvents } from './line/handlers';
import { buildMessage, getJSTFormattedTimestamp, parseWeightFromText } from './utils';

type Bindings = {
  CHANNEL_ACCESS_TOKEN: string
  DB: D1Database;
}

const app = new Hono<{ Bindings: Bindings }>()

app.get('/', (c) => c.text('Hello Hono!'))

app.post("/api/webhook", async (c) => {
  if (!c.env) {
    console.error('Environment variables are not available');
    return c.json({ error: 'Environment configuration error' });
  }

  const data = await c.req.json();
  const events: WebhookEvent[] = (data as any).events;

  const event = processWebhookEvents(events);
  if (!event) {
    console.log(`No event: ${events}`);
    return c.json({ message: "ok" });
  }

  const accessToken: string = c.env.CHANNEL_ACCESS_TOKEN;
  try {
    const userId = event.source.userId;
    // filterしている関係かやらないと型エラーが起きる
    if (event.message.type != 'text') return
    const curWeight = parseWeightFromText(event.message.text); // 体重データのパース

    let message = "";
    if (!isNaN(curWeight) && userId) {
      const recentWeight = await getLatestWeight(c.env.DB, userId);
      if (!recentWeight) return c.json({ message: "ok" });
      message = buildMessage(recentWeight, curWeight);
    } else {
      message = "体重データが不正です";
      await textEventHandler(event, accessToken, message);
      return c.json({
        status: "error",
      });
    }
    await textEventHandler(event, accessToken, message);
    //D1への保存
    const timestamp = getJSTFormattedTimestamp()
    await saveWeight(c.env.DB, userId, curWeight, timestamp);
    return c.json({ message: "ok" });
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error(err);
    }
    return c.json({
      status: "error",
    });
  }
});

export default app