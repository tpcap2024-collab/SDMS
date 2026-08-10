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

  // ตรวจสอบสถานะของ Server
  app.get("/api/health", (req, res) => {
    res.json({
      success: true,
      service: "SDMS API",
      status: "online",
      environment: isProduction ? "production" : "development",
      timestamp: new Date().toISOString(),
    });
  });

  // ดึงข้อมูลแผนงานจาก Google Sheets
  app.get("/api/docks", async (req, res) => {
    try {
      const spreadsheetId = process.env.GOOGLE_SHEET_ID;
      const sheetName = process.env.GOOGLE_SHEET_NAME || "";
      const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
      const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

      if (!spreadsheetId) {
        return res.status(500).json({
          success: false,
          error: "ยังไม่ได้ตั้งค่า GOOGLE_SHEET_ID บน Server",
        });
      }

      if (!clientEmail) {
        return res.status(500).json({
          success: false,
          error: "ยังไม่ได้ตั้งค่า GOOGLE_CLIENT_EMAIL บน Server",
        });
      }

      if (!privateKey) {
        return res.status(500).json({
          success: false,
          error: "ยังไม่ได้ตั้งค่า GOOGLE_PRIVATE_KEY บน Server",
        });
      }

      const googleAuth = new GoogleAuth({
        credentials: {
          client_email: clientEmail,
          private_key: privateKey,
        },
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      });

      const authClient = await googleAuth.getClient();

      const sheets = google.sheets({
        version: "v4",
        auth: authClient as any,
      });

      const range = sheetName ? `'${sheetName}'!A:Z` : "A:Z";

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });

      const rows = response.data.values || [];

      return res.json({
        success: true,
        spreadsheetId,
        sheetName: sheetName || "แผ่นงานแรก",
        rowCount: rows.length,
        data: rows,
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      console.error("Error fetching Google Sheets data:", error);

      const message =
        error instanceof Error
          ? error.message
          : "ไม่สามารถดึงข้อมูลจาก Google Sheets ได้";

      return res.status(500).json({
        success: false,
        error: message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // ใช้ Vite Middleware เฉพาะตอน Development
  if (!isProduction) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
      },
      appType: "spa",
    });

    app.use(vite.middlewares);
  } else {
    // ให้ Express เปิดไฟล์ React ที่ Build แล้วจากโฟลเดอร์ dist
    const distPath = path.resolve(process.cwd(), "dist");

    app.use(express.static(distPath));

    // รองรับการเปิดหรือ Refresh ทุกหน้าของ React
    // รูปแบบนี้รองรับ Express 5
    app.get("/{*splat}", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

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
