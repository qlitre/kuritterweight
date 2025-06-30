export const buildMessage = (recentWeight: number, curWeight: number): string => {
  const diff = curWeight - recentWeight
  let message = `${curWeight}kg`
  // 小数点第一位まで表示
  const diffString = diff.toFixed(1)
  if (diff > 0) {
    message += `(+${diffString})`
  } else if (diff < 0) {
    message += `(${diffString})`
  } else {
    message += `(±0)`
  }
  return `${message} #kuritterweight`
}

export const getJSTFormattedTimestamp = (): string => {
  const now = new Date()

  // UTC時間に基づいて日本時間を計算
  const jstOffset = 9 * 60 // JSTはUTC+9
  const jstDate = new Date(now.getTime() + jstOffset * 60 * 1000)

  const year = jstDate.getUTCFullYear()
  const month = String(jstDate.getUTCMonth() + 1).padStart(2, '0') // 月は0から始まるので1を足す
  const date = String(jstDate.getUTCDate()).padStart(2, '0')
  const hours = String(jstDate.getUTCHours()).padStart(2, '0')
  const minutes = String(jstDate.getUTCMinutes()).padStart(2, '0')

  return `${year}-${month}-${date} ${hours}:${minutes}`
}

export const parseWeightFromText = (text: string): number => {
  return parseFloat(text)
}
