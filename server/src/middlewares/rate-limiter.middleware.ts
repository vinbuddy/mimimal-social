import rateLimit from "express-rate-limit";

/**
 * Rate limiter for authentication endpoints (login, register)
 * 15 requests per 15 minutes per IP
 */
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 15,
    message: {
        statusCode: 429,
        status: "fail",
        message: "Too many authentication attempts, please try again after 15 minutes",
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

/**
 * Rate limiter for OTP-related endpoints
 * 5 requests per 5 minutes per IP
 */
export const otpLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 5,
    message: {
        statusCode: 429,
        status: "fail",
        message: "Too many OTP requests, please try again after 5 minutes",
    },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * General API rate limiter
 * 100 requests per 15 minutes per IP
 */
export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: {
        statusCode: 429,
        status: "fail",
        message: "Too many requests, please try again later",
    },
    standardHeaders: true,
    legacyHeaders: false,
});
