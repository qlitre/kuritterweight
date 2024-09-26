import { Hono } from 'hono'
import { Weights } from './types/tables';

import {
  MessageAPIResponseBase,
  TextMessage,
  WebhookEvent,
  MessageEvent
} from "@line/bot-sdk";

type Bindings = {
  CHANNEL_ACCESS_TOKEN: string
  DB: D1Database;
}

const app = new Hono<{ Bindings: Bindings }>()
const tableName = "DailyWeights"

app.get('/', (c) => c.text('Hello Hono!'))

app.post("/api/webhook", async (c) => {
  if (!c.env) {
    console.error('Environment variables are not available');
    return c.json({ error: 'Environment configuration error' });
  }

  const data = await c.req.json();
  const events: WebhookEvent[] = (data as any).events;

  const event = events
    .map((event: WebhookEvent) => {
      if (event.type != "message") return
      if (event.message.type != "text") return
      return event;
    }).filter((event) => event)[0];
  if (!event) {
    console.log(`No event: ${events}`);
    return c.json({ message: "ok" });
  }

  const accessToken: string = c.env.CHANNEL_ACCESS_TOKEN;
  try {
    const userId = event.source.userId;
    // filterしている関係かやらないと型エラーが起きる
    if (event.message.type != 'text') return
    const curWeight = parseFloat(event.message.text); // 体重データのパース

    let message = "";
    if (!isNaN(curWeight) && userId) {
      const sqlSelect = `
      select weight from ${tableName}
      where date = (select max(date) from ${tableName} where line_id=?);
      `
      const result: Weights | null = await c.env.DB.prepare(sqlSelect).bind(userId).first();
      const recentWeight = result ? result.weight : null;
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
    await c.env.DB.prepare(
      `insert into ${tableName} (line_id,date,weight) values (?, ?, ?)`
    )
      .bind(userId, timestamp, curWeight)
      .run();
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

const textEventHandler = async (
  event: MessageEvent,
  accessToken: string,
  message: string,
): Promise<MessageAPIResponseBase | undefined> => {

  const { replyToken } = event;
  const response: TextMessage = {
    type: "text",
    text: message,
  };
  await fetch("https://api.line.me/v2/bot/message/reply", {
    body: JSON.stringify({
      replyToken: replyToken,
      messages: [response],
    }),
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
  return
};

const buildMessage = (recentWeight: number, curWeight: number) => {
  const diff = curWeight - recentWeight;
  let message = `${curWeight}kg`;
  // 小数点第一位まで表示
  const diffString = diff.toFixed(1);
  if (diff > 0) {
    message += `(+${diffString})`;
  } else if (diff < 0) {
    message += `(${diffString})`;
  } else {
    message += `(±0)`;
  }
  return `${message} #kuritterweight`
}

const getJSTFormattedTimestamp = (): string => {
  const now = new Date();

  // UTC時間に基づいて日本時間を計算
  const jstOffset = 9 * 60; // JSTはUTC+9
  const jstDate = new Date(now.getTime() + jstOffset * 60 * 1000);

  const year = jstDate.getUTCFullYear();
  const month = String(jstDate.getUTCMonth() + 1).padStart(2, '0'); // 月は0から始まるので1を足す
  const date = String(jstDate.getUTCDate()).padStart(2, '0');
  const hours = String(jstDate.getUTCHours()).padStart(2, '0');
  const minutes = String(jstDate.getUTCMinutes()).padStart(2, '0');

  return `${year}-${month}-${date} ${hours}:${minutes}`;
};

export default app