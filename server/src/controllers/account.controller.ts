import { NextFunction, Request, Response } from "express";
import bcrypt from "bcrypt";
import otpGenerator from "otp-generator";

import { OTPInput, otpSchema } from "../schemas/auth.schema";

import { RequestWithUser } from "../shared/types/request";
import UserModel, { USER_MODEL_HIDDEN_FIELDS } from "../models/user.model";
import { OTPModel } from "../models/otp.model";
import { sendEmail } from "../shared/helpers/email-sender";
import { changePasswordSchema } from "../schemas/account.schema";
import mongoose from "mongoose";

export async function changePasswordHandler(_req: Request, res: Response, next: NextFunction) {
    try {
        const req = _req as RequestWithUser;
        const { password, newPassword } = changePasswordSchema.parse(req.body);

        const user = await UserModel.findById(req.user._id);

        if (!user) {
            return res.status(404).json({ statusCode: 404, message: "User not found" });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(400).json({ statusCode: 400, message: "Invalid password" });
        }

        // create otp
        const otpExists = await OTPModel.findOne({ email: user.email, type: "change" });

        if (otpExists) {
            await OTPModel.findOneAndDelete({ email: user.email, type: "change" });
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
            user.email,
            "OTP for changing password",
            `Your OTP is ${otp}. This OTP will expire in 5 minutes.`
        );

        // Create otp and save it to the database
        const otpModel = new OTPModel({
            email: user.email,
            otp,
            type: "change",
            password: newPassword,
        });

        await otpModel.save();

        return res.status(200).json({ message: "OTP sent to your email address", toEmail: user.email });
    } catch (error) {
        next(error);
    }
}

export async function verifyChangePasswordOTPHandler(_req: Request, res: Response, next: NextFunction) {
    try {
        const req = _req as RequestWithUser;
        const user = req.user;

        const otpInput: OTPInput = otpSchema.parse(req.body);
        const { otp } = otpInput;

        const userExists = await UserModel.findById(user._id);

        if (!userExists) {
            return res.status(404).json({ message: "User not found" });
        }

        const otpData = await OTPModel.findOne({ email: userExists.email, type: "change" });

        if (!otpData) {
            return res.status(400).json({ message: "Invalid or expired OTP" });
        }

        const isMatch = await bcrypt.compare(otp, otpData.otp);

        if (!isMatch) {
            return res.status(400).json({ message: "Invalid OTP" });
        }

        // Update password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(otpData.password, salt);

        await UserModel.findByIdAndUpdate(user._id, { password: hashedPassword });

        return res.status(200).json({ message: "OTP verified successfully" });
    } catch (error) {
        next(error);
    }
}

// Block and unblock user
export async function blockUserHandler(_req: Request, res: Response, next: NextFunction) {
    try {
        const req = _req as RequestWithUser;

        const blockedUserId = req.params.id;
        const userId = req.user?._id?.toString();

        if (blockedUserId === userId) {
            return res.status(400).json({ message: "You cannot block yourself" });
        }

        const user = await UserModel.findById(userId);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        if (user.blockedUsers.includes(new mongoose.Types.ObjectId(blockedUserId))) {
            return res.status(400).json({ message: "User already blocked" });
        }

        user.blockedUsers.push(new mongoose.Types.ObjectId(blockedUserId));
        await user.save();

        // Me: un-follow user blocked
        await UserModel.findByIdAndUpdate(userId, { $pull: { followings: blockedUserId } });
        await UserModel.findByIdAndUpdate(blockedUserId, { $pull: { followers: userId } });

        // Blocked user: un-follow me
        await UserModel.findByIdAndUpdate(blockedUserId, { $pull: { followings: userId } });
        await UserModel.findByIdAndUpdate(userId, { $pull: { followers: blockedUserId } });

        return res.status(200).json({ message: "User blocked successfully" });
    } catch (error) {
        next(error);
    }
}

export async function unblockUserHandler(_req: Request, res: Response, next: NextFunction) {
    try {
        const req = _req as RequestWithUser;

        const blockedUserId = req.params.id;
        const currentUserId = req.user?._id?.toString();

        const currentUser = await UserModel.findById(currentUserId);

        if (!currentUserId) {
            return res.status(404).json({ message: "User not found" });
        }

        if (!currentUser?.blockedUsers.includes(new mongoose.Types.ObjectId(blockedUserId))) {
            return res.status(400).json({ message: "User not blocked" });
        }

        await UserModel.findByIdAndUpdate(currentUserId, { $pull: { blockedUsers: blockedUserId } });

        return res.status(200).json({ message: "User unblocked successfully" });
    } catch (error) {
        next(error);
    }
}

export async function getBlockedUsersHandler(_req: Request, res: Response, next: NextFunction) {
    try {
        const req = _req as RequestWithUser;
        const page = Number(req.query.page) ?? 1;
        const limit = Number(req.query.limit) ?? 15;

        const userId = req.user?._id?.toString();

        const user = await UserModel.findById(userId);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const skip = (Number(page) - 1) * limit;
        const totalUsers = await UserModel.countDocuments({ _id: { $in: user.blockedUsers } });
        const totalPages = Math.ceil(totalUsers / limit);

        const blockedUsers = await UserModel.find({ _id: { $in: user.blockedUsers } })
            .skip(skip)
            .limit(limit)
            .select(USER_MODEL_HIDDEN_FIELDS);

        return res.status(200).json({
            message: "Get blocked users successfully",
            data: blockedUsers,
            totalPages,
            totalUsers,
            page,
            limit,
        });
    } catch (error) {
        next(error);
    }
}
