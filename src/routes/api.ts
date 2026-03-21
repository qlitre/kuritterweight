import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { Bindings, Weights } from '../types/types'
import { getWeightHistory } from '../database/operations'

const WeightSchema = z.object({
  id: z.number().openapi({ example: 1 }),
  date: z.string().openapi({ example: '2026-03-20 09:00' }),
  weight: z.number().openapi({ example: 65.5 }),
})

const ErrorSchema = z.object({
  error: z.string().openapi({
    example: 'Failed to fetch weight history',
  }),
})

const WeightHistoryRoute = createRoute({
  method: 'get',
  path: '/weight-history',
  request: {
    query: z.object({
      days: z.coerce.number().int().positive().max(365).optional().default(30).openapi({
        example: 30,
        description: '取得件数',
      }),
      dateFrom: z.string().optional().openapi({
        example: '2026-03-01',
        description: '開始日 (YYYY-MM-DD)',
      }),
      dateTo: z.string().optional().openapi({
        example: '2026-03-21',
        description: '終了日 (YYYY-MM-DD)',
      }),
    }),
  },
  responses: {
    200: {
      description: '体重履歴',
      content: {
        'application/json': {
          schema: z.array(WeightSchema),
        },
      },
    },
    500: {
      description: 'サーバーエラー',
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
    },
  },
})

const app = new OpenAPIHono<{ Bindings: Bindings }>()
app.openapi(WeightHistoryRoute, async (c) => {
  try {
    const { days, dateFrom, dateTo } = c.req.valid('query')
    const weightHistory = await getWeightHistory(c.env.DB, days, dateFrom, dateTo)
    return c.json(weightHistory, 200)
  } catch (err) {
    console.error('Error fetching weight history:', err)
    return c.json(
      {
        error: 'Failed to fetch weight history',
      },
      500
    )
  }
})

export default app
