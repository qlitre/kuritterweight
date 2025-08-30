import { Hono } from 'hono'
import { WebhookEvent } from '@line/bot-sdk'
import { getLatestWeight, saveWeight, getWeightHistory, deleteLatestWeight } from './database/operations'
import { textEventHandler, processWebhookEvents } from './line/handlers'
import { buildMessage, getJSTFormattedTimestamp, parseWeightFromText } from './utils'
import { Bindings } from './types/types'
import { WeightChartPage } from './components/WeightChartPage'
import mcpApp from './mcp'

const app = new Hono<{ Bindings: Bindings }>()

app.get('/', (c) => {
  return c.html(WeightChartPage())
})

app.get('/api/weight-history', async (c) => {
  if (!c.env) {
    console.error('Environment variables are not available')
    return c.json({ error: 'Environment configuration error' }, 500)
  }

  try {
    const weightHistory = await getWeightHistory(c.env.DB, 30)
    return c.json(weightHistory)
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error('Error fetching weight history:', err)
    }
    return c.json({ error: 'Failed to fetch weight history' }, 500)
  }
})

app.post('/api/webhook', async (c) => {
  if (!c.env) {
    console.error('Environment variables are not available')
    return c.json({ error: 'Environment configuration error' })
  }

  const data = await c.req.json()
  const events: WebhookEvent[] = (data as any).events

  const event = processWebhookEvents(events)
  if (!event) {
    console.log(`No event: ${events}`)
    return c.json({ message: 'ok' })
  }

  const accessToken: string = c.env.CHANNEL_ACCESS_TOKEN
  try {
    const userId = event.source.userId
    // filterしている関係かやらないと型エラーが起きる
    if (event.message.type != 'text') return
    
    const messageText = event.message.text.trim()
    
    // 削除メッセージの処理
    if (messageText === '削除' && userId) {
      try {
        const deleted = await deleteLatestWeight(c.env.DB, userId)
        let deleteMessage = ''
        if (deleted) {
          deleteMessage = '最新の体重データを削除しました #kuritterweight'
          console.log(`Weight deleted successfully for userId=${userId}`)
        } else {
          deleteMessage = '削除対象のデータが見つかりませんでした'
        }
        await textEventHandler(event, accessToken, deleteMessage)
        return c.json({ message: 'ok' })
      } catch (deleteError) {
        console.error('Failed to delete weight data:', deleteError)
        const errorMessage = '削除処理でエラーが発生しました'
        await textEventHandler(event, accessToken, errorMessage)
        return c.json({ status: 'error' })
      }
    }
    
    // 履歴メッセージの処理
    if (messageText === '履歴' && userId) {
      try {
        const history = await getWeightHistory(c.env.DB, 5)
        const userHistory = history.filter(record => record.line_id === userId)
        
        let historyMessage = ''
        if (userHistory.length > 0) {
          historyMessage = '📊 直近5件の体重履歴\n\n'
          userHistory.forEach((record, index) => {
            const date = new Date(record.date)
            const formattedDate = date.toLocaleDateString('ja-JP', { 
              month: 'numeric', 
              day: 'numeric'
            })
            historyMessage += `${index + 1}. ${formattedDate}: ${record.weight}kg\n`
          })
          historyMessage += '\n#kuritterweight'
        } else {
          historyMessage = 'まだ体重データがありません'
        }
        
        await textEventHandler(event, accessToken, historyMessage)
        return c.json({ message: 'ok' })
      } catch (historyError) {
        console.error('Failed to get weight history:', historyError)
        const errorMessage = '履歴取得でエラーが発生しました'
        await textEventHandler(event, accessToken, errorMessage)
        return c.json({ status: 'error' })
      }
    }
    
    const curWeight = parseWeightFromText(messageText) // 体重データのパース

    let message = ''
    if (!isNaN(curWeight) && userId) {
      const recentWeight = await getLatestWeight(c.env.DB, userId)
      if (!recentWeight) return c.json({ message: 'ok' })
      message = buildMessage(recentWeight, curWeight)
      
      // データ保存を先に実行
      const timestamp = getJSTFormattedTimestamp()
      try {
        await saveWeight(c.env.DB, userId, curWeight, timestamp)
        console.log(`Weight saved successfully: userId=${userId}, weight=${curWeight}, timestamp=${timestamp}`)
      } catch (saveError) {
        console.error('Failed to save weight to database:', saveError)
        throw saveError // 保存失敗時は処理を中断
      }
      
      // 保存成功後にメッセージを送信
      try {
        await textEventHandler(event, accessToken, message)
        console.log(`Message sent successfully to userId=${userId}`)
      } catch (messageError) {
        console.error('Failed to send LINE message:', messageError)
        // メッセージ送信失敗でもデータは保存済みなので続行
      }
    } else {
      message = '体重データが不正です'
      await textEventHandler(event, accessToken, message)
      return c.json({
        status: 'error',
      })
    }
    return c.json({ message: 'ok' })
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error(err)
    }
    return c.json({
      status: 'error',
    })
  }
})

app.route('/mcp', mcpApp)

export default app
