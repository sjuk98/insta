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

// Privacy Policy page required by Meta
app.get('/privacy', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Privacy Policy - Insta Tracker</title>
        <style>
          body { font-family: sans-serif; line-height: 1.6; padding: 20px; max-width: 800px; margin: auto; }
          h1 { color: #333; }
        </style>
      </head>
      <body>
        <h1>Privacy Policy</h1>
        <p>Last Updated: March 2024</p>
        <p>This Privacy Policy describes how we collect, use, and handle your information when you use our Instagram Tracker service.</p>
        
        <h2>Information We Collect</h2>
        <p>When you authorize our app via Instagram, we may collect the following information:</p>
        <ul>
          <li>Instagram User ID and Username</li>
          <li>Media IDs of posts or stories where you mention our connected accounts</li>
          <li>Basic profile information provided by the Instagram Basic Display API</li>
        </ul>

        <h2>How We Use Your Information</h2>
        <p>We use the collected information solely to:</p>
        <ul>
          <li>Track and display mentions in our dashboard</li>
          <li>Provide insights into story engagement</li>
        </ul>

        <h2>Data Security and Retrieval</h2>
        <p>We do not sell your data to third parties. We use Supabase to securely store the mentioned data.</p>

        <h2>Data Deletion</h2>
        <p>If you wish to delete your data from our system, please contact us at <strong>[Your Contact Email]</strong> or disconnect our app from your Instagram settings.</p>

        <h2>Contact Us</h2>
        <p>If you have any questions about this Privacy Policy, please contact us.</p>
      </body>
    </html>
  `);
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

    if (!appId || !appSecret || !redirectUri) {
      console.error('Missing Meta App configuration:', { 
        hasAppId: !!appId, 
        hasAppSecret: !!appSecret, 
        hasRedirectUri: !!redirectUri 
      });
      return res.status(500).send(`Configuration Error: Please ensure APP_ID, APP_SECRET, and REDIRECT_URI are set in Vercel settings.`);
    }

    // Exchange code for access token
    const url = `https://graph.facebook.com/v18.0/oauth/access_token?client_id=${encodeURIComponent(appId)}&client_secret=${encodeURIComponent(appSecret)}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${encodeURIComponent(code)}`;
    
    console.log('Exchanging code for token...',url);
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
  const port = process.env.PORT || 3004;
  app.listen(port, () => console.log(`Server running on port ${port}`));
}

