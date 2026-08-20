import { CookieOptions, NextFunction, Request, Response } from "express";
import logger from "../shared/configs/logger";
import UserModel, { User, USER_MODEL_HIDDEN_FIELDS } from "../models/user.model";
import {
    CreateUserInput,
    LoginUserInput,
    OTPInput,
    OTPResetPasswordInput,
    loginSchema,
    otpResetPasswordSchema,
    otpSchema,
    registerSchema,
} from "../schemas/auth.schema";
import { generateToken } from "../shared/helpers/jwt";
import bcrypt from "bcrypt";
import { sendEmail } from "../shared/helpers/email-sender";
import otpGenerator from "otp-generator";
import { OTPModel } from "../models/otp.model";
import jwt from "jsonwebtoken";
import env from "dotenv";

env.config();

interface RequestWithUser extends Request {
    user: User;
}

const cookieOptions = {
    httpOnly: true,
    secure: process.env.ENVIRONMENT === "production",
    path: "/",
    sameSite: process.env.ENVIRONMENT === "production" ? "none" : "strict",
} as CookieOptions;

export async function registerHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const userInput: CreateUserInput = registerSchema.parse(req.body);

        const isExists = await UserModel.findOne({
            $or: [{ email: userInput.email }, { username: userInput.username }],
        });

        if (isExists) {
            return res.status(400).json({ message: "Email or username is already exists" });
        }

        // Check otp is already exists in the database
        const otpExists = await OTPModel.findOne({ email: userInput.email, type: "register" });

        if (otpExists) {
            await OTPModel.findOneAndDelete({ email: userInput.email, type: "register" });
        }

        // Send OTP to the user's email address
        const otp = otpGenerator.generate(6, {
            digits: true,
            lowerCaseAlphabets: false,
            upperCaseAlphabets: false,
            specialChars: false,
        });

        await sendEmail(
            process.env.EMAIL_APP_USER as string,
            userInput.email,
            "OTP for Minimal Social",
            `Your OTP is ${otp}. This OTP will expire in 5 minutes.`
        );

        // Create otp and save it to the database
        const otpModel = new OTPModel({
            username: userInput.email,
            password: userInput.password,
            email: userInput.email,
            otp,
            type: "register",
        });

        await otpModel.save();

        return res.status(200).json({ message: "OTP sent to your email address", toEmail: userInput.email });
    } catch (error) {
        next(error);
    }
}

export async function verifyOTPHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const otpInput: OTPInput = otpSchema.parse(req.body);
        const { email, otp } = otpInput;

        const otpData = await OTPModel.findOne({ email });
        if (!otpData) {
            return res.status(400).json({ message: "Invalid or expired OTP" });
        }

        const isMatch = await bcrypt.compare(otp, otpData.otp);

        if (!isMatch) {
            return res.status(400).json({ message: "Invalid OTP" });
        }

        const newUser = new UserModel({ email: otpData.email, username: otpData.username, password: otpData.password });
        await newUser.save();

        return res.status(200).json({ message: "User registered successfully", data: newUser });
    } catch (error) {
        next(error);
    }
}

export async function loginHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const { email, password }: LoginUserInput = loginSchema.parse(req.body);

        const user = await UserModel.findOne({ email })
            .populate({
                path: "blockedUsers",
                select: USER_MODEL_HIDDEN_FIELDS,
            })
            .lean(); // Find user by email address in the database

        if (!user) {
            return res.status(400).json({ statusCode: 400, message: "User not found" });
        }

        // Compare password with the hashed password in the database using bcrypt

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(400).json({ statusCode: 400, message: "Invalid credentials" });
        }

        const accessToken = generateToken(user, "access");
        const refreshToken = generateToken(user, "refresh");

        user.refreshToken = refreshToken;
        await UserModel.findByIdAndUpdate(user._id, { refreshToken });

        const { password: _password, refreshToken: _refreshToken, ...userInfo } = user;

        return res
            .cookie("accessToken", accessToken, {
                ...cookieOptions,
                maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            })
            .cookie("refreshToken", refreshToken, {
                ...cookieOptions,
                maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
            })
            .status(200)
            .json({ statusCode: 200, data: userInfo, accessToken, refreshToken });
    } catch (error) {
        next(error);
    }
}

export async function logoutHandler(_req: Request, res: Response, next: NextFunction) {
    try {
        const req = _req as RequestWithUser;
        if (!req?.user) {
            return res.status(401).json({ statusCode: 401, message: "You are not authorized" });
        }

        // Update refreshToken to null in the database
        await UserModel.findByIdAndUpdate(
            req.user._id,
            {
                $set: { refreshToken: null },
            },
            { new: true }
        );

        return res
            .clearCookie("accessToken", cookieOptions)
            .clearCookie("refreshToken", cookieOptions)
            .status(200)
            .json({ statusCode: 200, message: "Logged out successfully" });
    } catch (error) {
        next(error);
    }
}

export async function refreshTokenHandler(req: Request, res: Response, next: NextFunction) {
    // TODO: Implement refresh token logic
    try {
        let refreshToken = null;

        refreshToken = req.cookies.refreshToken;

        if (!refreshToken) {
            return res.status(404).json({ statusCode: 401, message: "Refresh token not found" });
        }

        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_KEY as string) as User & {
            exp: number;
            iat: number;
        };

        const user = await UserModel.findById(decoded._id);

        if (!user) {
            return res.status(404).json({ statusCode: 404, message: "User not found" });
        }

        const newAccessToken = generateToken(user, "access");
        const newRefreshToken = generateToken(user, "refresh");

        user.refreshToken = newRefreshToken;
        await user.save({ validateBeforeSave: false });

        return res
            .cookie("accessToken", newAccessToken, {
                ...cookieOptions,
                maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            })
            .cookie("refreshToken", newRefreshToken, {
                ...cookieOptions,
                maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
            })
            .status(200)
            .json({ statusCode: 200, data: user, accessToken: newAccessToken, refreshToken: newRefreshToken });
    } catch (error) {
        logger.error("Refresh token error:", error);
        next(error);
    }
}

export async function forgotPasswordHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ statusCode: 400, message: "Email is required" });
        }

        const user = await UserModel.findOne({ email });

        if (!user) {
            return res.status(404).json({ statusCode: 404, message: "User not found" });
        }

        // Check otp is already exists in the database
        const otpExists = await OTPModel.findOne({ email, type: "forgot" });

        if (otpExists) {
            await OTPModel.findOneAndDelete({ email: email, type: "forgot" });
        }

        // Send OTP to the user's email address
        const otp = otpGenerator.generate(6, {
            digits: true,
            lowerCaseAlphabets: false,
            upperCaseAlphabets: false,
            specialChars: false,
        });

        await sendEmail(
            process.env.EMAIL_APP_USER as string,
            email,
            "OTP for resetting password",
            `Your OTP is ${otp}. This OTP will expire in 5 minutes.`
        );

        // Create otp and save it to the database
        const otpModel = new OTPModel({
            email: email,
            otp,
            type: "forgot",
        });

        await otpModel.save();

        return res
            .status(200)
            .json({ statusCode: 200, message: "OTP sent to your email address", toEmail: email });
    } catch (error) {
        next(error);
    }
}

export async function verifyForgotPasswordOTPHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const otpInput: OTPInput = otpSchema.parse(req.body);
        const { email, otp } = otpInput;

        const otpData = await OTPModel.findOne({ email, type: "forgot" });
        if (!otpData) {
            return res.status(400).json({ message: "Invalid or expired OTP" });
        }

        const isMatch = await bcrypt.compare(otp, otpData.otp);

        if (!isMatch) {
            return res.status(400).json({ message: "Invalid OTP" });
        }

        return res.status(200).json({ message: "User registered successfully" });
    } catch (error) {
        next(error);
    }
}

export async function resetPasswordHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const otpInput: OTPResetPasswordInput = otpResetPasswordSchema.parse(req.body);
        const { email, password } = otpInput;

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        await UserModel.findOneAndUpdate({ email }, { password: hashedPassword });

        return res.status(200).json({ message: "Password reset successfully" });
    } catch (error) {
        next(error);
    }
}

export async function getMeHandler(_req: Request, res: Response, next: NextFunction) {
    try {
        const req = _req as RequestWithUser;
        const id = req.user._id;

        if (!id) {
            return res.status(400).json({ statusCode: 400, message: "Id is required" });
        }

        const user = await UserModel.findById(id)
            .populate({
                path: "blockedUsers",
                select: USER_MODEL_HIDDEN_FIELDS,
            })
            .select(USER_MODEL_HIDDEN_FIELDS);

        return res.status(200).json({ statusCode: 200, data: user });
    } catch (error) {
        next(error);
    }
}

export async function googleAuthCallbackHandler(_req: Request, res: Response, next: NextFunction) {
    try {
        const req = _req as RequestWithUser;

        const user = req.user;

        // Generate access token and refresh token
        const accessToken = generateToken(user, "access");
        const refreshToken = generateToken(user, "refresh");

        user.refreshToken = refreshToken;
        await UserModel.findByIdAndUpdate(user._id, { refreshToken });

        const { password: _password, refreshToken: _refreshToken, ...userInfo } = user;

        req.logout((err) => {
            if (err) {
                return next(err);
            }

            return res
                .cookie("accessToken", accessToken, {
                    ...cookieOptions,
                    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
                })
                .cookie("refreshToken", refreshToken, {
                    ...cookieOptions,
                    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
                })
                .redirect(`${process.env.CLIENT_BASE_URL as string}/login`);
        });
    } catch (error) {
        logger.error("Google auth callback error:", error);
        next(error);
    }
}
