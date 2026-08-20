import express, { Application } from "express";
import bodyParser from "body-parser";
import cors from "cors";
import cookieParser from "cookie-parser";
import session from "express-session";
import helmet from "helmet";
import morgan from "morgan";
import mongoose from "mongoose";
import passport from "passport";
import { createServer } from "node:http";
import { Server } from "socket.io";

import envConfig from "./shared/configs/env";
import logger, { morganStream } from "./shared/configs/logger";
import { errorHandler } from "./middlewares/error-handler.middleware";
import { apiLimiter } from "./middlewares/rate-limiter.middleware";
import router from "./routes";
import socketHandlers from "./sockets";
import { initializeLoginWithGoogleService } from "./modules/auth/google.service";

// Config server
const app: Application = express();
const httpServer = createServer(app);
const PORT = envConfig.PORT;

const io = new Server(httpServer, {
    cors: {
        origin: envConfig.CLIENT_BASE_URL,
        credentials: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    },
});

// ─── Security middlewares ────────────────────────────────────
app.use(helmet());
app.use(apiLimiter);

// ─── HTTP Logging ────────────────────────────────────────────
app.use(
    morgan(
        ":method :url :status :res[content-length] - :response-time ms",
        { stream: morganStream }
    )
);

// ─── Session ─────────────────────────────────────────────────
app.use(
    session({
        secret: envConfig.SESSION_SECRET_KEY,
        resave: false,
        saveUninitialized: false, // Don't create sessions for anonymous requests
        cookie: {
            secure: envConfig.ENVIRONMENT === "production",
            sameSite: envConfig.ENVIRONMENT === "production" ? "none" : "lax",
            maxAge: 30 * 60 * 1000, // 30 minutes
        },
    })
);

// ─── Body parsing & cookies ─────────────────────────────────
app.set("io", io);
app.use(cookieParser());
app.use(cors({ credentials: true, origin: envConfig.CLIENT_BASE_URL }));
app.options("*", cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.disable("etag");

// ─── Routes ─────────────────────────────────────────────────
app.use(router);

// ─── Passport ───────────────────────────────────────────────
initializeLoginWithGoogleService();
app.use(passport.initialize());
app.use(passport.session());

// ─── Error handling ─────────────────────────────────────────
app.use(errorHandler);

// ─── Uncaught exception / rejection handlers ────────────────
process.on("uncaughtException", (error: Error) => {
    logger.error("UNCAUGHT EXCEPTION 💥 Shutting down...", {
        message: error.message,
        stack: error.stack,
    });
    process.exit(1);
});

process.on("unhandledRejection", (reason: unknown) => {
    logger.error("UNHANDLED REJECTION 💥 Shutting down...", { reason });
    httpServer.close(() => {
        process.exit(1);
    });
});

// ─── Start server ───────────────────────────────────────────
const startServer = async () => {
    try {
        await mongoose.connect(envConfig.MONGODB_URI);
        logger.info("✅ Database connected");

        // Set up Socket.io event handlers
        socketHandlers(io);

        httpServer.listen(PORT, () => {
            logger.info(`🚀 Server running on http://localhost:${PORT}`);
            logger.info(`📦 Environment: ${envConfig.ENVIRONMENT}`);
        });
    } catch (error) {
        logger.error("❌ Failed to start server:", error);
        process.exit(1);
    }
};

startServer();
