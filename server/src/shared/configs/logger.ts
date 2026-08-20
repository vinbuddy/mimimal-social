import winston from "winston";
import path from "path";

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

const isProduction = process.env.ENVIRONMENT === "production";

// Custom format for development console
const devFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : "";
    return `${timestamp} [${level}]: ${stack || message}${metaStr}`;
});

// Log directory
const LOG_DIR = path.join(process.cwd(), "logs");

const logger = winston.createLogger({
    level: isProduction ? "info" : "debug",
    format: combine(
        timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        errors({ stack: true })
    ),
    defaultMeta: { service: "minimal-social-api" },
    transports: [
        // Console transport — always active
        new winston.transports.Console({
            format: isProduction
                ? combine(json())
                : combine(colorize(), devFormat),
        }),

        // Error log file
        new winston.transports.File({
            filename: path.join(LOG_DIR, "error.log"),
            level: "error",
            format: combine(json()),
            maxsize: 5 * 1024 * 1024, // 5MB
            maxFiles: 5,
        }),

        // Combined log file
        new winston.transports.File({
            filename: path.join(LOG_DIR, "combined.log"),
            format: combine(json()),
            maxsize: 10 * 1024 * 1024, // 10MB
            maxFiles: 5,
        }),
    ],
});

// Stream for Morgan HTTP logger
export const morganStream = {
    write: (message: string) => {
        logger.http(message.trim());
    },
};

export default logger;
