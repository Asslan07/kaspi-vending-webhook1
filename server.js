const express = require('express');
const crypto = require('crypto');
const fetch = require('node-fetch');
const app = express();
app.use(express.json());

const MERCHANT_ID = 'ТВОЙ_MERCHANT_ID';  // вставь
const SECRET = 'ТВОЙ_SECRET_KEY';        // вставь
const ESP_IP = '192.168.1.100:80';       // IP твоей ESP32 в локалке

// Создание заказа (эндпоинт для ESP32)
app.get('/create/:amount/:item', async (req, res) => {
  const amount = req.params.amount;
  const item = req.params.item;
  const orderId = Date.now().toString() + '_' + item;

  const orderData = {
    merchantId: MERCHANT_ID,
    amount: Number(amount),
    description: `Напиток ${item}`,
    orderId,
    callbackUrl: `https://${req.get('host')}/webhook?item=${item}`  // авто-URL Render
  };

  const signString = `${MERCHANT_ID}${amount}${orderId}`;
  const signature = crypto.createHmac('sha256', SECRET).update(signString).digest('hex');

  try {
    const response = await fetch('https://api.kaspi.kz/pay/v2/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Auth-Token': signature },
      body: JSON.stringify(orderData)
    });
    const json = await response.json();
    res.json({ qr: json.qrCode, paymentUrl: json.paymentUrl, orderId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Webhook от Kaspi
app.post('/webhook', (req, res) => {
  console.log('Webhook received:', req.body);  // логи в Render dashboard
  const item = req.query.item;
  if (req.body.status === 'PAID') {
    // Пингуем ESP32 (если она в одной сети; иначе используй ngrok на ESP)
    fetch(`http://${ESP_IP}/paid?slot=${item}`).catch(e => console.log('ESP error:', e));
  }
  res.sendStatus(200);
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server on port ${port}`));
