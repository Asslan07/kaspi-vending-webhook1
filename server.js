import express from 'express';
const app = express();
app.use(express.json());

// ─────── НАСТРОЙКИ (замени на свои) ──────
const MERCHANT_ID = 'ТВОЙ_MERCHANT_ID';
const SECRET = 'ТВОЙ_SECRET_KEY';
const ESP_URL = 'http://192.168.1.100/paid'; // или ngrok если не в одной сети
// ─────────────────────────────────────────

app.get('/create/:amount/:item', async (req, res) => {
  const amount = Number(req.params.amount);
  const item = req.params.item;
  const orderId = Date.now() + '_' + item;

  const signString = MERCHANT_ID + amount + orderId;
  const signature = require('crypto')
    .createHmac('sha256', SECRET)
    .update(signString)
    .digest('hex');

  const body = {
    merchantId: MERCHANT_ID,
    amount,
    description: `Напиток ${item}`,
    orderId,
    callbackUrl: `https://${req.get('host')}/webhook?slot=${item}`
  };

  try {
    const kaspiRes = await fetch('https://api.kaspi.kz/pay/v2/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Token': signature
      },
      body: JSON.stringify(body)
    });
    const data = await kaspiRes.json();
    res.json({ qr: data.qrCode, paymentUrl: data.paymentUrl });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/webhook', async (req, res) => {
  console.log('Webhook:', req.body);
  if (req.body.status === 'PAID') {
    const slot = req.query.slot || '1';
    try {
      await fetch(`${ESP_URL}?slot=${slot}`);
      console.log('Напиток выдан, слот:', slot);
    } catch (e) { console.log('ESP не отвечает'); }
  }
  res.sendStatus(200);
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log('Сервер живой на порту', port));
