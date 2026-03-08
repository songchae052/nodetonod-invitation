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

      let privateKey = process.env.GOOGLE_PRIVATE_KEY;
      
      // Remove surrounding quotes if present (common when copying from env files)
      if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
        privateKey = privateKey.slice(1, -1);
      }
      
      // Replace literal \n with actual newlines
      // This handles keys that are single-line strings with \n characters
      privateKey = privateKey.replace(/\\n/g, '\n');

      console.log("Private Key Length:", privateKey.length);
      console.log("Private Key Start:", privateKey.substring(0, 30));
      console.log("Private Key End:", privateKey.substring(privateKey.length - 30));

      const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          private_key: privateKey,
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });

      const sheets = google.sheets({ version: 'v4', auth });

      await sheets.spreadsheets.values.append({
        spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
        range: 'Sheet1!A:C', // Assuming Sheet1, columns A, B, C (Timestamp, Name, Phone)
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
