const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const app = express();

app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// Verification for Meta Developer Portal
app.get('/api/webhook', (req, res) => {
  const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
  if (req.query['hub.verify_token'] === VERIFY_TOKEN) {
    return res.send(req.query['hub.challenge']);
  }
  res.send('Error, wrong validation token');
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
