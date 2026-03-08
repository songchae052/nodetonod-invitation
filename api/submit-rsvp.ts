import express from "express";
import { createServer as createViteServer } from "vite";
import { google } from "googleapis";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Parse JSON bodies
  app.use(express.json());

  // API Routes
  app.post("/api/submit-rsvp", async (req, res) => {
    try {
      const { name, phone } = req.body;

      if (!process.env.GOOGLE_SPREADSHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
        console.warn("Google Sheets credentials missing");
        return res.status(500).json({ error: "Server configuration error: Missing Google Sheets credentials" });
      }

      let privateKey = process.env.GOOGLE_PRIVATE_KEY || "";

      // 1. Handle JSON input (if user pasted the full JSON file content)
      if (privateKey.trim().startsWith('{')) {
        try {
          const keyJson = JSON.parse(privateKey);
          if (keyJson.private_key) {
            privateKey = keyJson.private_key;
          }
        } catch (e) {
          // Not valid JSON, treat as string
        }
      }

      // 2. Normalization
      // Replace literal escaped newlines with real newlines
      privateKey = privateKey.replace(/\\n/g, '\n');
      
      // Remove surrounding quotes if present
      if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
        privateKey = privateKey.slice(1, -1);
      }

      // 3. Aggressive Cleanup & Rebuild
      // Detect header type before stripping
      const isRsa = privateKey.includes('BEGIN RSA PRIVATE KEY');
      
      // Remove existing headers, footers, and all whitespace to get the pure base64 string
      const rawBody = privateKey
        .replace(/-----BEGIN PRIVATE KEY-----/g, '')
        .replace(/-----END PRIVATE KEY-----/g, '')
        .replace(/-----BEGIN RSA PRIVATE KEY-----/g, '')
        .replace(/-----END RSA PRIVATE KEY-----/g, '')
        .replace(/\s/g, ''); // Remove all spaces, tabs, newlines

      // Check if we actually have a key body left
      if (rawBody.length < 100) {
        console.error("Private key is too short or empty after cleanup.");
        return res.status(500).json({ error: "Server configuration error: Invalid Google Private Key format" });
      }

      // Reconstruct the PEM string with correct headers and newlines
      // Split into 64-character lines for strict PEM compliance
      const chunkedBody = rawBody.match(/.{1,64}/g)?.join('\n') || rawBody;
      
      if (isRsa) {
        privateKey = `-----BEGIN RSA PRIVATE KEY-----\n${chunkedBody}\n-----END RSA PRIVATE KEY-----\n`;
      } else {
        privateKey = `-----BEGIN PRIVATE KEY-----\n${chunkedBody}\n-----END PRIVATE KEY-----\n`;
      }

      // console.log("Reconstructed Key (first 50 chars):", privateKey.substring(0, 50));

      const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          private_key: privateKey,
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });

      const sheets = google.sheets({ version: 'v4', auth });

      // 1. Get spreadsheet metadata to find the correct sheet name
      const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
      const meta = await sheets.spreadsheets.get({
        spreadsheetId,
      });

      const sheetTitle = meta.data.sheets?.[0]?.properties?.title;
      if (!sheetTitle) {
        throw new Error("No sheets found in the spreadsheet");
      }

      // 2. Append to the first sheet found
      // Use single quotes around the sheet title to handle spaces or special characters
      const range = `'${sheetTitle}'!A:C`;

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range, 
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [
            [new Date().toISOString(), name, phone]
          ],
        },
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error submitting to Google Sheets:", error);
      res.status(500).json({ error: "Failed to save data", details: error.message });
    }
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production static file serving would go here (handled by container usually, but good for completeness)
    app.use(express.static('dist'));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
