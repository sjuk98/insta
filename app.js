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
  res.send('hello');
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

// Data Deletion Instructions page required by Meta
app.get('/delete-instructions', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Data Deletion Instructions - Insta Tracker</title>
        <style>
          body { font-family: sans-serif; line-height: 1.6; padding: 20px; max-width: 800px; margin: auto; }
          h1 { color: #333; }
        </style>
      </head>
      <body>
        <h1>Data Deletion Instructions</h1>
        <p>If you would like to delete your activity data for current app, you can do so by following these steps:</p>
        <ol>
          <li>Go to your Facebook Profile's "Settings & Privacy" menu. Click "Settings".</li>
          <li>Look for "Apps and Websites" and you will see all of the apps and websites you have linked with your Facebook account.</li>
          <li>Search and click "Insta Tracker" in the search bar.</li>
          <li>Scroll and click "Remove".</li>
          <li>Congratulations, you have successfully removed your app activities and data.</li>
        </ol>
        <p>Alternatively, you can email us at <strong>[Your Contact Email]</strong> to request full data removal from our database.</p>
      </body>
    </html>
  `);
});

// Verification for Meta Developer Portal
app.get('/api/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && (token || '').trim() === (VERIFY_TOKEN || '').trim()) {
    console.log('Webhook verified');
    return res.status(200).send(challenge);
  }
  
  console.error(`Webhook verification failed. Expected: ${(VERIFY_TOKEN || '').trim()}, Received: ${(token || '').trim()}`);
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
      console.error('Missing configuration:', { hasAppId: !!appId, hasAppSecret: !!appSecret, hasRedirectUri: !!redirectUri });
      return res.status(500).send(`Configuration Error: Ensure APP_ID, APP_SECRET, and REDIRECT_URI are set.`);
    }

    console.log('Exchanging Instagram Code for Token...');

    // This specific code from instagram.com requires a POST request with form-data
    const params = new URLSearchParams();
    params.append('client_id', appId);
    params.append('client_secret', appSecret);
    params.append('grant_type', 'authorization_code');
    params.append('redirect_uri', redirectUri);
    params.append('code', code);

    const response = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      body: params,
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Instagram Exchange Error:', data);
      return res.status(400).send(`Error getting token: ${data.error_message || 'Check your Instagram App Settings.'}`);
    }

    console.log('Access Token obtained:', data.access_token);
    res.json({
        message: 'Login success!',
        user_id: data.user_id,
        access_token: data.access_token,
        note: 'Note: This token is for Basic Display and may not support all tracking features.'
    });
  } catch (err) {
    console.error('Exchange Process Error:', err);
    res.status(500).send('Internal server error during exchange.');
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
            
            // Log the mention for monitoring
            console.log('New mention received!', mention);
            
            // Save mention details to Supabase shares table
            if (supabase) {
              const { error } = await supabase.from('shares').insert([{
                instagram_user_id: mention.user_id || entry.id,
                media_id: mention.media_id,
                username: mention.username || 'unknown',
                processed_at: new Date().toISOString()
              }]);

              if (error) {
                console.error('Error storing share in Supabase:', error);
              } else {
                console.log(`Success! Tracked mention in Supabase for user: ${mention.username || 'unknown'}`);
              }
            } else {
              console.warn('Supabase not initialized, mention not saved.');
            }
          }
        }
      }
      return res.status(200).send('OK');
    } catch (err) {
      console.error('Error processing mention webhook:', err);
      return res.status(500).send('Error');
    }
  }
  res.sendStatus(404);
});

// Data Deletion Callback required by Meta
app.post('/api/deletion', async (req, res) => {
  const signedRequest = req.body.signed_request;

  if (!signedRequest) {
    return res.status(400).send('No signed request received');
  }

  try {
    const appSecret = (process.env.APP_SECRET || '').trim();
    if (!appSecret) {
      console.error('Missing APP_SECRET for deletion callback');
      return res.status(500).send('Internal server error');
    }

    // Decode the signed request from Meta
    const crypto = require('crypto');
    const [encodedSig, payload] = signedRequest.split('.');
    const data = JSON.parse(Buffer.from(payload, 'base64').toString());

    // Verify the signature
    const sig = Buffer.from(encodedSig, 'base64').toString('hex');
    const expectedSig = crypto.createHmac('sha256', appSecret).update(payload).digest('hex');

    if (sig !== expectedSig) {
      console.error('Deletion request signature mismatch');
      return res.status(403).send('Invalid signature');
    }

    console.log(`Data deletion requested for User ID: ${data.user_id}`);
    
    // In a real app, you would delete the user's data from Supabase here
    // Example: await supabase.from('shares').delete().eq('instagram_user_id', data.user_id);

    // Return the response Meta expects
    res.json({
      url: 'https://hookhit.com/privacy', // Confirmation URL
      confirmation_code: `DEL-${data.user_id}-${Date.now()}` // Tracking ticket ID
    });
  } catch (err) {
    console.error('Error processing deletion callback:', err);
    res.status(500).send('An error occurred during data deletion.');
  }
});

module.exports = app;

if (require.main === module) {
  const port = process.env.PORT || 3004;
  app.listen(port, () => console.log(`Server running on port ${port}`));
}

