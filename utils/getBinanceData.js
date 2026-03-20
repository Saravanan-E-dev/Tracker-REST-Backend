import axios from 'axios';
import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

// const apiKey = process.env.BINANCE_API_KEY;
// const apiSecret = process.env.BINANCE_API_SECRET;
const baseURL = 'https://api.binance.com';

// 1. Core function to sign and send ANY request to Binance
const binanceRequest = async (endpoint, method = 'GET', data = {},apiKey,apiSecret) => {
    const timestamp = Date.now();
    
    // Create query string: e.g., timestamp=161234567890
    const queryString = new URLSearchParams({ ...data, timestamp }).toString();
    
    // Create the HMAC SHA256 signature Binance requires
    const signature = crypto
        .createHmac('sha256', apiSecret)
        .update(queryString)
        .digest('hex');

    const url = `${baseURL}${endpoint}?${queryString}&signature=${signature}`;

    const response = await axios({
        method: method,
        url: url,
        headers: { 'X-MBX-APIKEY': apiKey }
    });

    return response.data;
};

export const getBinanceData = async (apiKey, apiSecret) => {
    try {
        // Execute the 3 network calls simultaneously
        const [spotRes, fundingRes, earnRes, priceRes] = await Promise.all([
            binanceRequest('/api/v3/account', 'GET', {}, apiKey, apiSecret),
            binanceRequest('/sapi/v1/asset/get-funding-asset', 'POST', {}, apiKey, apiSecret), // Must be POST
            binanceRequest('/sapi/v1/simple-earn/flexible/position', 'GET', {}, apiKey, apiSecret),
            axios.get('https://api.binance.com/api/v3/ticker/price') // Public endpoint, no signature needed
        ]);

        const allAssets = {};

        const addAsset = (symbol, amount) => {
            const val = parseFloat(amount);
            if (val <= 0) return;
            allAssets[symbol] = (allAssets[symbol] || 0) + val;
        };

        // 1. Process Spot
        if (spotRes.balances) {
            spotRes.balances.forEach(b => addAsset(b.asset, parseFloat(b.free) + parseFloat(b.locked)));
        }

        // 2. Process Funding
        if (Array.isArray(fundingRes)) {
            fundingRes.forEach(b => addAsset(b.asset, parseFloat(b.free) + parseFloat(b.locked) + parseFloat(b.freeze)));
        }

        // 3. Process Simple Earn (Flexible)
        if (earnRes.rows) {
            earnRes.rows.forEach(b => addAsset(b.asset, b.totalAmount));
        }

        // 4. Calculate INR Value
        const prices = priceRes.data;
        const usdtInrRate = 91.0; 

        const portfolio = Object.keys(allAssets).map(symbol => {
            let priceUsdt = symbol === 'USDT' ? 1 : 0;
            if (symbol !== 'USDT') {
                const market = prices.find(p => p.symbol === `${symbol}USDT`);
                priceUsdt = market ? parseFloat(market.price) : 0;
            }

            const totalAmount = allAssets[symbol];
            const valueINR = totalAmount * priceUsdt * usdtInrRate;

            return {
                asset: symbol,
                amount: totalAmount,
                valueINR: parseFloat(valueINR.toFixed(2))
            };
        }).filter(a => a.valueINR > 1); // Filter out dust

        const totalINR = portfolio.reduce((acc, curr) => acc + curr.valueINR, 0).toFixed(2);

        return { totalINR, assets: portfolio };

    } catch (error) {
        // This will give you the exact error message from Binance's servers, not a wrapper crash
        console.error("Binance API Error:", error.response?.data?.msg || error.message);
        throw error;
    }
};