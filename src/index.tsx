import { Hono } from 'hono'
import { WebhookEvent } from '@line/bot-sdk'
import { getLatestWeight, saveWeight, getWeightHistory, deleteLatestWeight } from './database/operations'
import { textEventHandler, processWebhookEvents } from './line/handlers'
import { buildMessage, getJSTFormattedTimestamp, parseWeightFromText } from './utils'
import { Bindings } from './types/types'
import mcpApp from './mcp'

const app = new Hono<{ Bindings: Bindings }>()

app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>体重推移グラフ</title>
      <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
      <style>
        body {
          font-family: 'Arial', sans-serif;
          margin: 0;
          padding: 20px;
          background-color: #f5f5f5;
        }
        .container {
          max-width: 800px;
          margin: 0 auto;
          background-color: white;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
          text-align: center;
          color: #333;
          margin-bottom: 30px;
        }
        .chart-container {
          position: relative;
          height: 400px;
          width: 100%;
        }
        .loading {
          text-align: center;
          color: #666;
          margin: 20px 0;
        }
        .error {
          color: #ff4444;
          text-align: center;
          margin: 20px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🏃‍♂️ kuri_tterの体重推移グラフ（直近30日）</h1>
        <div id="loading" class="loading">データを読み込み中...</div>
        <div id="error" class="error" style="display: none;"></div>
        <div class="chart-container">
          <canvas id="weightChart"></canvas>
        </div>
      </div>

      <script>
        let chartInstance = null;

        async function loadWeightData() {
          try {
            const response = await fetch('/api/weight-history');
            if (!response.ok) {
              throw new Error('データの取得に失敗しました');
            }
            const data = await response.json();
            
            if (data.length === 0) {
              document.getElementById('error').textContent = 'データが見つかりませんでした';
              document.getElementById('error').style.display = 'block';
              document.getElementById('loading').style.display = 'none';
              return;
            }

            // データを日付順（古い順）にソート
            data.reverse();

            const labels = data.map(item => {
              const date = new Date(item.date);
              return date.toLocaleDateString('ja-JP', { 
                month: 'short', 
                day: 'numeric' 
              });
            });

            const weights = data.map(item => item.weight);

            createChart(labels, weights);
            document.getElementById('loading').style.display = 'none';
          } catch (error) {
            document.getElementById('error').textContent = error.message;
            document.getElementById('error').style.display = 'block';
            document.getElementById('loading').style.display = 'none';
          }
        }

        function createChart(labels, weights) {
          const ctx = document.getElementById('weightChart').getContext('2d');
          
          if (chartInstance) {
            chartInstance.destroy();
          }

          chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
              labels: labels,
              datasets: [{
                label: '体重 (kg)',
                data: weights,
                borderColor: '#4CAF50',
                backgroundColor: 'rgba(76, 175, 80, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.1,
                pointBackgroundColor: '#4CAF50',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                title: {
                  display: true,
                  text: '体重推移',
                  font: {
                    size: 16
                  }
                },
                legend: {
                  display: false
                }
              },
              scales: {
                y: {
                  beginAtZero: false,
                  grid: {
                    color: 'rgba(0,0,0,0.1)'
                  },
                  ticks: {
                    callback: function(value) {
                      return value + 'kg';
                    }
                  }
                },
                x: {
                  grid: {
                    color: 'rgba(0,0,0,0.1)'
                  }
                }
              },
              interaction: {
                intersect: false,
                mode: 'index'
              },
              plugins: {
                tooltip: {
                  callbacks: {
                    label: function(context) {
                      return '体重: ' + context.parsed.y + 'kg';
                    }
                  }
                }
              }
            }
          });
        }

        // ページ読み込み時にデータを取得
        loadWeightData();

        // リサイズ時にチャートを更新
        window.addEventListener('resize', function() {
          if (chartInstance) {
            chartInstance.resize();
          }
        });
      </script>
    </body>
    </html>
  `)
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
