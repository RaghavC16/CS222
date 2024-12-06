import yfinance as yf
import pandas as pd
import numpy as np
from pytorch_forecasting import TimeSeriesDataSet, TemporalFusionTransformer
from pytorch_lightning import Trainer
from pytorch_forecasting.metrics import QuantileLoss
import ta
import matplotlib.pyplot as plt
from pandas.tseries.offsets import BDay
import warnings

warnings.filterwarnings("ignore")


def download_data(ticker):
    print(f"Downloading stock data for {ticker}...")
    data = yf.download(ticker)
    
    data.columns = [f"{col[0]}_{col[1]}" if isinstance(col, tuple) else col for col in data.columns]
    data.reset_index(inplace=True)
    
    data.rename(columns={f"Adj Close_{ticker}": "Adj Close"}, inplace=True)
    
    print("Downloaded data preview:")
    print(data.head())
    return data


def preprocess_data(data):
    print("Processing data...")
    if "Adj Close" not in data.columns:
        raise KeyError("'Adj Close' column is missing in the dataset.")
    
    data["time_idx"] = np.arange(len(data))
    data["group"] = "0"  
    data["target"] = data["Adj Close"]
    data["Returns"] = data["Adj Close"].pct_change().fillna(0)
    data["Trend_Slope"] = data["Returns"].rolling(window=10).mean().fillna(0)
    
    print("Processed data preview:")
    print(data.head())
    return data


def add_technical_indicators(data):
    print("Adding technical indicators...")
    
    adj_close_col = "Adj Close"  
    volume_col = None  
    
    for col in data.columns:
        if "Volume" in col:
            volume_col = col
            break
    
    if adj_close_col not in data.columns or volume_col is None:
        raise KeyError("Required columns for indicators are missing (e.g., 'Adj Close', 'Volume').")

    # Add RSI
    data["RSI"] = ta.momentum.RSIIndicator(data[adj_close_col], window=14).rsi()

    # Add MACD
    macd = ta.trend.MACD(data[adj_close_col])
    data["MACD"] = macd.macd()
    data["MACD_Signal"] = macd.macd_signal()
    data["MACD_Diff"] = macd.macd_diff()

    # Add EMA
    data["EMA_20"] = ta.trend.EMAIndicator(data[adj_close_col], window=20).ema_indicator()
    data["EMA_50"] = ta.trend.EMAIndicator(data[adj_close_col], window=50).ema_indicator()

    # Add Bollinger Bands
    bb = ta.volatility.BollingerBands(data[adj_close_col])
    data["BB_High"] = bb.bollinger_hband()
    data["BB_Low"] = bb.bollinger_lband()

    for col in ["RSI", "MACD", "MACD_Signal", "MACD_Diff", "EMA_20", "EMA_50", "BB_High", "BB_Low"]:
        if col in data.columns:
            data[col] = data[col].fillna(method="ffill").fillna(method="bfill").fillna(0)

    print("Technical indicators added.")
    return data


def get_user_indicators():
    print("Available indicators: RSI, MACD, EMA_20, EMA_50, BB_High, BB_Low")
    user_input = input("Enter the indicators you want to include (comma-separated): ").strip()
    indicators = [ind.strip() for ind in user_input.split(",")]
    return indicators


def prepare_dataset(data, indicators):
    valid_indicators = [col for col in indicators if col in data.columns]

    dataset = TimeSeriesDataSet(
        data,
        time_idx="time_idx",
        target="target",
        group_ids=["group"],
        max_encoder_length=60,
        max_prediction_length=20,
        static_categoricals=["group"],
        time_varying_known_reals=["time_idx"],
        time_varying_unknown_reals=["Adj Close", "target", "Returns", "Trend_Slope"] + valid_indicators,
    )
    return dataset


def train_model(dataset):
    dataloader = dataset.to_dataloader(train=True, batch_size=64)

    quantiles = [0.1, 0.5, 0.9]

    tft = TemporalFusionTransformer.from_dataset(
        dataset,
        learning_rate=0.03,
        hidden_size=8,
        attention_head_size=1,
        dropout=0.1,
        hidden_continuous_size=8,
        output_size=len(quantiles),  
        loss=QuantileLoss(quantiles=quantiles), 
    )

    print(f"Model size: {tft.size() / 1e3:.1f}k parameters")

    trainer = Trainer(max_epochs=5, gradient_clip_val=0.1)
    trainer.fit(tft, train_dataloaders=dataloader)
    return tft


def predict_future(tft, dataset, days_to_predict):
    raw_predictions, x = tft.predict(dataset, mode="raw", return_x=True)
    predictions = raw_predictions[0][-days_to_predict:]  
    print(f"Predictions for the next {days_to_predict} days:")
    print(predictions)
    return predictions


def plot_predictions(data, predictions, days_to_predict):
    print("Predictions shape:", predictions.shape)
    
    if predictions.shape[0] != days_to_predict:
        predictions = predictions[-days_to_predict:]

    median_predictions = predictions[:, :, 1].mean(axis=1)
    lower_predictions = predictions[:, :, 0].mean(axis=1)
    upper_predictions = predictions[:, :, 2].mean(axis=1)

    last_known_date = pd.to_datetime(data["Date"].iloc[-1])
    predicted_dates = [last_known_date + i * BDay() for i in range(1, days_to_predict + 1)]

    print("Predicted dates length:", len(predicted_dates))
    print("Median predictions length:", len(median_predictions))

    plt.figure(figsize=(14, 7))
    plt.plot(data["Date"], data["Adj Close"], label="Historical Data", color="blue")

    if len(predicted_dates) == len(median_predictions):
        plt.plot(predicted_dates, median_predictions, label="Predicted Median (50th Percentile)", color="orange")
        plt.fill_between(predicted_dates, lower_predictions, upper_predictions, color="orange", alpha=0.3, label="Prediction Range (10th-90th Percentile)")
    else:
        print("Warning: Predicted dates and predictions do not align. Skipping predicted plot.")

    plt.title("Stock Price Prediction")
    plt.xlabel("Date")
    plt.ylabel("Price")
    plt.legend()
    plt.grid(True)
    plt.show()


def main():
    ticker = input("Enter the stock ticker symbol (e.g., AAPL): ").strip()
    days_to_predict = int(input("Enter the number of days to predict: ").strip())

    data = download_data(ticker)

    data = preprocess_data(data)

    data = add_technical_indicators(data)

    selected_indicators = get_user_indicators()

    dataset = prepare_dataset(data, selected_indicators)

    tft = train_model(dataset)

    predictions = predict_future(tft, dataset, days_to_predict)

    plot_predictions(data, predictions, days_to_predict)


if __name__ == "__main__":
    main()