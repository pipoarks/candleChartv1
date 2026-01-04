const symbols = ["BOSCHLTD", "COALINDIA", "TORNTPOWER", "IREDA", "NHPC", "PPLPHARMA", "NATIONALUM", "NTPC", "DABUR", "INOXWIND",
    "PGEL", "PAYTM", "YESBANK", "RECLTD", "PFC", "INDIANB", "SUZLON", "HINDALCO", "IIFL", "VOLTAS", "CHOLAFIN", "SAMMAANCAP", "TATAPOWER",
    "CAMS", "BHEL", "HINDZINC", "UNOMINDA", "GODREJPROP", "TRENT", "SONACOMS", "BLUESTARCO", "TATAELXSI", "KALYANKJIL", "VEDL", "ALKEM", "IRFC", "ASHOKLEY",
    "GAIL", "JIOFIN", "UNIONBANK", "OBEROIRLTY", "NAUKRI", "SBICARD", "GLENMARK", "AUROPHARMA", "TATATECH", "LICHSGFIN", "BAJFINANCE", "MANKIND", "CGPOWER",
    "POWERINDIA", "360ONE", "RBLBANK", "JSWENERGY", "HUDCO", "PHOENIXLTD", "POLYCAB", "HAVELLS", "FORTIS", "HEROMOTOCO", "POWERGRID", "IDEA", "BANKINDIA",
    "MARUTI", "ONGC", "BSE", "SBIN", "CONCOR", "SUPREMEIND", "INDUSTOWER", "BANKBARODA", "TVSMOTOR", "CDSL", "SOLARINDS", "INDUSINDBK", "BEL", "INDHOTEL", "IRCTC",
    "BIOCON", "SBILIFE", "ICICIBANK", "ASTRAL", "MAXHEALTH", "ADANIGREEN", "SYNGENE", "EXIDEIND", "LODHA", "RVNL", "PIIND", "PNBHOUSING", "CROMPTON", "PNB",
    "JINDALSTEL", "M&M", "ADANIENSOL", "HINDUNILVR", "ANGELONE", "RELIANCE", "HDFCBANK", "NMDC", "AMBUJACEM", "PETRONET", "DLF", "DELHIVERY", "TORNTPHARM",
    "LICI", "PRESTIGE", "BDL", "ADANIENT", "ICICIGI", "BHARATFORG", "KAYNES", "MCX", "PATANJALI", "JSWSTEEL", "LTF", "SHREECEM", "DIVISLAB", "TMPV", "ASIANPAINT",
    "BANKNIFTY", "IEX", "TCS", "MAZDOCK", "CIPLA", "NIFTY", "NUVAMA", "INFY", "HDFCLIFE", "WIPRO", "DIXON", "PIDILITIND", "ICICIPRULI", "OFSS", "ADANIPORTS", "ABB", "LT",
    "IOC", "AMBER", "TATASTEEL", "DALBHARAT", "KFINTECH", "NBCC", "HAL", "VBL", "CANBK", "SUNPHARMA", "KPITTECH", "PAGEIND", "IDFCFIRSTB", "HCLTECH", "HDFCAMC",
    "KEI", "OIL", "TECHM", "CUMMINSIND", "FEDERALBNK", "GMRAIRPORT", "APOLLOHOSP", "DRREDDY", "SIEMENS", "ZYDUSLIFE", "BANDHANBNK", "GRASIM", "LUPIN", "ETERNAL",
    "PERSISTENT", "DMART", "SRF", "BAJAJFINSV", "TITAN", "AUBANK", "BPCL", "ULTRACEMCO", "JUBLFOOD", "INDIGO", "UPL", "PREMIERENE", "EICHERMOT", "COLPAL", "MFSL",
    "BHARTIARTL", "ABCAPITAL", "NYKAA", "COFORGE", "LAURUSLABS", "MARICO", "MOTHERSON", "BRITANNIA", "MUTHOOTFIN", "TATACONSUM", "HINDPETRO", "BAJAJ-AUTO",
    "AXISBANK", "GODREJCP", "SAIL", "LTIM", "MPHASIS", "SWIGGY", "SHRIRAMFIN", "MANAPPURAM", "TIINDIA", "KOTAKBANK", "NESTLEIND", "POLICYBZR", "BAJAJHLDNG",
    "UNITDSPR", "APLAPOLLO", "WAAREEENER", "ITC"];

// Map to help convert short tickers back to Fyers format
const tickerMap = {};

function formatSymbol(s) {
    if (s.includes(':')) return s;
    if (s === 'NIFTY') return 'NSE:NIFTY50-INDEX';
    if (s === 'BANKNIFTY') return 'NSE:NIFTYBANK-INDEX';
    if (s === 'FINNIFTY') return 'NSE:FINNIFTY-INDEX';
    return `NSE:${s}-EQ`;
}

// Expose the converter globally for index.html
window.getTechnicalSymbol = function (val) {
    if (!val) return val;
    const upperVal = val.toUpperCase();
    return formatSymbol(upperVal);
};

function populateSymbolDatalist() {
    let datalist = document.getElementById('symbol-list');
    if (!datalist) {
        datalist = document.createElement('datalist');
        datalist.id = 'symbol-list';
        document.body.appendChild(datalist);
    }
    datalist.innerHTML = '';

    symbols.forEach(s => {
        const option = document.createElement('option');
        option.value = s; // Just the symbol name (e.g. SBIN)
        datalist.appendChild(option);
    });

    const symbolInput = document.getElementById('symbol');
    if (symbolInput) {
        symbolInput.setAttribute('list', 'symbol-list');
        symbolInput.setAttribute('autocomplete', 'off');

        // FIX: Ensure dropdown opens on click/focus even with text present
        const showAll = function () {
            const val = this.value;
            this.value = ''; // Temporarily clear to force dropdown to show all
            setTimeout(() => {
                this.value = val;
                this.setSelectionRange(0, val.length); // Select text for easy replacement
            }, 1);
        };

        symbolInput.addEventListener('click', showAll);
        symbolInput.addEventListener('focus', showAll);
    }
}

// Auto-populate on load
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', populateSymbolDatalist);
    } else {
        populateSymbolDatalist();
    }
}
