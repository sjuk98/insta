const express = require("express");
const axios = require("axios");
const supabase = require("../supabase");
const router = express.Router();

router.get("/", async (req, res) => {
    return res.status(200).send("Error exchanging token");
});

router.get("/auth/instagram/callback", async (req, res) => {
  const code = req.query.code;

  if (!code) {
    return res.status(400).send("No code received");
  }

  try {
    // 1️⃣ Exchange code → Short-lived token
    const shortResp = await axios({
      method: "post",
      url: "https://api.instagram.com/oauth/access_token",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      data: new URLSearchParams({
        client_id: process.env.INSTAGRAM_CLIENT_ID,
        client_secret: process.env.INSTAGRAM_CLIENT_SECRET,
        redirect_uri: process.env.INSTAGRAM_REDIRECT_URI,
        grant_type: "authorization_code",
        code,
      }),
    });

    const shortToken = shortResp.data.access_token;
    const igUserId = shortResp.data.user_id;

    // 2️⃣ Long-lived token
    const longTokenResp = await axios.get(
      "https://graph.instagram.com/access_token",
      {
        params: {
          grant_type: "ig_exchange_token",
          client_secret: process.env.INSTAGRAM_CLIENT_SECRET,
          access_token: shortToken,
        },
      }
    );

    const longToken = longTokenResp.data.access_token;
    const expiresIn = longTokenResp.data.expires_in;

    // 3️⃣ Store in Supabase  
    // If user exists → update token  
    // Else → insert new row  

    const { data: existingRow } = await supabase
      .from("social_tokens")
      .select("*")
      .eq("provider", "instagram")
      .eq("user_id", igUserId)
      .maybeSingle();

    if (existingRow) {
      await supabase
        .from("social_tokens")
        .update({
          access_token: longToken,
          expires_in: expiresIn,
        })
        .eq("id", existingRow.id);
    } else {
      await supabase.from("social_tokens").insert({
        provider: "instagram",
        user_id: igUserId,
        access_token: longToken,
        expires_in: expiresIn,
      });
    }

    res.json({
      success: true,
      message: "Access token stored in Supabase",
      userId: igUserId,
    });
  } catch (err) {
    console.error("Callback Error:", err.response?.data || err);
    return res.status(500).send("Error exchanging token");
  }
});

module.exports = router;
