const express = require('express');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const app = express();

app.use(express.json());

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in environment. See .env.example');
  process.exit(1);
}

if (!VERIFY_TOKEN) {
  console.warn('Warning: VERIFY_TOKEN is not set. Webhook verification will fail until it is provided.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

app.get('/', (req, res) => {
  res.send('hello sj');
});

// Verification for Meta Developer Portal
app.get('/api/webhook', (req, res) => {
  const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
  if (req.query['hub.verify_token'] === VERIFY_TOKEN) {
    return res.send(req.query['hub.challenge']);
  }
  res.send('Error, wrong validation token');
});

app.get('/auth/callback', async (req, res) => {
  const code = req.query.code;

  if (!code) {
    return res.status(400).send('No code received');
  }

  try {
    // Exchange code for access token
    const response = await fetch(`https://graph.facebook.com/v18.0/oauth/access_token?client_id=${process.env.APP_ID}&client_secret=${process.env.APP_SECRET}&redirect_uri=${process.env.REDIRECT_URI}&code=${code}`);

    const data = await response.json();

    console.log('Access Token:', data);

    res.send('Login success');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error getting token');
  }
});

// Handling the Mention
app.post('/api/webhook', async (req, res) => {
  const body = req.body;

  if (body.object === 'instagram') {
    for (const entry of body.entry) {
      const mention = entry.changes?.[0]?.value;
      
      if (mention) {
        // Save share details to Supabase
        await supabase.from('shares').insert([{
          instagram_user_id: mention.user_id,
          media_id: mention.media_id,
          username: mention.username || 'unknown'
        }]);
      }
    }
    return res.status(200).send('OK');
  }
  res.sendStatus(404);
});

module.exports = app;

if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`Server running on port ${port}`));
}

