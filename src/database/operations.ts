import { Weights } from '../types/types'

const tableName = 'DailyWeights'

export const saveWeight = async (
  db: D1Database,
  userId: string,
  weight: number,
  timestamp: string
): Promise<void> => {
  await db
    .prepare(`insert into ${tableName} (line_id,date,weight) values (?, ?, ?)`)
    .bind(userId, timestamp, weight)
    .run()
}

export const deleteLatestWeight = async (db: D1Database, userId: string): Promise<boolean> => {
  const sqlDelete = `
    DELETE FROM ${tableName}
    WHERE line_id = ? AND date = (
      SELECT date FROM ${tableName}
      WHERE line_id = ?
      ORDER BY date DESC
      LIMIT 1
    );
  `
  const result = await db.prepare(sqlDelete).bind(userId, userId).run()
  return (result.meta?.changes ?? 0) > 0
}

export const getWeightHistory = async (
  db: D1Database,
  days: number = 30,
  dateFrom?: string,
  dateTo?: string
): Promise<Weights[]> => {
  let whereClauses: string[] = []
  const params = []
  if (dateFrom && dateTo) {
    whereClauses.push(`date BETWEEN ? AND ?`)
    params.push(dateFrom, dateTo)
  } else if (dateFrom) {
    whereClauses.push(`date >= ?`)
    params.push(dateFrom)
  } else if (dateTo) {
    whereClauses.push(`date <= ?`)
    params.push(dateTo)
  }
  params.push(days)
  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''
  let sqlSelect = `
    SELECT id, date, weight
    FROM ${tableName}
    ${whereSql}
    ORDER BY date DESC
    LIMIT ?
  `

  const results = await db
    .prepare(sqlSelect)
    .bind(...params)
    .all()
  return results.results as Weights[]
}
