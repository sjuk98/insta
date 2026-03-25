const express = require('express');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const app = express();

app.use(express.json());

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in environment.');
  // Do not process.exit(1) on Vercel as it crashes the function
}

if (!VERIFY_TOKEN) {
  console.warn('Warning: VERIFY_TOKEN is not set. Webhook verification will fail.');
}

const supabase = (SUPABASE_URL && SUPABASE_SERVICE_KEY) 
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY) 
  : null;

app.get('/', (req, res) => {
  res.send('hello sj');
});

// Verification for Meta Developer Portal
app.get('/api/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Webhook verified');
    return res.status(200).send(challenge);
  }
  
  console.error('Webhook verification failed: token mismatch');
  res.status(403).send('Forbidden');
});

app.get('/auth/callback', async (req, res) => {
  const code = req.query.code;

  if (!code) {
    return res.status(400).send('No code received');
  }

  try {
    const appId = (process.env.APP_ID || '').trim();
    const appSecret = (process.env.APP_SECRET || '').trim();
    const redirectUri = (process.env.REDIRECT_URI || '').trim();

    // Exchange code for access token
    const url = `https://graph.facebook.com/v18.0/oauth/access_token?client_id=${encodeURIComponent(appId)}&client_secret=${encodeURIComponent(appSecret)}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${encodeURIComponent(code)}`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      console.error('Token exchange error:', data);
      return res.status(400).send(`Error getting token: ${data.error?.message || 'Unknown error'}`);
    }

    console.log('Access Token:', data);
    res.send('Login success');
  } catch (err) {
    console.error('Auth callback error:', err);
    res.status(500).send('Error getting token');
  }
});

// Handling the Mention
app.post('/api/webhook', async (req, res) => {
  const body = req.body;

  if (body.object === 'instagram') {
    try {
      for (const entry of body.entry) {
        if (!entry.changes) continue;
        
        for (const change of entry.changes) {
          if (change.field === 'mentions') {
            const mention = change.value;
            
            // Save share details to Supabase if client is initialized
            if (supabase) {
              const { error } = await supabase.from('shares').insert([{
                instagram_user_id: mention.user_id || entry.id,
                media_id: mention.media_id,
                username: mention.username || 'unknown'
              }]);

              if (error) {
                console.error('Error inserting into Supabase:', error);
              } else {
                console.log('Mention saved to Supabase');
              }
            } else {
              console.warn('Supabase not initialized, skipping insertion');
            }
          }
        }
      }
      return res.status(200).send('OK');
    } catch (err) {
      console.error('Error processing webhook:', err);
      return res.status(500).send('Error');
    }
  }
  res.sendStatus(404);
});

module.exports = app;

if (require.main === module) {
  const port = process.env.PORT || 3003;
  app.listen(port, () => console.log(`Server running on port ${port}`));
}

