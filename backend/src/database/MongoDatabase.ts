import { MongoClient } from "mongodb";
import type { Db } from "mongodb";

import type { AppConfig } from "../config/env.js";

export class MongoDatabase {
  private client: MongoClient | null = null;
  private database: Db | null = null;
  private connecting: Promise<Db> | null = null;

  constructor(private readonly config: AppConfig) {}

  async connect(): Promise<Db> {
    if (this.database) {
      return this.database;
    }

    if (this.connecting) {
      return this.connecting;
    }

    this.connecting = this.openConnection();

    try {
      return await this.connecting;
    } finally {
      this.connecting = null;
    }
  }

  async ping(): Promise<boolean> {
    try {
      const database = await this.connect();
      await database.command({ ping: 1 });
      return true;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    const client = this.client;

    this.client = null;
    this.database = null;

    if (client) {
      await client.close();
    }
  }

  private async openConnection(): Promise<Db> {
    const client = new MongoClient(this.config.mongodbUri, {
      serverSelectionTimeoutMS: this.config.mongodbConnectTimeoutMs,
      maxPoolSize: 10
    });

    try {
      await client.connect();
      const database = client.db(this.config.mongodbDbName);

      this.client = client;
      this.database = database;
      return database;
    } catch (error) {
      await client.close().catch(() => undefined);
      throw error;
    }
  }
}
