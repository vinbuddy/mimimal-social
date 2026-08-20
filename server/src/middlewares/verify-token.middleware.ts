import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { User } from "../modules/users/user.model";
import cookieMode from "../shared/configs/cookie";

dotenv.config();

export const verifyToken = (req: Request, res: Response, next: NextFunction) => {
    let accessToken = null;

    accessToken = req.cookies["accessToken"];

    if (!accessToken) {
        return res.status(403).json({ message: "No access token provided" });
    }

    try {
        const accessKey = process.env.JWT_ACCESS_KEY as string;
        jwt.verify(accessToken, accessKey, (err: any, user: any) => {
            if (err?.name === "TokenExpiredError") {
                return res.status(401).json({ message: "Token expired" });
            }

            req.user = user as User;
            next();
        });
    } catch (error: any) {
        return res.status(401).json({ message: "Invalid token" });
    }
};

export const verifyAdminToken = (req: Request, res: Response, next: NextFunction) => {
    verifyToken(req, res, () => {
        const user = req.user as User;

        if (!user) return res.status(403).json({ message: "Unauthorized" });

        if (user?.isAdmin) {
            next();
        } else {
            return res.status(403).json({ message: "You are not allowed" });
        }
    });
};
