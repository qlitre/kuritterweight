export const WeightChartPage = () => {
  return `
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
  `
}