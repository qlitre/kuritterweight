/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

import { App } from '@modelcontextprotocol/ext-apps'
import { Chart, LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Filler } from 'chart.js'

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Filler)

const recentDataEl = document.getElementById('recent-data')!
const monthlyDataEl = document.getElementById('monthly-data')!
const btnRecent = document.getElementById('btn-recent')!
const btnMonthly = document.getElementById('btn-monthly')!
const btnChart = document.getElementById('btn-chart')!
const dateStartEl = document.getElementById('date-start') as HTMLInputElement
const dateEndEl = document.getElementById('date-end') as HTMLInputElement
const chartCanvas = document.getElementById('weight-chart') as HTMLCanvasElement
const chartMessageEl = document.getElementById('chart-message')!

// デフォルトの日付範囲（過去30日）
const today = new Date()
const thirtyDaysAgo = new Date(today)
thirtyDaysAgo.setDate(today.getDate() - 30)
dateEndEl.value = today.toISOString().split('T')[0]
dateStartEl.value = thirtyDaysAgo.toISOString().split('T')[0]

const app = new App({ name: 'kuritterweight-app', version: '1.0.0' })

type WeightRecord = {
  date: string
  weight: number
}

type MonthlyRecord = {
  month: string
  avg_weight: number
}

let weightChart: Chart | null = null

function renderRecentTable(records: WeightRecord[]) {
  if (records.length === 0) {
    return '<p>No data</p>'
  }
  let html = '<table><tr><th>Date</th><th>Weight</th></tr>'
  for (const r of records) {
    html += `<tr><td>${r.date}</td><td>${r.weight}kg</td></tr>`
  }
  html += '</table>'
  return html
}

function renderMonthlyTable(records: MonthlyRecord[]) {
  if (records.length === 0) {
    return '<p>No data</p>'
  }
  let html = '<table><tr><th>Month</th><th>Avg Weight</th></tr>'
  for (const r of records) {
    html += `<tr><td>${r.month}</td><td>${r.avg_weight}kg</td></tr>`
  }
  html += '</table>'
  return html
}

function renderChart(records: WeightRecord[]) {
  if (weightChart) {
    weightChart.destroy()
    weightChart = null
  }

  if (records.length === 0) {
    chartMessageEl.innerHTML = '<p>No data</p>'
    return
  }
  chartMessageEl.innerHTML = ''

  const labels = records.map((r) => {
    const d = new Date(r.date)
    return `${d.getMonth() + 1}/${d.getDate()}`
  })
  const weights = records.map((r) => r.weight)

  weightChart = new Chart(chartCanvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Weight (kg)',
          data: weights,
          borderColor: '#4a90d9',
          backgroundColor: 'rgba(74, 144, 217, 0.1)',
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: '#4a90d9',
          fill: true,
          tension: 0.3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          title: { display: true, text: 'kg' },
        },
      },
    },
  })
}

function parseToolResult(result: { content?: Array<{ type: string; text?: string }> }) {
  const text = result.content?.find((c) => c.type === 'text')?.text
  if (!text) return null
  try {
    const parsed = JSON.parse(text)
    return parsed.results ?? parsed
  } catch {
    return text
  }
}

app.ontoolresult = (result) => {
  const data = parseToolResult(result)
  if (Array.isArray(data) && data.length > 0 && 'weight' in data[0]) {
    recentDataEl.innerHTML = renderRecentTable(data)
  } else if (Array.isArray(data) && data.length > 0 && 'avg_weight' in data[0]) {
    monthlyDataEl.innerHTML = renderMonthlyTable(data)
  }
}

btnRecent.addEventListener('click', async () => {
  recentDataEl.innerHTML = '<span class="loading">Loading...</span>'
  try {
    const result = await app.callServerTool({ name: 'getRecentWeight', arguments: {} })
    const data = parseToolResult(result)
    recentDataEl.innerHTML = renderRecentTable(data as WeightRecord[])
  } catch (e) {
    recentDataEl.innerHTML = `<span class="error">Error: ${e}</span>`
  }
})

btnMonthly.addEventListener('click', async () => {
  monthlyDataEl.innerHTML = '<span class="loading">Loading...</span>'
  try {
    const result = await app.callServerTool({ name: 'getMonthlyAverageWeight', arguments: { months: 6 } })
    const data = parseToolResult(result)
    monthlyDataEl.innerHTML = renderMonthlyTable(data as MonthlyRecord[])
  } catch (e) {
    monthlyDataEl.innerHTML = `<span class="error">Error: ${e}</span>`
  }
})

btnChart.addEventListener('click', async () => {
  const startDate = dateStartEl.value
  const endDate = dateEndEl.value
  if (!startDate || !endDate) {
    chartMessageEl.innerHTML = '<span class="error">日付を指定してください</span>'
    return
  }
  chartMessageEl.innerHTML = '<span class="loading">Loading...</span>'
  try {
    const result = await app.callServerTool({
      name: 'getWeightByDateRange',
      arguments: { startDate, endDate },
    })
    const data = parseToolResult(result)
    renderChart(data as WeightRecord[])
  } catch (e) {
    chartMessageEl.innerHTML = `<span class="error">Error: ${e}</span>`
  }
})

app.connect()
