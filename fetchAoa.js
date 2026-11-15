const https = require('https');

https.get('https://query1.finance.yahoo.com/v8/finance/chart/USDAOA=X', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
        const json = JSON.parse(data);
        console.log("Yahoo Finance Rate:", json.chart.result[0].meta.regularMarketPrice);
    } catch (e) {
        console.error("Error parsing Yahoo Finance data", e);
    }
  });
});
