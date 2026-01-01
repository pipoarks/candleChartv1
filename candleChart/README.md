# TradingView Candlestick Chart Visualization

An interactive candlestick chart visualization using TradingView Lightweight Charts library to display historical market data from a REST API.

## 🚀 Features

- **Interactive Candlestick Chart**: Real-time visualization of OHLC (Open, High, Low, Close) data
- **Technical Indicators**: Support for SMA (Simple Moving Average) and EMA (Exponential Moving Average) overlays
- **Trade Markers**: Visual LONG/SHORT signals displayed on the chart
- **Modern UI**: Dark theme with glassmorphism effects and smooth animations
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Customizable Parameters**: Adjust symbol, resolution, and date range

## 📋 Prerequisites

- Node.js installed on your system
- A running REST API server (provided in `fetchCandle.js`)

## 🛠️ Setup

### 1. Install Dependencies

```bash
npm install
```

The required packages are:
- `express` - Web server framework
- `cors` - Enable CORS for API requests

### 2. Start the REST API Server

```bash
node fetchCandle.js
```

The server will start on `http://localhost:3000` and provide the following endpoint:

**Endpoint**: `GET /history`

**Query Parameters**:
- `symbol` (required) - Trading symbol (e.g., `NSE:SBIN-EQ`)
- `resolution` (optional, default: 5) - Timeframe in minutes (1, 5, 15, 30, 60, D)
- `date_format` (optional, default: 1) - Date format
- `range_from` (required) - Start date (YYYY-MM-DD)
- `range_to` (required) - End date (YYYY-MM-DD)
- `cont_flag` (optional, default: 1) - Continuation flag

**Example**:
```
http://localhost:3000/history?symbol=NSE:SBIN-EQ&resolution=5&date_format=1&range_from=2025-12-31&range_to=2025-12-31&cont_flag=1
```

### 3. Open the Chart Page

Simply open `index.html` in your web browser:

```bash
# On Windows
start index.html

# On macOS
open index.html

# On Linux
xdg-open index.html
```

Or drag and drop the file into your browser.

## 📊 How It Works

### Data Flow

1. **User Input**: User enters symbol, resolution, and date range in the UI
2. **API Request**: JavaScript fetches data from `http://localhost:3000/history`
3. **Data Transformation**: API response is transformed to TradingView format
4. **Chart Rendering**: TradingView Lightweight Charts renders the candlestick chart
5. **Indicators & Markers**: Optional SMA/EMA lines and trade markers are added

### API Response Format

The Fyers API returns data in the following format:

```json
{
  "s": "ok",
  "candles": [
    [timestamp, open, high, low, close, volume],
    [1735632300, 982.50, 983.00, 982.00, 982.90, 150000],
    ...
  ]
}
```

### TradingView Format

The data is transformed to:

```javascript
[
  {
    time: 1735632300,  // Unix timestamp in seconds
    open: 982.50,
    high: 983.00,
    low: 982.00,
    close: 982.90,
    volume: 150000,
    sma: 983.20,      // Optional
    ema: 982.80,      // Optional
    long: true,       // Optional
    short: false      // Optional
  },
  ...
]
```

### Adding Indicators

To add SMA/EMA indicators, your API should include additional fields in the candle array:

```javascript
// API Response with indicators
{
  "s": "ok",
  "candles": [
    [timestamp, open, high, low, close, volume, sma, ema],
    [1735632300, 982.50, 983.00, 982.00, 982.90, 150000, 983.20, 982.80],
    ...
  ]
}
```

Update the `transformData` function in `index.html` to map these fields:

```javascript
sma: candle[6] ? parseFloat(candle[6]) : undefined,
ema: candle[7] ? parseFloat(candle[7]) : undefined,
```

### Adding Trade Markers

To add LONG/SHORT trade markers, include signal fields:

```javascript
// API Response with trade signals
{
  "s": "ok",
  "candles": [
    [timestamp, open, high, low, close, volume, sma, ema, long, short],
    [1735632300, 982.50, 983.00, 982.00, 982.90, 150000, 983.20, 982.80, 1, 0],
    ...
  ]
}
```

Update the `transformData` function:

```javascript
long: candle[8] ? true : undefined,
short: candle[9] ? true : undefined,
```

## 🎨 Customization

### Chart Colors

Edit the CSS variables in `index.html`:

```css
:root {
    --accent-primary: #6366f1;      /* Primary accent color */
    --accent-secondary: #8b5cf6;    /* Secondary accent color */
    --accent-success: #10b981;      /* Success/Long color */
    --accent-danger: #ef4444;       /* Danger/Short color */
}
```

### Indicator Colors

Modify the line series colors in the `renderChart` function:

```javascript
// SMA - Red line
const smaSeries = chart.addLineSeries({
    color: '#ef4444',
    lineWidth: 2,
    title: 'SMA',
});

// EMA - Green line
const emaSeries = chart.addLineSeries({
    color: '#10b981',
    lineWidth: 2,
    title: 'EMA',
});
```

### Candlestick Colors

```javascript
const candleSeries = chart.addCandlestickSeries({
    upColor: '#10b981',           // Bullish candle color
    downColor: '#ef4444',         // Bearish candle color
    borderUpColor: '#10b981',
    borderDownColor: '#ef4444',
    wickUpColor: '#10b981',
    wickDownColor: '#ef4444',
});
```

## 🔧 Troubleshooting

### Chart Not Loading

1. **Check if the server is running**:
   ```bash
   node fetchCandle.js
   ```
   You should see: `Proxy server running on http://127.0.0.1:3000`

2. **Check browser console** (F12 → Console tab):
   - Look for network errors (CORS, connection refused)
   - Verify API response format

3. **Test API endpoint directly**:
   Open in browser: `http://localhost:3000/history?symbol=NSE:SBIN-EQ&resolution=5&range_from=2025-12-31&range_to=2025-12-31`

### No Data Displayed

- Verify the date range has available data
- Check if the symbol is correct
- Ensure the API token in `fetchCandle.js` is valid

### Library Version Issues

The chart uses TradingView Lightweight Charts v4.1.1 for stability. If you encounter issues:

```html
<!-- Ensure this line in index.html uses version 4.1.1 -->
<script src="https://unpkg.com/lightweight-charts@4.1.1/dist/lightweight-charts.standalone.production.js"></script>
```

## 📖 Documentation

- [TradingView Lightweight Charts Docs](https://tradingview.github.io/lightweight-charts/)
- [Fyers API Documentation](https://myapi.fyers.in/docs/)

## 🎯 Example Usage

1. Start the server:
   ```bash
   node fetchCandle.js
   ```

2. Open `index.html` in your browser

3. The chart will auto-load with default parameters:
   - Symbol: `NSE:SBIN-EQ`
   - Resolution: `5 Minutes`
   - Date: Today's date

4. Customize parameters and click "Load Chart" to refresh

## 📝 File Structure

```
candleChartdecV1/
├── fetchCandle.js       # REST API server
├── index.html           # Chart visualization page
├── package.json         # Node.js dependencies
├── package-lock.json    # Dependency lock file
└── README.md           # This file
```

## 🚀 Next Steps

- Add more technical indicators (RSI, MACD, Bollinger Bands)
- Implement real-time data updates using WebSockets
- Add volume chart below the candlestick chart
- Export chart as image functionality
- Save/load chart configurations

## 📄 License

This project is for educational and personal use.

---

**Happy Trading! 📈**
