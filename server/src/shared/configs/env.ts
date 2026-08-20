import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
    // Server
    PORT: z
        .string()
        .default("5000")
        .transform(Number)
        .pipe(z.number().int().positive()),
    ENVIRONMENT: z.enum(["development", "production"]).default("development"),

    // Database
    MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),

    // Client
    CLIENT_BASE_URL: z.string().url("CLIENT_BASE_URL must be a valid URL"),

    // JWT
    JWT_ACCESS_KEY: z.string().min(1, "JWT_ACCESS_KEY is required"),
    JWT_REFRESH_KEY: z.string().min(1, "JWT_REFRESH_KEY is required"),
    JWT_ACCESS_EXPIRATION: z.string().default("7d"),
    JWT_REFRESH_EXPIRATION: z.string().default("30d"),

    // Session
    SESSION_SECRET_KEY: z.string().min(1, "SESSION_SECRET_KEY is required"),

    // Email
    EMAIL_APP_USER: z.string().min(1, "EMAIL_APP_USER is required"),
    EMAIL_APP_PASSWORD: z.string().min(1, "EMAIL_APP_PASSWORD is required"),

    // Cloudinary
    CLOUDINARY_CLOUD_NAME: z.string().min(1, "CLOUDINARY_CLOUD_NAME is required"),
    CLOUDINARY_API_KEY: z.string().min(1, "CLOUDINARY_API_KEY is required"),
    CLOUDINARY_API_SECRET: z.string().min(1, "CLOUDINARY_API_SECRET is required"),

    // Google OAuth (optional — not all environments have Google login)
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    GOOGLE_CALLBACK_URL: z.string().optional(),

    // Optional
    COOKIE_MODE: z.string().optional(),
    SIGHT_ENGINE_API_USER: z.string().optional(),
    SIGHT_ENGINE_API_KEY: z.string().optional(),
    SIGHT_ENGINE_API_URL: z.string().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

function validateEnv(): EnvConfig {
    const result = envSchema.safeParse(process.env);

    if (!result.success) {
        const formatted = result.error.issues
            .map((issue) => `  ❌ ${issue.path.join(".")}: ${issue.message}`)
            .join("\n");

        console.error(`\n🚨 Environment validation failed:\n${formatted}\n`);
        process.exit(1);
    }

    return result.data;
}

const env = validateEnv();

export default env;
