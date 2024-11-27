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

function App() {
  const [ticker, setTicker] = useState('');
  const [chartData, setChartData] = useState(null);
  const [rawData, setRawData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);


  const [decision, setDecision] = useState(null);


  const [darkMode, setDarkMode] = useState(false);

  const RAPIDAPI_KEY = 'aa87af2387msh13d8c03c55e74b3p1f0f68jsn31c19f01f043'
  const RAPIDAPI_HOST = 'yahoo-finance166.p.rapidapi.com'


  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [darkMode]);

  const handleFetch = async () => {
    setError('');
    setChartData(null);
    setRawData(null);
    setDecision(null);
    setLoading(true);


    if (!ticker.trim()) {
      setError('Please enter a stock ticker symbol.');
      setLoading(false);
      return;
    }

    const url = `https://${RAPIDAPI_HOST}/api/stock/get-chart`;

    try {
      const response = await axios.get(url, {
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

      console.log('API Response:', response.data); 

      if (!response.data || !response.data.chart || !response.data.chart.result) {
        setError('No data found for the provided ticker symbol.');
        setLoading(false);
        return;
      }

      const result = response.data.chart.result[0];
      const timestamps = result.timestamp;
      const closePrices = result.indicators.quote[0].close;

      if (!timestamps || !closePrices || timestamps.length !== closePrices.length) {
        setError('Incomplete data received from the API.');
        setLoading(false);
        return;
      }


      const chartLabels = timestamps.map((ts) => {
        const date = new Date(ts * 1000);
        return date.toLocaleDateString();
      });

      const chartPrices = closePrices.map((price) => (price !== null ? price : 0));

      setChartData({
        labels: chartLabels,
        datasets: [
          {
            label: `${ticker.trim().toUpperCase()} Closing Prices`,
            data: chartPrices,
            fill: false,
            backgroundColor: 'rgba(75,192,192,0.4)',
            borderColor: 'rgba(75,192,192,1)',
          },
        ],
      });
    } catch (err) {
      console.error('Error fetching data:', err);
      if (err.response) {

        setError(
          `Error: ${err.response.status} - ${err.response.data.message || 'Unable to fetch data.'}`
        );
      } else if (err.request) {

        setError('No response received from the server. Please try again later.');
      } else {
        // Something else happened
        setError('An unexpected error occurred.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateDecision = () => {
    // Random for now, get data from Simon
    const decisions = ['Buy', 'Sell'];
    const randomDecision = decisions[Math.floor(Math.random() * decisions.length)];
    setDecision(randomDecision);
  };

  return (
    <div className="App">
      <button className="toggle-button" onClick={toggleDarkMode}>
        {darkMode ? '🌞 Light Mode' : '🌙 Dark Mode'}
      </button>

      <h1>Stock Price Chart</h1>
      <div className="form-container">
        <input
          type="text"
          value={ticker}
          onChange={(e) => setTicker(e.target.value)}
          placeholder="Enter Stock Ticker (e.g., AAPL)"
        />
        <button onClick={handleFetch} disabled={loading}>
          {loading ? 'Loading...' : 'Get Chart'}
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      {rawData && (
        <div className="raw-data">
          <h2>Raw API Response:</h2>
          <pre>{JSON.stringify(rawData, null, 2)}</pre>
        </div>
      )}
      {chartData && (
        <div className="chart-container">
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
                  text: `${ticker.trim().toUpperCase()} Stock Closing Prices (Last Year)`,
                },
              },
              scales: {
                x: {
                  display: true,
                  title: {
                    display: true,
                    text: 'Date',
                  },
                },
                y: {
                  display: true,
                  title: {
                    display: true,
                    text: 'Price (USD)',
                  },
                },
              },
            }}
          />
          <button className="decision-button" onClick={handleGenerateDecision}>
            Generate Decision
          </button>
          {decision && (
            <p className={`decision ${decision === 'Buy' ? 'buy' : 'sell'}`}>
              {decision}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
