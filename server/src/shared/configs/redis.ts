import Redis from "ioredis";
import envConfig from "./env";
import logger from "./logger";

// Main redis client for caching and standard operations
export const redisClient = new Redis(envConfig.REDIS_URL || "redis://localhost:6379", {
    maxRetriesPerRequest: null,
});

redisClient.on("error", (error) => {
    logger.error("Redis Connection Error:", error);
});

redisClient.on("connect", () => {
    logger.info("✅ Redis connected successfully");
});

// Pub/Sub clients for Socket.IO Redis Adapter
export const pubClient = new Redis(envConfig.REDIS_URL || "redis://localhost:6379");
export const subClient = pubClient.duplicate();

export default redisClient;
