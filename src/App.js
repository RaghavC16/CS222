// src/App.js

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Line } from 'react-chartjs-2';
import './App.css';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const BACKEND_URL = 'http://localhost:5000';

function App() {
  const [ticker, setTicker] = useState('');
  const [chartData, setChartData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedIndicators, setSelectedIndicators] = useState({
    RSI: false,
    MACD: false,
    EMA: false,
    FibonacciRetracement: false
  });
  const [portfolio, setPortfolio] = useState({
    cash: 10000,
    holdings: {},  // { ticker: { shares: number, avgPrice: number } }
    transactions: [] // [{date, ticker, type, shares, price, total}]
  });
  const [currentPrice, setCurrentPrice] = useState(null);
  const [predictions, setPredictions] = useState(null);
  const [predictionDays, setPredictionDays] = useState(7);
  const [predictionMethod, setPredictionMethod] = useState('');

  const RAPIDAPI_KEY = 'aa87af2387msh13d8c03c55e74b3p1f0f68jsn31c19f01f043';
  const RAPIDAPI_HOST = 'yahoo-finance166.p.rapidapi.com';

  const handleIndicatorChange = (indicator) => {
    setSelectedIndicators(prev => ({
      ...prev,
      [indicator]: !prev[indicator]
    }));
  };

  const handleFetch = async () => {
    setError('');
    setChartData(null);
    setLoading(true);

    if (!ticker.trim()) {
      setError('Please enter a stock ticker symbol.');
      setLoading(false);
      return;
    }

    try {
      // First get historical data
      const historicalResponse = await axios.get(`https://${RAPIDAPI_HOST}/api/stock/get-chart`, {
        params: {
          symbol: ticker.trim().toUpperCase(),
          region: 'US',
          range: '1y',
          interval: '1d',
        },
        headers: {
          'X-RapidAPI-Key': RAPIDAPI_KEY,
          'X-RapidAPI-Host': RAPIDAPI_HOST,
        },
      });

      if (!historicalResponse.data?.chart?.result) {
        setError('No data found for the provided ticker symbol.');
        setLoading(false);
        return;
      }

      // Show loading message for predictions
      setError('Running prediction model... This may take a few minutes.');

      // Get predictions from backend with timeout
      const predictionsResponse = await axios.post(`${BACKEND_URL}/predict`, {
        ticker: ticker.trim().toUpperCase(),
        days: predictionDays,
        method: predictionMethod
      }, {
        timeout: 300000, // 5 minute timeout
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (!predictionsResponse.data.success) {
        throw new Error(predictionsResponse.data.error || 'Prediction failed');
      }

      // Clear the loading message
      setError('');

      const result = historicalResponse.data.chart.result[0];
      const timestamps = result.timestamp;
      const closePrices = result.indicators.quote[0].close;
      const chartLabels = timestamps.map(ts => new Date(ts * 1000).toLocaleDateString());
      const chartPrices = closePrices.map(price => price ?? 0);

      // Add prediction dates and data to the chart
      const predictions = predictionsResponse.data.predictions;
      const predictionDates = predictionsResponse.data.dates;

      console.log('Predicted Values:', predictions); // Log predictions for verification

      setChartData({
        labels: [...chartLabels, ...predictionDates],
        datasets: [
          {
            label: `${ticker.toUpperCase()} Historical Prices`,
            data: [...chartPrices, ...new Array(predictionDays).fill(null)],
            fill: false,
            borderColor: '#2196F3',
            backgroundColor: '#2196F3',
          },
          {
            label: `${ticker.toUpperCase()} Predicted Prices`,
            data: [...new Array(chartLabels.length).fill(null), ...predictions.median],
            fill: false,
            borderColor: '#4CAF50',
            backgroundColor: '#4CAF50',
            borderDash: [5, 5],
          },
          {
            label: 'Prediction Range',
            data: [...new Array(chartLabels.length).fill(null), ...predictions.upper],
            fill: '+1',
            borderColor: 'rgba(76, 175, 80, 0.3)',
            backgroundColor: 'rgba(76, 175, 80, 0.1)',
          },
          {
            data: [...new Array(chartLabels.length).fill(null), ...predictions.lower],
            fill: false,
            borderColor: 'rgba(76, 175, 80, 0.3)',
            showLine: true,
          }
        ]
      });
    } catch (err) {
      if (err.code === 'ECONNREFUSED') {
        setError('Cannot connect to prediction server. Please ensure the backend is running.');
      } else if (err.code === 'ETIMEDOUT') {
        setError('Prediction request timed out. Please try again.');
      } else {
        setError(`Error: ${err.message || 'Failed to fetch data. Please try again.'}`);
      }
      console.error('Detailed error:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateCurrentPrice = async (tickerSymbol) => {
    try {
      const response = await axios.get(`https://${RAPIDAPI_HOST}/api/stock/get-chart`, {
        params: {
          symbol: tickerSymbol.trim().toUpperCase(),
          region: 'US',
          interval: '1d',
          range: '1d'
        },
        headers: {
          'X-RapidAPI-Key': RAPIDAPI_KEY,
          'X-RapidAPI-Host': RAPIDAPI_HOST,
        },
      });

      const result = response.data.chart.result[0];
      const latestPrice = result.indicators.quote[0].close.slice(-1)[0];
      setCurrentPrice(latestPrice);
    } catch (err) {
      console.error('Error fetching current price:', err);
      setError('Unable to fetch current price');
    }
  };

  const handleTransaction = (type, shares) => {
    if (!currentPrice || !ticker) return;
    
    const total = currentPrice * shares;
    
    if (type === 'BUY') {
      if (total > portfolio.cash) {
        setError('Insufficient funds');
        return;
      }
      
      setPortfolio(prev => {
        const holding = prev.holdings[ticker] || { shares: 0, avgPrice: 0 };
        const newTotalShares = holding.shares + shares;
        const newAvgPrice = ((holding.shares * holding.avgPrice) + (shares * currentPrice)) / newTotalShares;
        
        return {
          cash: prev.cash - total,
          holdings: {
            ...prev.holdings,
            [ticker]: { shares: newTotalShares, avgPrice: newAvgPrice }
          },
          transactions: [...prev.transactions, {
            date: new Date().toISOString(),
            ticker,
            type,
            shares,
            price: currentPrice,
            total
          }]
        };
      });
    } else if (type === 'SELL') {
      const holding = portfolio.holdings[ticker];
      if (!holding || holding.shares < shares) {
        setError('Insufficient shares');
        return;
      }
      
      setPortfolio(prev => {
        const newShares = holding.shares - shares;
        const newHoldings = { ...prev.holdings };
        
        if (newShares === 0) {
          delete newHoldings[ticker];
        } else {
          newHoldings[ticker] = { ...holding, shares: newShares };
        }
        
        return {
          cash: prev.cash + total,
          holdings: newHoldings,
          transactions: [...prev.transactions, {
            date: new Date().toISOString(),
            ticker,
            type,
            shares,
            price: currentPrice,
            total
          }]
        };
      });
    }
  };

  useEffect(() => {
    if (ticker) {
      updateCurrentPrice(ticker);
    }
  }, [ticker]);

  return (
    <div className="modern-app">
      <h1>Stock Analysis App</h1>
      
      <div className="analysis-container">
        <div className="input-section">
          <div className="ticker-input">
            <label>Stock Ticker*</label>
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              placeholder="AAPL"
            />
          </div>

          <div className="indicators">
            <label className="checkbox-container">
              <input
                type="checkbox"
                checked={selectedIndicators.RSI}
                onChange={() => handleIndicatorChange('RSI')}
              />
              <span className="checkmark"></span>
              RSI
            </label>

            <label className="checkbox-container">
              <input
                type="checkbox"
                checked={selectedIndicators.MACD}
                onChange={() => handleIndicatorChange('MACD')}
              />
              <span className="checkmark"></span>
              MACD
            </label>

            <label className="checkbox-container">
              <input
                type="checkbox"
                checked={selectedIndicators.EMA}
                onChange={() => handleIndicatorChange('EMA')}
              />
              <span className="checkmark"></span>
              EMA
            </label>

            <label className="checkbox-container">
              <input
                type="checkbox"
                checked={selectedIndicators.FibonacciRetracement}
                onChange={() => handleIndicatorChange('FibonacciRetracement')}
              />
              <span className="checkmark"></span>
              Fibonacci Retracement
            </label>
          </div>

          <div className="prediction-method">
            <label>Prediction Method</label>
            <select 
              value={predictionMethod}
              onChange={(e) => setPredictionMethod(e.target.value)}
            >
              <option value="">Select Method</option>
              <option value="RSI">RSI</option>
              <option value="MACD">MACD</option>
              <option value="FibonacciRetracement">Fibonacci Retracement</option>
            </select>
          </div>

          <button 
            className="analyze-button" 
            onClick={handleFetch}
            disabled={loading}
          >
            {loading ? 'ANALYZING...' : 'ANALYZE'}
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}
        
        {chartData && (
          <div className="chart-section">
            <Line
              data={chartData}
              options={{
                responsive: true,
                plugins: {
                  legend: {
                    position: 'top',
                  },
                  title: {
                    display: true,
                    text: `${ticker.toUpperCase()} Analysis`,
                  },
                },
              }}
            />
          </div>
        )}

        {chartData && currentPrice && (
          <div className="trading-section">
            <div className="current-price">
              Current Price: ${currentPrice.toFixed(2)}
            </div>
            <div className="trading-controls">
              <div className="trade-input">
                <input
                  type="number"
                  min="1"
                  placeholder="Number of shares"
                  id="shareAmount"
                />
              </div>
              <div className="trade-buttons">
                <button 
                  className="buy-button"
                  onClick={() => handleTransaction('BUY', Number(document.getElementById('shareAmount').value))}
                >
                  Buy
                </button>
                <button 
                  className="sell-button"
                  onClick={() => handleTransaction('SELL', Number(document.getElementById('shareAmount').value))}
                >
                  Sell
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="portfolio-section">
          <h2>Portfolio</h2>
          <div className="portfolio-summary">
            <div className="cash-balance">
              Cash Balance: ${portfolio.cash.toFixed(2)}
            </div>
            <div className="holdings">
              <h3>Holdings</h3>
              {Object.entries(portfolio.holdings).map(([symbol, data]) => (
                <div key={symbol} className="holding-item">
                  <span className="symbol">{symbol}</span>
                  <span className="shares">{data.shares} shares</span>
                  <span className="avg-price">Avg Price: ${data.avgPrice.toFixed(2)}</span>
                  <span className="total-value">
                    Total: ${(data.shares * data.avgPrice).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="transaction-history">
            <h3>Transaction History</h3>
            <div className="transactions-list">
              {portfolio.transactions.map((transaction, index) => (
                <div key={index} className="transaction-item">
                  <span className="date">
                    {new Date(transaction.date).toLocaleDateString()}
                  </span>
                  <span className={`type ${transaction.type.toLowerCase()}`}>
                    {transaction.type}
                  </span>
                  <span className="details">
                    {transaction.shares} {transaction.ticker} @ ${transaction.price.toFixed(2)}
                  </span>
                  <span className="total">
                    ${transaction.total.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
