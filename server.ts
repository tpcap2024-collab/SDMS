import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

type JsonObject = Record<string, unknown>;

const REQUEST_TIMEOUT_MS = 30000;

function getAppsScriptUrl(): string {
  const value = process.env.APPS_SCRIPT_URL;

  if (!value) {
    throw new Error("APPS_SCRIPT_URL is not configured");
  }

  return value.trim();
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error || "Unknown error");
}

async function parseJsonResponse(response: Response): Promise<JsonObject> {
  const responseText = await response.text();

  if (!responseText) {
    throw new Error("Apps Script returned an empty response");
  }

  try {
    return JSON.parse(responseText) as JsonObject;
  } catch {
    throw new Error(
      "Apps Script returned invalid JSON with HTTP status " +
        response.status
    );
  }
}

async function callAppsScriptGet(
  action: string,
  parameters: Record<string, string> = {}
): Promise<JsonObject> {
  const appsScriptUrl = getAppsScriptUrl();
  const url = new URL(appsScriptUrl);

  url.searchParams.set("action", action);

  Object.entries(parameters).forEach(([key, value]) => {
    if (value) {
      url.searchParams.set(key, value);
    }
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });

    const result = await parseJsonResponse(response);

    if (!response.ok) {
      const errorMessage =
        typeof result.error === "string"
          ? result.error
          : "Apps Script request failed";

      throw new Error(errorMessage);
    }

    return result;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function callAppsScriptPost(
  body: JsonObject
): Promise<JsonObject> {
  const appsScriptUrl = getAppsScriptUrl();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(appsScriptUrl, {
      method: "POST",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const result = await parseJsonResponse(response);

    if (!response.ok) {
      const errorMessage =
        typeof result.error === "string"
          ? result.error
          : "Apps Script request failed";

      throw new Error(errorMessage);
    }

    return result;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;
  const isProduction = process.env.NODE_ENV === "production";

  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", async (req, res) => {
    try {
      const appsScriptResult = await callAppsScriptGet("health");

      return res.status(200).json({
        success: true,
        service: "SDMS API",
        status: "online",
        environment: isProduction
          ? "production"
          : "development",
        appsScript: appsScriptResult,
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      console.error("Health check error:", error);

      return res.status(503).json({
        success: false,
        service: "SDMS API",
        status: "apps_script_unavailable",
        error: getErrorMessage(error),
        timestamp: new Date().toISOString(),
      });
    }
  });

  app.get("/api/docks", async (req, res) => {
    try {
      const requestedDate =
        typeof req.query.date === "string"
          ? req.query.date.trim()
          : "";

      const result = await callAppsScriptGet(
        "getSmartDockPlans",
        {
          date: requestedDate,
        }
      );

      return res.status(200).json(result);
    } catch (error: unknown) {
      console.error("Get dock plans error:", error);

      return res.status(500).json({
        success: false,
        action: "getSmartDockPlans",
        error: getErrorMessage(error),
        timestamp: new Date().toISOString(),
      });
    }
  });

  app.get("/api/smart-dock/plans", async (req, res) => {
    try {
      const requestedDate =
        typeof req.query.date === "string"
          ? req.query.date.trim()
          : "";

      const result = await callAppsScriptGet(
        "getSmartDockPlans",
        {
          date: requestedDate,
        }
      );

      return res.status(200).json(result);
    } catch (error: unknown) {
      console.error("Get Smart Dock plans error:", error);

      return res.status(500).json({
        success: false,
        action: "getSmartDockPlans",
        error: getErrorMessage(error),
        timestamp: new Date().toISOString(),
      });
    }
  });

  app.post("/api/smart-dock/start", async (req, res) => {
    try {
      const codeRun = String(
        req.body?.codeRun || ""
      )
        .trim()
        .toUpperCase();

      const dock = String(
        req.body?.dock || ""
      ).trim();

      if (!codeRun) {
        return res.status(400).json({
          success: false,
          error: "codeRun is required",
        });
      }

      if (!dock) {
        return res.status(400).json({
          success: false,
          error: "dock is required",
        });
      }

      const result = await callAppsScriptPost({
        action: "startSmartDock",
        codeRun,
        dock,
      });

      return res.status(200).json(result);
    } catch (error: unknown) {
      console.error("Start Smart Dock error:", error);

      return res.status(500).json({
        success: false,
        action: "startSmartDock",
        error: getErrorMessage(error),
        timestamp: new Date().toISOString(),
      });
    }
  });

  app.post("/api/smart-dock/complete", async (req, res) => {
    try {
      const codeRun = String(
        req.body?.codeRun || ""
      )
        .trim()
        .toUpperCase();

      if (!codeRun) {
        return res.status(400).json({
          success: false,
          error: "codeRun is required",
        });
      }

      const result = await callAppsScriptPost({
        action: "completeSmartDock",
        codeRun,
      });

      return res.status(200).json(result);
    } catch (error: unknown) {
      console.error("Complete Smart Dock error:", error);

      return res.status(500).json({
        success: false,
        action: "completeSmartDock",
        error: getErrorMessage(error),
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
    const distPath = path.resolve(
      process.cwd(),
      "dist"
    );

    const indexFile = path.join(
      distPath,
      "index.html"
    );

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

  app.listen(port, "0.0.0.0", () => {
    console.log(
      "SDMS server is running on port " + port
    );

    console.log(
      "Environment: " +
        (isProduction
          ? "production"
          : "development")
    );
  });
}

startServer().catch((error: unknown) => {
  console.error(
    "Failed to start SDMS server:",
    error
  );

  process.exit(1);
});
