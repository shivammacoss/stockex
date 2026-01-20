import express from 'express';
import axios from 'axios';

const router = express.Router();

// Cache for exchange rate
let cachedRate = {
  rate: 83.50,
  lastUpdated: null
};

// Get USD/INR exchange rate
router.get('/usdinr', async (req, res) => {
  try {
    // Check if cache is still valid (5 minutes)
    const now = Date.now();
    if (cachedRate.lastUpdated && (now - cachedRate.lastUpdated) < 300000) {
      return res.json({ rate: cachedRate.rate, cached: true });
    }

    // Try to fetch from a free API
    try {
      const response = await axios.get('https://api.exchangerate-api.com/v4/latest/USD', {
        timeout: 5000
      });
      if (response.data?.rates?.INR) {
        cachedRate.rate = response.data.rates.INR;
        cachedRate.lastUpdated = now;
      }
    } catch (apiError) {
      // If API fails, use cached/default rate
      console.log('Exchange rate API unavailable, using cached rate');
    }

    res.json({ rate: cachedRate.rate, cached: !cachedRate.lastUpdated });
  } catch (error) {
    res.json({ rate: 83.50, error: true });
  }
});

export default router;
