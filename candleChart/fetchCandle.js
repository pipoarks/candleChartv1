console.log('FetchCandle module loaded');

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3000;

const FYERS_TOKEN = "E3D5D0NFAV-100:eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOlsiZDoxIiwiZDoyIiwieDowIiwieDoxIiwieDoyIl0sImF0X2hhc2giOiJnQUFBQUFCcFdLUVhEUzVac1M5QWpXTnh0RWVCMDQxTkxKZjJNRDFXV3Vwc1ZkYlEtTllpTlgxZE9yNGh6THZ0dHhoX09Mc2JydzJ4XzVVMHNkS2J1YXgyTjl0MThYRFR4NDBKWlZOV2dFNU1qM3NNSlRiMHYyTT0iLCJkaXNwbGF5X25hbWUiOiIiLCJvbXMiOiJLMSIsImhzbV9rZXkiOiJhNDBmYTA0MjQ4MDUxMzFjMjRmOGE2NzIwOWFhNjliZmRiZDNmYWUxODc3M2RjMDMzNGYzMWU5MCIsImlzRGRwaUVuYWJsZWQiOiJOIiwiaXNNdGZFbmFibGVkIjoiTiIsImZ5X2lkIjoiWUE0NDA3NyIsImFwcFR5cGUiOjEwMCwiZXhwIjoxNzY3NDg2NjAwLCJpYXQiOjE3Njc0MTY4NTUsImlzcyI6ImFwaS5meWVycy5pbiIsIm5iZiI6MTc2NzQxNjg1NSwic3ViIjoiYWNjZXNzX3Rva2VuIn0.7QNWvnfWCt3mh8YnPmIz32XsYnKNnDqCgZXEmvygiqc";


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


/**
 * Fyers 1-Minute Historical Data Proxy (for CVD calculations)
 * Example:
 * /history-1min?symbol=NSE:SBIN-EQ&date_format=1&range_from=2025-01-01&range_to=2025-01-31&cont_flag=1
 */
app.get('/history-1min', async (req, res) => {
  try {
    const {
      symbol,
      date_format = "1",
      range_from = "2025-12-31",
      range_to = "2025-12-31",
      cont_flag = "1"
    } = req.query;

    if (!symbol || !range_from || !range_to) {
      return res.status(400).json({
        error: 'Missing required query parameters'
      });
    }

    // const FYERS_TOKEN = "E3D5D0NFAV-100:eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOlsiZDoxIiwiZDoyIiwieDowIiwieDoxIiwieDoyIl0sImF0X2hhc2giOiJnQUFBQUFCcFdLUVhEUzVac1M5QWpXTnh0RWVCMDQxTkxKZjJNRDFXV3Vwc1ZkYlEtTllpTlgxZE9yNGh6THZ0dHhoX09Mc2JydzJ4XzVVMHNkS2J1YXgyTjl0MThYRFR4NDBKWlZOV2dFNU1qM3NNSlRiMHYyTT0iLCJkaXNwbGF5X25hbWUiOiIiLCJvbXMiOiJLMSIsImhzbV9rZXkiOiJhNDBmYTA0MjQ4MDUxMzFjMjRmOGE2NzIwOWFhNjliZmRiZDNmYWUxODc3M2RjMDMzNGYzMWU5MCIsImlzRGRwaUVuYWJsZWQiOiJOIiwiaXNNdGZFbmFibGVkIjoiTiIsImZ5X2lkIjoiWUE0NDA3NyIsImFwcFR5cGUiOjEwMCwiZXhwIjoxNzY3NDg2NjAwLCJpYXQiOjE3Njc0MTY4NTUsImlzcyI6ImFwaS5meWVycy5pbiIsIm5iZiI6MTc2NzQxNjg1NSwic3ViIjoiYWNjZXNzX3Rva2VuIn0.7QNWvnfWCt3mh8YnPmIz32XsYnKNnDqCgZXEmvygiqc";

    // Force resolution to 1 minute for CVD calculations
    const url =
      `https://api-t1.fyers.in/data/history` +
      `?symbol=${symbol}` +
      `&resolution=1` +  // Hardcoded to 1 minute
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
    console.error('Fyers API error (1-min):', err);
    res.status(500).json({ error: 'Failed to fetch Fyers 1-minute data' });
  }
});


app.listen(3000, () => {
  console.log('Proxy server running on http://127.0.0.1:3000');
});
