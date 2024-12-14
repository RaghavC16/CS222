# Introduction


We built an app that lets users predict the stock price of a stock they input over a specified time span
- The web app takes in user input of a stock ticker symbol
- Runs the stock through our models
- Gets the output of the stock price and sends to the frontend
- Data is displayed in a list and graphical format


# Technical Architecture

![image](https://github.com/user-attachments/assets/4d0e75c4-b82c-42aa-9802-71b1a3f0a912)

Core Libraries and Tools:

React: JavaScript library for building user interfaces.
Webpack: Module bundler that handles asset compilation and hot module reloading.
Pytorch
TFT Models


# Developers

- **Simon Anari**: Machine Learning Models
- **Srihan Gullapalli**: Backend and Frontend 
- **Raghav Chandrashekar**: Frontend
- **Arjit Bose**: Backend

# Create EV



```
python3 -m venv ./venv
```




```
venv/Scripts/activate/
```

# Development

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

### `uvicorn app.main:app --reload` 
Run it in the app folder\
Runs the model to allow the frontend to fetch the correct data
