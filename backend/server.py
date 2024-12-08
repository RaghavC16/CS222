from flask import Flask, request, jsonify
from flask_cors import CORS
import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta
import sys
import os

# Add the project root directory to Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from stock_anal import download_data, preprocess_data, add_technical_indicators, prepare_dataset, train_and_predict
import logging

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.get_json()
        if not data:
            logger.error("No JSON data received")
            return jsonify({'success': False, 'error': 'No data provided'}), 400

        ticker = data.get('ticker')
        if not ticker:
            logger.error("No ticker symbol provided")
            return jsonify({'success': False, 'error': 'Ticker symbol is required'}), 400

        try:
            days = int(data.get('days', 7))
            if days <= 0 or days > 365:
                raise ValueError("Days must be between 1 and 365")
        except ValueError as e:
            logger.error(f"Invalid days parameter: {str(e)}")
            return jsonify({'success': False, 'error': str(e)}), 400

        method = data.get('method', 'RSI')
        supported_methods = ['RSI']
        if method not in supported_methods:
            logger.error(f"Unsupported method: {method}")
            return jsonify({'success': False, 'error': f'Unsupported method. Must be one of: {supported_methods}'}), 400
        
        logger.info(f"Starting prediction for {ticker} for {days} days using {method}")
        
        stock_data = download_data(ticker)
        processed_data = preprocess_data(stock_data)
        data_with_indicators = add_technical_indicators(processed_data)
        dataset = prepare_dataset(data_with_indicators, [method])
        predictions = train_and_predict(dataset, days)
        
        return jsonify({
            'success': True,
            'predictions': predictions,
            'dates': [(stock_data['Date'].iloc[-1] + pd.Timedelta(days=i+1)).strftime('%Y-%m-%d') 
                     for i in range(days)]
        })
    except Exception as e:
        logger.error(f"Error during prediction: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True) 