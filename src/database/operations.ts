import { Weights } from '../types/tables'

const tableName = 'DailyWeights'

export const getLatestWeight = async (db: D1Database, userId: string): Promise<number | null> => {
  const sqlSelect = `
    select weight from ${tableName}
    where date = (select max(date) from ${tableName} where line_id=?);
  `
  const result: Weights | null = await db.prepare(sqlSelect).bind(userId).first()
  return result ? result.weight : null
}

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

export const getWeightHistory = async (db: D1Database, days: number = 30): Promise<Weights[]> => {
  const sqlSelect = `
    SELECT id, line_id, date, weight
    FROM ${tableName}
    ORDER BY date DESC
    LIMIT ?
  `
  const results = await db.prepare(sqlSelect).bind(days).all()
  return results.results as Weights[]
}
