import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { google } from "googleapis";
import { GoogleAuth } from "google-auth-library";

async function startServer() {
  const app = express();

  const PORT = Number(process.env.PORT) || 3000;
  const isProduction = process.env.NODE_ENV === "production";

  app.use(express.json());

  app.get("/api/health", (req, res) => {
    return res.status(200).json({
      success: true,
      service: "SDMS API",
      status: "online",
      environment: isProduction ? "production" : "development",
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/api/docks", async (req, res) => {
    try {
      const spreadsheetId = process.env.GOOGLE_SHEET_ID;
      const sheetName = process.env.GOOGLE_SHEET_NAME;
      const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
      const privateKeyValue = process.env.GOOGLE_PRIVATE_KEY;

      if (!spreadsheetId) {
        return res.status(500).json({
          success: false,
          error: "GOOGLE_SHEET_ID is not configured",
        });
      }

      if (!sheetName) {
        return res.status(500).json({
          success: false,
          error: "GOOGLE_SHEET_NAME is not configured",
        });
      }

      if (!clientEmail) {
        return res.status(500).json({
          success: false,
          error: "GOOGLE_CLIENT_EMAIL is not configured",
        });
      }

      if (!privateKeyValue) {
        return res.status(500).json({
          success: false,
          error: "GOOGLE_PRIVATE_KEY is not configured",
        });
      }

      const privateKey = privateKeyValue.replace(/\\n/g, "\n");

      const googleAuth = new GoogleAuth({
        credentials: {
          client_email: clientEmail,
          private_key: privateKey,
        },
        scopes: [
          "https://www.googleapis.com/auth/spreadsheets.readonly",
        ],
      });

      const authClient = await googleAuth.getClient();

      const sheets = google.sheets({
        version: "v4",
        auth: authClient,
      });

      const safeSheetName = sheetName.replace(/'/g, "''");
      const range = `'${safeSheetName}'!A:Z`;

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });

      const rows = response.data.values || [];

      return res.status(200).json({
        success: true,
        sheetName,
        rowCount: rows.length,
        data: rows,
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      console.error("Google Sheets read error:", error);

      const message =
        error instanceof Error
          ? error.message
          : "Unable to read Google Sheets data";

      return res.status(500).json({
        success: false,
        error: message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  if (!isProduction) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
      },
      appType: "spa",
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), "dist");
    const indexFile = path.join(distPath, "index.html");

    app.use(express.static(distPath));

    app.use((req, res, next) => {
      if (req.method !== "GET") {
        return next();
      }

      if (req.path.startsWith("/api/")) {
        return res.status(404).json({
          success: false,
          error: "API route not found",
          path: req.path,
        });
      }

      return res.sendFile(indexFile);
    });
  }

  app.use((req, res) => {
    return res.status(404).json({
      success: false,
      error: "Route not found",
      path: req.path,
    });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`SDMS server is running on port ${PORT}`);
    console.log(
      `Environment: ${isProduction ? "production" : "development"}`
    );
  });
}

startServer().catch((error: unknown) => {
  console.error("Failed to start SDMS server:", error);
  process.exit(1);
});
