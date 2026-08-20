import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError } from "../shared/errors/app-error";
import logger from "../shared/configs/logger";

export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
    // Log the error
    if (err instanceof Error) {
        logger.error(`${req.method} ${req.originalUrl} — ${err.message}`, {
            stack: err.stack,
            body: req.body,
            params: req.params,
            query: req.query,
        });
    }

    // Zod validation errors
    if (err instanceof ZodError) {
        return res.status(400).json({
            statusCode: 400,
            status: "fail",
            message: "Validation error",
            errors: err.flatten(),
        });
    }

    // Custom AppError (operational errors)
    if (err instanceof AppError) {
        return res.status(err.statusCode).json({
            statusCode: err.statusCode,
            status: err.status,
            message: err.message,
        });
    }

    // Mongoose CastError (invalid ObjectId, etc.)
    if (err instanceof Error && err.name === "CastError") {
        return res.status(400).json({
            statusCode: 400,
            status: "fail",
            message: "Invalid ID format",
        });
    }

    // Mongoose duplicate key error
    if (
        err instanceof Error &&
        "code" in err &&
        (err as Record<string, unknown>).code === 11000
    ) {
        return res.status(409).json({
            statusCode: 409,
            status: "fail",
            message: "Duplicate field value — resource already exists",
        });
    }

    // JWT errors
    if (err instanceof Error && err.name === "JsonWebTokenError") {
        return res.status(401).json({
            statusCode: 401,
            status: "fail",
            message: "Invalid token",
        });
    }

    if (err instanceof Error && err.name === "TokenExpiredError") {
        return res.status(401).json({
            statusCode: 401,
            status: "fail",
            message: "Token expired",
        });
    }

    // Generic Error
    if (err instanceof Error) {
        const statusCode = (err as unknown as Record<string, unknown>).statusCode as number || 500;
        return res.status(statusCode).json({
            statusCode,
            status: "error",
            message: err.message,
            ...(process.env.ENVIRONMENT !== "production" && { stack: err.stack }),
        });
    }

    // Unknown error type
    return res.status(500).json({
        statusCode: 500,
        status: "error",
        message: "An unexpected error occurred",
    });
}
