import { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";

import UserModel, { USER_MODEL_HIDDEN_FIELDS } from "./user.model";
import { FollowModel } from "./follow.model";
import { BlockModel } from "./block.model";
import { FollowUserInput, followUserSchema } from "./user.schema";
import { MediaFile } from "../posts/post.model";

import cloudinary from "../../shared/configs/cloudinary";
import { uploadToCloudinary } from "../../shared/helpers/cloudinary";
import { RequestWithUser } from "../../shared/types/request";

interface RequestWithFile extends Request {
    file: Express.Multer.File;
}

export async function getUsersHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const users = await UserModel.find().select(USER_MODEL_HIDDEN_FIELDS);

        return res.status(200).json({ statusCode: 200, data: users });
    } catch (error) {
        next(error);
    }
}

export async function getUserHandler(_req: Request, res: Response, next: NextFunction) {
    try {
        const req = _req as RequestWithUser;
        const id = req.params.id;
        const currentUserId = req.user?._id?.toString();

        if (!id) {
            return res.status(400).json({ statusCode: 400, message: "Id is required" });
        }

        const currentUser = await UserModel.findById(currentUserId);

        const user = await UserModel.findById(id).select(USER_MODEL_HIDDEN_FIELDS);

        // Check if currentUser is blocked by user accessing
        const isBlocked = await BlockModel.findOne({ blocker: id, blocked: currentUserId });

        if (isBlocked) {
            return res.status(403).json({ message: "You are blocked by this user" });
        }

        return res.status(200).json({ statusCode: 200, data: user });
    } catch (error) {
        next(error);
    }
}

export async function searchUserHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const query = req.query.query as string;

        const users = await UserModel.find({
            $or: [{ username: { $regex: query, $options: "i" } }],
        }).select(USER_MODEL_HIDDEN_FIELDS);

        return res.status(200).json({ statusCode: 200, data: users });
    } catch (error) {
        next(error);
    }
}

export async function followUserHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const { userId, currentUserId } = followUserSchema.parse(req.body) as FollowUserInput;

        if (currentUserId === userId) {
            return res.status(400).json({ message: "You cannot follow yourself" });
        }

        const userToFollow = await UserModel.findById(userId);
        const currentUser = await UserModel.findById(currentUserId);

        if (!userToFollow || !currentUser) {
            return res.status(404).json({ message: "User not found" });
        }

        const existingFollow = await FollowModel.findOne({ follower: currentUserId, following: userId });
        if (existingFollow) {
            return res.status(400).json({ message: "Already following this user" });
        }

        await FollowModel.create({ follower: currentUserId, following: userId });

        return res.status(200).json({ message: "User followed successfully" });
    } catch (error) {
        next(error);
    }
}

export async function unfollowUserHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const { userId, currentUserId } = followUserSchema.parse(req.body) as FollowUserInput;

        if (currentUserId === userId) {
            return res.status(400).json({ message: "You cannot unfollow yourself" });
        }

        const deleteResult = await FollowModel.deleteOne({ follower: currentUserId, following: userId });
        if (deleteResult.deletedCount === 0) {
            return res.status(400).json({ message: "You are not following this user" });
        }

        return res.status(200).json({ message: "User unfollowed successfully" });
    } catch (error) {
        next(error);
    }
}

export async function getFollowSuggestionsHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const userId = req.query.userId as string;

        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 15;

        const user = await UserModel.findById(userId);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const skip = (Number(page) - 1) * limit;
        const followingDocs = await FollowModel.find({ follower: userId }).select('following');
        const followingIds = followingDocs.map(f => f.following);

        const totalUsers = await UserModel.countDocuments({
            _id: { $ne: userId, $nin: followingIds }, // Except yourself and users you already follow
        });
        const totalPages = Math.ceil(totalUsers / limit);

        const suggestions = await UserModel.find({
            _id: { $ne: userId, $nin: followingIds },
        })
            .skip(skip)
            .limit(limit)
            .select(USER_MODEL_HIDDEN_FIELDS);

        return res.status(200).json({ statusCode: 200, data: suggestions, totalPages, totalUsers, page, limit });
    } catch (error) {
        next(error);
    }
}

export async function editProfileHandler(_req: Request, res: Response, next: NextFunction) {
    try {
        const req = _req as RequestWithFile & RequestWithUser;
        const { bio, username } = req.body;
        const userId = req.user?._id?.toString();

        if (!userId) {
            return res.status(400).json({ statusCode: 400, message: "Id is required" });
        }

        let mediaFile: MediaFile | null = null;

        if (req.file) {
            mediaFile = await uploadToCloudinary(req.file, "avatar");
        }

        const updateValue: any = {};

        if (mediaFile) {
            updateValue["photo"] = mediaFile.url;
            updateValue["photoPublicId"] = mediaFile.publicId;
        }

        if (username) {
            updateValue["username"] = req.body.username;
        }

        if (bio) {
            updateValue["bio"] = bio;
        }

        if (Object.keys(updateValue).length === 0) {
            return res.status(400).json({ message: "You must change something to edit your profile" });
        }

        const user = await UserModel.findById(userId);

        // Delete old photo from cloudinary
        if (mediaFile && user && user.photoPublicId) {
            await cloudinary.uploader.destroy(user.photoPublicId);
        }

        const updated = await UserModel.findByIdAndUpdate(userId, updateValue);

        if (!updated) {
            return res.status(404).json({ message: "User not found" });
        }

        const updatedUser = await UserModel.findById(userId).select(USER_MODEL_HIDDEN_FIELDS);

        return res.status(200).json({ message: "Profile updated successfully", data: updatedUser });
    } catch (error) {
        next(error);
    }
}

// Get followings and followers of a user
export async function getFollowingsHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const userId = req.query.userId as string;
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 15;
        const search = req.query.search as string;

        if (!userId) {
            return res.status(400).json({ statusCode: 400, message: "Id is required" });
        }

        const user = await UserModel.findById(userId);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const condition: any = { follower: new mongoose.Types.ObjectId(userId) };

        const totalUsers = await FollowModel.countDocuments(condition);
        const totalPages = Math.ceil(totalUsers / limit);
        const skip = (page - 1) * limit;

        const follows = await FollowModel.find(condition)
            .skip(skip)
            .limit(limit)
            .populate({
                path: "following",
                select: USER_MODEL_HIDDEN_FIELDS,
                match: search.trim() ? { username: { $regex: search, $options: "i" } } : undefined
            });

        // Filter out nulls if populated match failed
        const followingUsers = follows.map(f => f.following).filter(u => u);

        return res
            .status(200)
            .json({ message: "Get following successfully", data: followingUsers, totalUsers, totalPages, page, limit });
    } catch (error) {
        next(error);
    }
}

export async function getFollowersHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const userId = req.query.userId as string;
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 15;
        const search = req.query.search as string;

        if (!userId) {
            return res.status(400).json({ statusCode: 400, message: "Id is required" });
        }

        const user = await UserModel.findById(userId);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const condition: any = { following: new mongoose.Types.ObjectId(userId) };

        const totalUsers = await FollowModel.countDocuments(condition);
        const totalPages = Math.ceil(totalUsers / limit);
        const skip = (page - 1) * limit;

        const follows = await FollowModel.find(condition)
            .skip(skip)
            .limit(limit)
            .populate({
                path: "follower",
                select: USER_MODEL_HIDDEN_FIELDS,
                match: search.trim() ? { username: { $regex: search, $options: "i" } } : undefined
            });

        const followerUsers = follows.map(f => f.follower).filter(u => u);

        return res
            .status(200)
            .json({ message: "Get followers successfully", data: followerUsers, totalUsers, totalPages, page, limit });
    } catch (error) {
        next(error);
    }
}
