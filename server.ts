import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { google } from "googleapis";
import { auth } from "google-auth-library";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json());

  // API Route to fetch docks data from Google Sheets
  app.get("/api/docks", async (req, res) => {
    try {
      const sheetId = process.env.GOOGLE_SHEET_ID;
      if (!sheetId) {
        return res.status(400).json({ error: "GOOGLE_SHEET_ID is not configured in the environment variables." });
      }

      // Automatically uses Application Default Credentials provisioned by AI Studio
      // NOTE for Render/GitHub deployment: You will need to create a Service Account in Google Cloud,
      // download its JSON key file, and either point to it using GOOGLE_APPLICATION_CREDENTIALS environment variable
      // or pass the credentials directly.
      const client = await auth.getClient({
        scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
      });

      const sheets = google.sheets({ version: "v4", auth: client as any });
      
      // Read a range, for example 'Docks!A1:Z100' or just 'Docks'
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: "A:Z", // Default to reading the first sheet's A to Z columns
      });

      const rows = response.data.values;
      if (!rows || rows.length === 0) {
        return res.json({ data: [] });
      }

      // Convert rows to the DockData format, depending on the sheet structure.
      // Since we don't know the exact sheet structure, we'll return raw rows for now
      // and the frontend can process them, or we process them here.
      // Let's send raw rows to the frontend so it can process them if needed.
      res.json({ data: rows });
    } catch (error: any) {
      console.error("Error fetching Google Sheets data:", error);
      res.status(500).json({ error: error.message || "Failed to fetch data from Google Sheets." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
