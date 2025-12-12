// const express = require("express");
// const axios = require("axios");
// const app = express();

// const APP_ID = "815875474588666";
// const APP_SECRET = "a67f9641043d8622dde4249f7055ae28";
// const REDIRECT_URL = "http://localhost:3000/auth/instagram/callback";

// // -------------------------------
// // STEP 1: Instagram Login URL
// // -------------------------------
// app.get("/auth/instagram/login", (req, res) => {
//   const url =
//     `https://api.instagram.com/oauth/authorize` +
//     `?client_id=${APP_ID}` +
//     `&redirect_uri=${REDIRECT_URL}` +
//     `&scope=user_profile,user_media` +
//     `&response_type=code`;

//   res.redirect(url);
// });

// // -------------------------------
// // STEP 2: Handle Redirect (CODE)
// // -------------------------------
// app.get("/auth/instagram/callback", async (req, res) => {
//   const code = req.query.code;

//   if (!code) {
//     return res.status(400).send("No code received");
//   }

//   try {
//     // STEP 3: Exchange CODE → SHORT TOKEN
//     const shortTokenRes = await axios.post(
//       "https://api.instagram.com/oauth/access_token",
//       null,
//       {
//         params: {
//           client_id: APP_ID,
//           client_secret: APP_SECRET,
//           grant_type: "authorization_code",
//           redirect_uri: REDIRECT_URL,
//           code: code,
//         },
//       }
//     );

//     const shortToken = shortTokenRes.data.access_token;
//     console.log("SHORT-LIVED TOKEN:", shortToken);

//     // STEP 4: Exchange SHORT → LONG TOKEN
//     const longUrl =
//       `https://graph.instagram.com/access_token` +
//       `?grant_type=ig_exchange_token` +
//       `&client_secret=${APP_SECRET}` +
//       `&access_token=${shortToken}`;

//     const longTokenRes = await axios.get(longUrl);

//     const longToken = longTokenRes.data.access_token;
//     console.log("LONG-LIVED TOKEN:", longToken);

//     res.json({
//       success: true,
//       short_lived_token: shortToken,
//       long_lived_token: longToken,
//       expires_in: longTokenRes.data.expires_in,
//     });
//   } catch (err) {
//     console.error(err.response?.data || err);
//     res.status(500).json(err.response?.data || err);
//   }
// });

// // -------------------------------
// app.listen(3000, () => console.log("Server running at http://localhost:3000"));


const axios = require('axios');

// IMPORTANT: Replace these placeholders with your actual values
const INSTAGRAM_APP_SECRET = 'a67f9641043d8622dde4249f7055ae28'; 
const SHORT_LIVED_TOKEN = 'EAB4ZAKLiBXLMBQO2N8QOvIemZB7ZBmVGCMmtEZBv9Y4AVD7lqkZCb2oZCZC8kgdvTErty8GZBdMaIi0o8gWerSf3V722EZCMhM68JV5i65ckA9xKbsTn3JRCOT43csHs6mx0Rbvg11Bq451J0blRuI8wfNZB4zXdiZAQBryQSQOLN4xrqqgjcCPKKqieoVqi1ZC3ZAsQsSmSoCNv9wpYp4SjsgpwOelRL4hpebEvomKINFvai17Lcw950FZB7OnbhAP4ugeERTZAcgYgj0XlZCA7OxYDlgomuwZDZD'; // The token you currently have

/**
 * Exchanges a short-lived Instagram User Access Token for a long-lived one (60 days).
 * @param {string} shortLivedToken The valid, unexpired short-lived token.
 * @returns {Promise<string>} The new long-lived access token.
 */
async function getLongLivedAccessToken(shortLivedToken) {
    // The Instagram Graph API endpoint for token exchange
    const apiEndpoint = 'https://graph.instagram.com/access_token';
    
    try {
        // The API request is a GET request with all parameters in the query string
        const response = await axios.get(apiEndpoint, {
            params: {
                grant_type: 'ig_exchange_token',
                client_secret: INSTAGRAM_APP_SECRET,
                access_token: shortLivedToken 
            }
        });

        // The API returns a JSON object with the new token and its expiration
        const { access_token, expires_in } = response.data;
        
        console.log('Successfully exchanged token!');
        console.log(`New Long-Lived Access Token: ${access_token}`);
        console.log(`Expires in: ${expires_in} seconds (approx. 60 days)`);
        
        // You should save this new long-lived token in your database
        return access_token; 

    } catch (error) {
        console.error('Error exchanging token:', error.response ? error.response.data : error.message);
        throw new Error('Failed to get long-lived access token.');
    }
}

// Example Execution (assuming you're running this as a script)
getLongLivedAccessToken(SHORT_LIVED_TOKEN)
    .then(longLivedToken => {
        // Use the longLivedToken for subsequent API calls
        console.log('Use this token for your Instagram Graph API requests.');
    })
    .catch(err => {
        console.error('Process failed:', err.message);
    });