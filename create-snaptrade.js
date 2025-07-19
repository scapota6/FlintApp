// Temporary script to create fresh SnapTrade account for current user
import fetch from 'node-fetch';

async function createSnapTradeAccount() {
  try {
    const response = await fetch('http://localhost:5000/api/snaptrade/create-fresh-account', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    const result = await response.text();
    console.log('Response status:', response.status);
    console.log('Response:', result);
  } catch (error) {
    console.error('Error:', error);
  }
}

createSnapTradeAccount();