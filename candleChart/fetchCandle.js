console.log('FetchCandle module loaded');

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors());

/**
 * Health check
 */
app.get('/', (req, res) => {
  res.send('FetchCandle is running');
});

/**
 * Fyers Historical Data Proxy
 * Example:
 * /history?symbol=NSE:SBIN-EQ&resolution=5&date_format=1&range_from=2025-01-01&range_to=2025-01-31&cont_flag=1
 */
app.get('/history', async (req, res) => {
  try {
    const {
      symbol,
      resolution = "5",
      date_format = "1",
      range_from = "2025-12-31",
      range_to = "2025-12-31",
      cont_flag = "1"
    } = req.query;

    if (!symbol || !resolution || !range_from || !range_to) {
      return res.status(400).json({
        error: 'Missing required query parameters'
      });
    }

    const FYERS_TOKEN = "E3D5D0NFAV-100:eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOlsiZDoxIiwiZDoyIiwieDowIiwieDoxIiwieDoyIl0sImF0X2hhc2giOiJnQUFBQUFCcFZoczZEVVR1TkdoSnhGYmJObkZOS18tOWpYS29MMkdrSld6Ym9ZN3RJNGZhV09lY2wyTUNXeFVWdjNwWXpfSExwV25pYVUtRktXWjVGbmlxY2s5U1VCZkF1aTMtWmVuc0xHNVE1cVcxM19ET3J5TT0iLCJkaXNwbGF5X25hbWUiOiIiLCJvbXMiOiJLMSIsImhzbV9rZXkiOiI3MzA1Y2EyNjliNTM4ZDQxN2Y3Y2FiNTE1NjVhNDIzNDY0NzI2YTFjMzZhMzFiYTkzMjE2OTAxNCIsImlzRGRwaUVuYWJsZWQiOiJOIiwiaXNNdGZFbmFibGVkIjoiTiIsImZ5X2lkIjoiWUE0NDA3NyIsImFwcFR5cGUiOjEwMCwiZXhwIjoxNzY3MzEzODAwLCJpYXQiOjE3NjcyNTA3NDYsImlzcyI6ImFwaS5meWVycy5pbiIsIm5iZiI6MTc2NzI1MDc0Niwic3ViIjoiYWNjZXNzX3Rva2VuIn0.MfFB_cxWec9IRAWSPQlxJ5q2039soNf2gF4XJol1vJ8";

    const url =
      `https://api-t1.fyers.in/data/history` +
      `?symbol=${symbol}` +
      `&resolution=${resolution}` +
      `&date_format=${date_format || 1}` +
      `&range_from=${range_from}` +
      `&range_to=${range_to}` +
      `&cont_flag=${cont_flag || 1}`;

    const response = await fetch(url, {
      headers: {
        Authorization: FYERS_TOKEN
      }
    });

    const data = await response.json();
    res.json(data);

  } catch (err) {
    console.error('Fyers API error:', err);
    res.status(500).json({ error: 'Failed to fetch Fyers data' });
  }
});


app.listen(3000, () => {
  console.log('Proxy server running on http://127.0.0.1:3000');
});
