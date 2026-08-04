import express from "express";
import { createServer as createViteServer } from "vite";
import Datastore from "nedb-promises";
import mysql from "mysql2/promise";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const DEFAULT_SEED_MODELS = [
  // Google AI Studio / Gemini
  { provider: "Gemini", model_name: "Gemini 2.5 Flash", model_id: "gemini-2.5-flash", is_favorite: true },
  { provider: "Gemini", model_name: "Gemini 1.5 Flash", model_id: "gemini-1.5-flash", is_favorite: false },
  { provider: "Gemini", model_name: "Gemini 1.5 Pro", model_id: "gemini-1.5-pro", is_favorite: false },
  { provider: "Google AI Studio", model_name: "Gemini 2.0 Flash Exp", model_id: "gemini-2.0-flash-exp", is_favorite: true },

  // DeepSeek
  { provider: "DeepSeek", model_name: "DeepSeek V3", model_id: "deepseek-chat", is_favorite: true },
  { provider: "DeepSeek", model_name: "DeepSeek R1 (Reasoning)", model_id: "deepseek-reasoner", is_favorite: true },

  // OpenRouter Free Models
  { provider: "OpenRouter", model_name: "DeepSeek: R1 (Free)", model_id: "deepseek/deepseek-r1:free", is_favorite: true },
  { provider: "OpenRouter", model_name: "Google: Gemma 2 9B (Free)", model_id: "google/gemma-2-9b-it:free", is_favorite: true },
  { provider: "OpenRouter", model_name: "Meta: Llama 3.3 70B (Free)", model_id: "meta-llama/llama-3.3-70b-instruct:free", is_favorite: true },
  { provider: "OpenRouter", model_name: "Qwen: 2.5 Coder 32B (Free)", model_id: "qwen/qwen-2.5-coder-32b-instruct:free", is_favorite: false },
  { provider: "OpenRouter", model_name: "Mistral: 7B Instruct (Free)", model_id: "mistralai/mistral-7b-instruct:free", is_favorite: false },

  // Alibaba Cloud (Bailian/DashScope)
  { provider: "Alibaba Cloud", model_name: "Qwen Max", model_id: "qwen-max", is_favorite: true },
  { provider: "Alibaba Cloud", model_name: "Qwen Plus", model_id: "qwen-plus", is_favorite: false },
  { provider: "Alibaba Cloud", model_name: "Qwen 2.5 Coder 32B", model_id: "qwen2.5-coder-32b-instruct", is_favorite: true },

  // Ollama Cloud
  { provider: "Ollama Cloud", model_name: "Llama 3.3 70B", model_id: "llama3.3:70b", is_favorite: true },
  { provider: "Ollama Cloud", model_name: "DeepSeek R1 70B", model_id: "deepseek-r1:70b", is_favorite: true },
  { provider: "Ollama Cloud", model_name: "Qwen 2.5 32B", model_id: "qwen2.5:32b", is_favorite: false },

  // NVIDIA NIM
  { provider: "NVIDIA NIM", model_name: "Meta Llama 3.3 70B Instruct", model_id: "meta/llama-3.3-70b-instruct", is_favorite: true },
  { provider: "NVIDIA NIM", model_name: "DeepSeek R1", model_id: "deepseek-ai/deepseek-r1", is_favorite: true },

  // Mistral & Codestral
  { provider: "Mistral", model_name: "Mistral Large", model_id: "mistral-large-latest", is_favorite: true },
  { provider: "Mistral", model_name: "Mistral Small", model_id: "mistral-small-latest", is_favorite: false },
  { provider: "Codestral", model_name: "Codestral 2501", model_id: "codestral-latest", is_favorite: true },

  // HuggingFace
  { provider: "HuggingFace", model_name: "Meta Llama 3.3 70B", model_id: "meta-llama/Llama-3.3-70B-Instruct", is_favorite: true },
  { provider: "HuggingFace", model_name: "DeepSeek R1", model_id: "deepseek-ai/DeepSeek-R1", is_favorite: false },

  // Vercel AI Gateway & Kilo Gateway
  { provider: "Vercel AI Gateway", model_name: "GPT-4o Mini", model_id: "openai/gpt-4o-mini", is_favorite: true },
  { provider: "Kilo Gateway", model_name: "Kilo Auto Router", model_id: "kilo/auto", is_favorite: true },

  // OpenCode Zen
  { provider: "OpenCode Zen", model_name: "OpenCode Coder Max", model_id: "opencode-coder-max", is_favorite: true },

  // Cerebras
  { provider: "Cerebras", model_name: "Llama 3.3 70B (Fast)", model_id: "llama-3.3-70b", is_favorite: true },

  // Groq
  { provider: "Groq", model_name: "Llama 3.3 70B Versatile", model_id: "llama-3.3-70b-versatile", is_favorite: true },
  { provider: "Groq", model_name: "DeepSeek R1 Distill 70B", model_id: "deepseek-r1-distill-llama-70b", is_favorite: true },

  // Cohere
  { provider: "Cohere", model_name: "Command R+", model_id: "command-r-plus", is_favorite: true },

  // Cloudflare Workers AI
  { provider: "Cloudflare Workers AI", model_name: "Llama 3.3 70B Instruct", model_id: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", is_favorite: true },

  // OpenAI
  { provider: "OpenAI", model_name: "GPT-4o Mini", model_id: "gpt-4o-mini", is_favorite: true },
  { provider: "OpenAI", model_name: "GPT-4o", model_id: "gpt-4o", is_favorite: false },
];

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Initialize NeDB Datastores (as fallback or primary)
  const apiKeysDb = Datastore.create({ filename: "./api_keys.db", autoload: true });
  const aiModelsDb = Datastore.create({ filename: "./ai_models.db", autoload: true });
  const usersDb = Datastore.create({ filename: "./users.db", autoload: true });

  const DEFAULT_SEED_USERS = [
    { name: "Sarah Connor (Admin)", email: "sarah.admin@company.com", role: "Admin", avatar_color: "bg-indigo-600", created_at: new Date().toISOString() },
    { name: "Alex Mercer (Manager)", email: "alex.manager@company.com", role: "Manager", avatar_color: "bg-blue-600", created_at: new Date().toISOString() },
    { name: "Sam Vance (Viewer)", email: "sam.viewer@company.com", role: "Viewer", avatar_color: "bg-emerald-600", created_at: new Date().toISOString() }
  ];

  // RBAC Helper Middleware
  const checkRolePermission = (allowedRoles: string[]) => {
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const userRole = (req.headers["x-user-role"] as string) || "Admin";
      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({
          error: `Forbidden: This operation requires ${allowedRoles.join(" or ")} privilege. Your current role is '${userRole}'.`
        });
      }
      next();
    };
  };

  // MySQL Configuration
  const useMysql = !!process.env.MYSQL_HOST;
  let pool: mysql.Pool | null = null;

  if (useMysql) {
    console.log(`Attempting to connect to MySQL at ${process.env.MYSQL_HOST}...`);
    try {
      pool = mysql.createPool({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE,
        port: parseInt(process.env.MYSQL_PORT || "3306"),
        waitForConnections: true,
        connectionLimit: 5,
        queueLimit: 0,
        connectTimeout: 5000, // 5 seconds timeout
      });
      
      // Test connection with a timeout
      const connectionPromise = pool.getConnection();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("MySQL Connection Timeout (5s)")), 5000)
      );

      const connection = await Promise.race([connectionPromise, timeoutPromise]) as mysql.PoolConnection;
      console.log("Successfully connected to remote MySQL database");
      
      // Initialize Tables
      await connection.query(`
        CREATE TABLE IF NOT EXISTS api_keys (
          id INT AUTO_INCREMENT PRIMARY KEY,
          provider VARCHAR(50) NOT NULL,
          name VARCHAR(100) NOT NULL,
          key_value TEXT NOT NULL,
          expires_at TIMESTAMP NULL,
          last_used_at TIMESTAMP NULL,
          usage_count INT DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Migration: Add missing columns to api_keys if they don't exist
      try {
        await connection.query("ALTER TABLE api_keys ADD COLUMN expires_at TIMESTAMP NULL AFTER key_value");
      } catch (e) {
        // Column probably already exists, ignore
      }
      
      try {
        await connection.query("ALTER TABLE api_keys ADD COLUMN last_used_at TIMESTAMP NULL AFTER expires_at");
      } catch (e) {
        // Column probably already exists, ignore
      }

      try {
        await connection.query("ALTER TABLE api_keys ADD COLUMN usage_count INT DEFAULT 0 AFTER last_used_at");
      } catch (e) {
        // Column probably already exists, ignore
      }

      await connection.query(`
        CREATE TABLE IF NOT EXISTS ai_models (
          id INT AUTO_INCREMENT PRIMARY KEY,
          provider VARCHAR(50) NOT NULL,
          model_name VARCHAR(100) NOT NULL,
          model_id VARCHAR(100) NOT NULL UNIQUE,
          status VARCHAR(20) DEFAULT 'active',
          is_playground BOOLEAN DEFAULT TRUE,
          is_favorite BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Migration: Add is_playground column if it doesn't exist
      try {
        await connection.query("ALTER TABLE ai_models ADD COLUMN is_playground BOOLEAN DEFAULT TRUE");
      } catch (e) {
        // Column probably already exists, ignore
      }

      // Migration: Add is_favorite column if it doesn't exist
      try {
        await connection.query("ALTER TABLE ai_models ADD COLUMN is_favorite BOOLEAN DEFAULT FALSE");
      } catch (e) {
        // Column probably already exists, ignore
      }
      
      // Seed Default Models if empty
      const [countRows]: any = await connection.query("SELECT COUNT(*) as count FROM ai_models");
      if (countRows[0]?.count === 0) {
        console.log("Seeding default AI models into MySQL...");
        const seedValues = DEFAULT_SEED_MODELS.map(m => [m.provider, m.model_name, m.model_id, 'active', true, m.is_favorite]);
        await connection.query(
          "INSERT INTO ai_models (provider, model_name, model_id, status, is_playground, is_favorite) VALUES ?",
          [seedValues]
        );
      }

      await connection.query(`
        CREATE TABLE IF NOT EXISTS users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          email VARCHAR(100) NOT NULL UNIQUE,
          role VARCHAR(20) NOT NULL DEFAULT 'Viewer',
          avatar_color VARCHAR(30) DEFAULT 'bg-indigo-600',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      const [userCountRows]: any = await connection.query("SELECT COUNT(*) as count FROM users");
      if (userCountRows[0]?.count === 0) {
        console.log("Seeding default RBAC users into MySQL...");
        const seedUsers = DEFAULT_SEED_USERS.map(u => [u.name, u.email, u.role, u.avatar_color]);
        await connection.query(
          "INSERT INTO users (name, email, role, avatar_color) VALUES ?",
          [seedUsers]
        );
      }

      connection.release();
    } catch (error) {
      console.error("MySQL Connection Failed. Falling back to NeDB.", (error as Error).message);
      pool = null;
    }
  }

  // NeDB Seed if empty
  if (!pool) {
    const count = await aiModelsDb.count({});
    if (count === 0) {
      console.log("Seeding default AI models into NeDB...");
      for (const m of DEFAULT_SEED_MODELS) {
        await aiModelsDb.insert({
          ...m,
          status: 'active',
          is_playground: true,
          created_at: new Date().toISOString()
        });
      }
    }

    const userCount = await usersDb.count({});
    if (userCount === 0) {
      console.log("Seeding default RBAC users into NeDB...");
      for (const u of DEFAULT_SEED_USERS) {
        await usersDb.insert(u);
      }
    }
  }

  // Users & RBAC API Routes
  app.get("/api/users", async (req, res) => {
    try {
      if (pool) {
        const [rows] = await pool.query("SELECT * FROM users ORDER BY created_at ASC");
        res.json(rows);
      } else {
        const rows = await usersDb.find({}).sort({ created_at: 1 });
        res.json(rows.map(r => ({ ...r, id: r._id })));
      }
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/api/users", checkRolePermission(["Admin"]), async (req, res) => {
    const { name, email, role, avatar_color } = req.body;
    if (!name || !email || !role) {
      return res.status(400).json({ error: "Name, email, and role are required." });
    }
    const color = avatar_color || "bg-indigo-600";
    try {
      if (pool) {
        const [result] = await pool.query(
          "INSERT INTO users (name, email, role, avatar_color) VALUES (?, ?, ?, ?)",
          [name, email, role, color]
        );
        res.json({ id: (result as any).insertId, name, email, role, avatar_color: color });
      } else {
        const doc = await usersDb.insert({
          name, email, role, avatar_color: color, created_at: new Date().toISOString()
        });
        res.json({ id: doc._id, name, email, role, avatar_color: color });
      }
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.patch("/api/users/:id/role", checkRolePermission(["Admin"]), async (req, res) => {
    const { role } = req.body;
    if (!role || !['Admin', 'Manager', 'Viewer'].includes(role)) {
      return res.status(400).json({ error: "Invalid role specified." });
    }
    try {
      if (pool) {
        await pool.query("UPDATE users SET role = ? WHERE id = ?", [role, req.params.id]);
      } else {
        await usersDb.update({ _id: req.params.id }, { $set: { role } });
      }
      res.json({ success: true, role });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.delete("/api/users/:id", checkRolePermission(["Admin"]), async (req, res) => {
    try {
      if (pool) {
        await pool.query("DELETE FROM users WHERE id = ?", [req.params.id]);
      } else {
        await usersDb.remove({ _id: req.params.id }, {});
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // API routes
  app.post("/api/validate-key", async (req, res) => {
    const { provider, key_value } = req.body;
    if (!provider || !key_value) {
      return res.status(400).json({ error: "Provider and key_value are required" });
    }

    const trimmedKey = key_value.trim();
    try {
      let response;
      if (provider === "Gemini" || provider === "Google AI Studio") {
        const encodedKey = encodeURIComponent(trimmedKey);
        response = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${encodedKey}`);
      } else if (provider === "OpenAI") {
        response = await fetch("https://api.openai.com/v1/models", {
          headers: { "Authorization": `Bearer ${trimmedKey}` }
        });
      } else if (provider === "DeepSeek") {
        response = await fetch("https://api.deepseek.com/models", {
          headers: { "Authorization": `Bearer ${trimmedKey}` }
        });
      } else if (provider === "Groq") {
        response = await fetch("https://api.groq.com/openai/v1/models", {
          headers: { "Authorization": `Bearer ${trimmedKey}` }
        });
      } else if (provider === "Cerebras") {
        response = await fetch("https://api.cerebras.ai/v1/models", {
          headers: { "Authorization": `Bearer ${trimmedKey}` }
        });
      } else if (provider === "Mistral" || provider === "Codestral") {
        response = await fetch("https://api.mistral.ai/v1/models", {
          headers: { "Authorization": `Bearer ${trimmedKey}` }
        });
      } else if (provider === "Anthropic") {
        response = await fetch("https://api.anthropic.com/v1/models", {
          headers: { 
            "x-api-key": trimmedKey,
            "anthropic-version": "2023-06-01"
          }
        });
      } else if (provider === "OpenRouter") {
        response = await fetch("https://openrouter.ai/api/v1/models", {
          headers: { "Authorization": `Bearer ${trimmedKey}` }
        });
      } else if (provider === "Cohere") {
        response = await fetch("https://api.cohere.com/v1/models", {
          headers: { "Authorization": `Bearer ${trimmedKey}` }
        });
      } else {
        return res.json({ valid: true, message: "Key recorded cleanly for provider." });
      }

      if (response && !response.ok) {
        const text = await response.text();
        let errorMsg = `HTTP error! status: ${response.status}`;
        try {
          const errorData = JSON.parse(text);
          errorMsg = errorData.error?.message || errorData.message || errorMsg;
        } catch (e) {
          errorMsg = text.length < 200 ? text : errorMsg;
        }
        throw new Error(errorMsg);
      }
      
      res.json({ valid: true });
    } catch (error: any) {
      console.error(`Validation failed for ${provider}:`, error.message);
      res.status(400).json({ error: error.message || "Verification failed" });
    }
  });

  app.get("/api/db-health", async (req, res) => {
    try {
      if (pool) {
        const connection = await pool.getConnection();
        await connection.ping();
        connection.release();
        res.json({ status: "ok", message: "Connected to Remote MySQL", type: "mysql" });
      } else {
        await apiKeysDb.count({});
        res.json({ 
          status: "ok", 
          message: useMysql ? "MySQL failed, using NeDB fallback" : "Using NeDB (MySQL not configured)", 
          type: "nedb",
          mysqlError: useMysql ? "Check your credentials in Settings" : null
        });
      }
    } catch (error) {
      res.status(500).json({ status: "error", message: (error as Error).message });
    }
  });

  // API Key Management
  app.get("/api/api-keys", async (req, res) => {
    try {
      if (pool) {
        const [rows] = await pool.query("SELECT * FROM api_keys ORDER BY provider, name");
        res.json(rows);
      } else {
        const rows = await apiKeysDb.find({}).sort({ provider: 1, name: 1 });
        res.json(rows.map(row => ({ ...row, id: row._id })));
      }
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/api/api-keys", checkRolePermission(["Admin", "Manager"]), async (req, res) => {
    const { provider, name, key_value, expires_at } = req.body;
    console.log(`Received request to save API key for provider: ${provider}, name: ${name}`);
    try {
      if (pool) {
        console.log("Saving to MySQL...");
        const [result] = await pool.query(
          "INSERT INTO api_keys (provider, name, key_value, expires_at, usage_count) VALUES (?, ?, ?, ?, 0)",
          [provider, name, key_value, expires_at || null]
        );
        console.log("Successfully saved to MySQL");
        res.json({ id: (result as any).insertId, provider, name });
      } else {
        console.log("Saving to NeDB...");
        const newDoc = await apiKeysDb.insert({
          provider, name, key_value,
          expires_at: expires_at || null,
          last_used_at: null,
          usage_count: 0,
          created_at: new Date().toISOString()
        });
        console.log("Successfully saved to NeDB");
        res.json({ id: newDoc._id, provider, name });
      }
    } catch (error) {
      console.error("Error saving API key:", error);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.delete("/api/api-keys/:id", checkRolePermission(["Admin"]), async (req, res) => {
    try {
      if (pool) {
        await pool.query("DELETE FROM api_keys WHERE id = ?", [req.params.id]);
      } else {
        await apiKeysDb.remove({ _id: req.params.id }, {});
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.patch("/api/api-keys/:id/last-used", async (req, res) => {
    try {
      if (pool) {
        await pool.query("UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP, usage_count = usage_count + 1 WHERE id = ?", [req.params.id]);
      } else {
        await apiKeysDb.update(
          { _id: req.params.id },
          { 
            $set: { last_used_at: new Date().toISOString() },
            $inc: { usage_count: 1 }
          }
        );
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // AI Model Management
  app.get("/api/ai-models", async (req, res) => {
    try {
      if (pool) {
        const [rows] = await pool.query("SELECT * FROM ai_models ORDER BY provider, model_name");
        res.json(rows);
      } else {
        const rows = await aiModelsDb.find({}).sort({ provider: 1, model_name: 1 });
        res.json(rows.map(row => ({ ...row, id: row._id })));
      }
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/api/ai-models", checkRolePermission(["Admin", "Manager"]), async (req, res) => {
    const { provider, model_name, model_id } = req.body;
    try {
      if (pool) {
        const [result] = await pool.query(
          "INSERT INTO ai_models (provider, model_name, model_id, is_playground) VALUES (?, ?, ?, TRUE) ON DUPLICATE KEY UPDATE model_name = VALUES(model_name), status = 'active'",
          [provider, model_name, model_id]
        );
        res.json({ id: (result as any).insertId || 0, provider, model_name, model_id });
      } else {
        const result = await aiModelsDb.update(
          { model_id },
          { 
            $set: { provider, model_name, model_id, status: 'active' },
            $setOnInsert: { created_at: new Date().toISOString(), is_playground: true }
          },
          { upsert: true, returnUpdatedDocs: true }
        );
        const doc = result as any;
        res.json({ id: doc._id || 0, provider, model_name, model_id });
      }
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/api/ai-models/batch", checkRolePermission(["Admin", "Manager"]), async (req, res) => {
    const { models } = req.body;
    if (!Array.isArray(models) || models.length === 0) {
      return res.status(400).json({ error: "Invalid models data" });
    }

    try {
      if (pool) {
        const connection = await pool.getConnection();
        try {
          await connection.beginTransaction();
          const query = "INSERT INTO ai_models (provider, model_name, model_id, is_playground, is_favorite) VALUES ? ON DUPLICATE KEY UPDATE model_name = VALUES(model_name), status = 'active'";
          const values = models.map(m => [m.provider, m.model_name, m.model_id, true, false]);
          await connection.query(query, [values]);
          await connection.commit();
          res.json({ success: true, count: models.length });
        } catch (error) {
          await connection.rollback();
          throw error;
        } finally {
          connection.release();
        }
      } else {
        const promises = models.map(m => 
          aiModelsDb.update(
            { model_id: m.model_id },
            { 
              $set: { provider: m.provider, model_name: m.model_name, model_id: m.model_id, status: 'active' },
              $setOnInsert: { created_at: new Date().toISOString(), is_playground: true, is_favorite: false }
            },
            { upsert: true }
          )
        );
        await Promise.all(promises);
        res.json({ success: true, count: models.length });
      }
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/api/ai-models/bulk-playground", checkRolePermission(["Admin", "Manager"]), async (req, res) => {
    const { ids, is_playground } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "Invalid request parameters" });
    }
    try {
      if (pool) {
        await pool.query("UPDATE ai_models SET is_playground = ? WHERE id IN (?)", [is_playground, ids]);
      } else {
        await aiModelsDb.update({ _id: { $in: ids } }, { $set: { is_playground } }, { multi: true });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/api/ai-models/bulk-status", checkRolePermission(["Admin", "Manager"]), async (req, res) => {
    const { ids, status } = req.body;
    console.log(`Bulk status update request received for IDs: ${JSON.stringify(ids)} to ${status}`);
    if (!Array.isArray(ids) || ids.length === 0 || !['active', 'inactive'].includes(status)) {
      return res.status(400).json({ error: "Invalid request parameters" });
    }
    try {
      if (pool) {
        console.log("Updating MySQL status...");
        const [result] = await pool.query("UPDATE ai_models SET status = ? WHERE id IN (?)", [status, ids]);
        console.log(`MySQL update result: ${JSON.stringify(result)}`);
      } else {
        console.log("Updating NeDB status...");
        const count = await aiModelsDb.update({ _id: { $in: ids } }, { $set: { status } }, { multi: true });
        console.log(`NeDB update count: ${count}`);
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error in bulk status update:", error);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/api/ai-models/bulk-delete", checkRolePermission(["Admin"]), async (req, res) => {
    const { ids } = req.body;
    console.log(`Bulk delete request received for IDs: ${JSON.stringify(ids)}`);
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "Invalid or empty IDs array" });
    }
    try {
      if (pool) {
        console.log("Deleting from MySQL...");
        const [result] = await pool.query("DELETE FROM ai_models WHERE id IN (?)", [ids]);
        console.log(`MySQL delete result: ${JSON.stringify(result)}`);
      } else {
        console.log("Deleting from NeDB...");
        const count = await aiModelsDb.remove({ _id: { $in: ids } }, { multi: true });
        console.log(`NeDB delete count: ${count}`);
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error in bulk delete:", error);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.delete("/api/ai-models/:id", checkRolePermission(["Admin"]), async (req, res) => {
    try {
      if (pool) {
        await pool.query("DELETE FROM ai_models WHERE id = ?", [req.params.id]);
      } else {
        await aiModelsDb.remove({ _id: req.params.id }, {});
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.patch("/api/ai-models/:id/status", checkRolePermission(["Admin", "Manager"]), async (req, res) => {
    const { status } = req.body;
    try {
      if (pool) {
        await pool.query("UPDATE ai_models SET status = ? WHERE id = ?", [status, req.params.id]);
      } else {
        await aiModelsDb.update({ _id: req.params.id }, { $set: { status } });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.patch("/api/ai-models/:id/playground", checkRolePermission(["Admin", "Manager"]), async (req, res) => {
    const { is_playground } = req.body;
    try {
      if (pool) {
        await pool.query("UPDATE ai_models SET is_playground = ? WHERE id = ?", [is_playground, req.params.id]);
      } else {
        await aiModelsDb.update({ _id: req.params.id }, { $set: { is_playground } });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.patch("/api/ai-models/:id/favorite", checkRolePermission(["Admin", "Manager"]), async (req, res) => {
    const { is_favorite } = req.body;
    try {
      if (pool) {
        await pool.query("UPDATE ai_models SET is_favorite = ? WHERE id = ?", [is_favorite, req.params.id]);
      } else {
        await aiModelsDb.update({ _id: req.params.id }, { $set: { is_favorite } });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/api/ai-models/reset-defaults", checkRolePermission(["Admin", "Manager"]), async (req, res) => {
    try {
      if (pool) {
        const seedValues = DEFAULT_SEED_MODELS.map(m => [m.provider, m.model_name, m.model_id, 'active', true, m.is_favorite]);
        await pool.query(
          "INSERT INTO ai_models (provider, model_name, model_id, status, is_playground, is_favorite) VALUES ? ON DUPLICATE KEY UPDATE model_name = VALUES(model_name), status = 'active'",
          [seedValues]
        );
      } else {
        for (const m of DEFAULT_SEED_MODELS) {
          await aiModelsDb.update(
            { model_id: m.model_id },
            {
              $set: { provider: m.provider, model_name: m.model_name, model_id: m.model_id, status: 'active', is_playground: true, is_favorite: m.is_favorite },
              $setOnInsert: { created_at: new Date().toISOString() }
            },
            { upsert: true }
          );
        }
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
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
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
