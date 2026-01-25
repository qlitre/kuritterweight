import { StreamableHTTPTransport } from '@hono/mcp'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { Hono } from 'hono'
import { Bindings } from './types/types'

export const getMcpServer = async (c: Context<{ Bindings: Bindings }>) => {
  const server = new McpServer({
    name: 'kuritterweight-mcp',
    version: '0.0.1',
  })
  server.registerTool(
    'getRecentWeight',
    {
      title: 'Get kuri_tter recent weight',
      description: 'Get kuri_tter recent weight',
      inputSchema: {},
    },
    async () => {
      const result = await c.env.DB.prepare(
        'SELECT * FROM DailyWeights ORDER BY date DESC Limit 7'
      ).all()
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result),
          },
        ],
      }
    }
  )
  server.registerTool(
    'getMonthlyAverageWeight',
    {
      title: 'Get average weight for each month',
      description: 'Get average weight for each month',
      inputSchema: {
        months: z.number().int().positive().max(60).optional(),
      },
    },
    async ({ months }) => {
      const sql = `
          SELECT
            strftime('%Y-%m', date) AS month,
            ROUND(AVG(weight), 1)    AS avg_weight
          FROM DailyWeights
          GROUP BY month
          ORDER BY month DESC
          ${months ? 'LIMIT ?' : ''}
        `
      const { results } = await c.env.DB.prepare(sql)
        .bind(...(months ? [months] : []))
        .all()
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(results),
          },
        ],
      }
    }
  )

  return server
}

const app = new Hono<{ Bindings: Bindings }>()

app.all('/', async (c) => {
  const mcpServer = await getMcpServer(c)
  const transport = new StreamableHTTPTransport()
  await mcpServer.connect(transport)
  return transport.handleRequest(c)
})

app.onError((err, c) => {
  console.log(err.message)

  if (err instanceof HTTPException && err.res) {
    return err.res
  }

  return c.json(
    {
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: 'Internal server error',
      },
      id: null,
    },
    500
  )
})

export default app
