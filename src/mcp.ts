import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import {
  registerAppTool,
  registerAppResource,
  RESOURCE_MIME_TYPE,
} from '@modelcontextprotocol/ext-apps/server'
import { z } from 'zod'
import { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { Hono } from 'hono'
import { Bindings } from './types/types'
import html from '../dist-mcp-app/index.html?raw'
import { getWeightHistory, getMonthlyAverageWeight } from './database/operations'

const resourceUri = 'ui://kuritterweight'

export const getMcpServer = async (c: Context<{ Bindings: Bindings }>) => {
  const server = new McpServer({
    name: 'kuritterweight-mcp',
    version: '0.0.1',
  })

  const db = c.env.DB

  registerAppTool(
    server,
    'getRecentWeight',
    {
      title: 'Get kuri_tter recent weight',
      description: 'Get kuri_tter recent weight',
      inputSchema: {},
      _meta: { ui: { resourceUri } },
    },
    async () => {
      const result = await getWeightHistory(db, 7)
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result),
          },
        ],
      }
    }
  )

  registerAppTool(
    server,
    'getMonthlyAverageWeight',
    {
      title: 'Get average weight for each month',
      description: 'Get average weight for each month',
      inputSchema: {
        months: z.number().int().positive().max(60).optional(),
      },
      _meta: { ui: { resourceUri } },
    },
    async ({ months }) => {
      const result = await getMonthlyAverageWeight(db, months)
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result),
          },
        ],
      }
    }
  )

  registerAppTool(
    server,
    'getWeightByDateRange',
    {
      title: 'Get weight data by date range',
      description: 'Get daily weight data between start and end dates',
      inputSchema: {
        startDate: z.string().describe('Start date in YYYY-MM-DD format'),
        endDate: z.string().describe('End date in YYYY-MM-DD format'),
      },
      _meta: { ui: { resourceUri } },
    },
    async ({ startDate, endDate }) => {
      const result = await getWeightHistory(db, 365, startDate, endDate + ' 23:59')
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result),
          },
        ],
      }
    }
  )

  registerAppResource(
    server,
    resourceUri,
    resourceUri,
    { mimeType: RESOURCE_MIME_TYPE },
    async () => {
      return {
        contents: [{ uri: resourceUri, mimeType: RESOURCE_MIME_TYPE, text: html }],
      }
    }
  )

  return server
}

const app = new Hono<{ Bindings: Bindings }>()

app.all('/', async (c) => {
  const mcpServer = await getMcpServer(c)
  const transport = new WebStandardStreamableHTTPServerTransport()
  await mcpServer.connect(transport)
  return transport.handleRequest(c.req.raw)
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
