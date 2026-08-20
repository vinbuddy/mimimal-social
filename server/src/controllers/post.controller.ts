import { NextFunction, Request, Response } from "express";
import PostModel, { MediaFile } from "../models/post.model";
import { extractMentionsAndTags, replaceHrefs } from "../shared/helpers/text-parser";
import UserModel, { USER_MODEL_HIDDEN_FIELDS } from "../models/user.model";
import mongoose, { Model } from "mongoose";
import { createPostInput, createPostSchema, editPostInput, editPostSchema } from "../schemas/post.schema";
import { uploadToCloudinary } from "../shared/helpers/cloudinary";
import cloudinary from "../shared/configs/cloudinary";
import CommentModel from "../models/comment.model";
import { getPostQueryHelper } from "../services/post.service";
import { moderateImage } from "../shared/helpers/media-moderation";
import { RequestWithUser } from "../shared/types/request";

interface RequestWithFiles extends Request {
    files: Express.Multer.File[];
}

export async function createPostHandler(_req: Request, res: Response, next: NextFunction) {
    try {
        const req = _req as RequestWithFiles;
        const { postBy, caption } = createPostSchema.parse(req.body) as createPostInput;

        const files = req.files as Express.Multer.File[];

        let uploadedFiles: MediaFile[] = [];
        if (files && files.length > 0) {
            const uploadPromises = files.map((file) => {
                let uploadPromise = uploadToCloudinary(file, "posts");
                return uploadPromise;
            });
            uploadedFiles = await Promise.all(uploadPromises);
        }

        if (uploadedFiles.length > 0) {
            // Check image moderation, check if has any image that is not safe -> delete all uploaded files
            const imageModerationPromises = uploadedFiles.map((file) => moderateImage(file.url));
            const imageModerationResults = await Promise.all(imageModerationPromises);

            const isNotSafe = imageModerationResults.some((result) => result === false);

            if (isNotSafe) {
                const promises = uploadedFiles.map((file) => cloudinary.uploader.destroy(file.publicId));
                await Promise.all(promises);

                return res.status(400).json({ message: "Image contains nudity, please upload another image" });
            }
        }

        const { mentions: mentionUsernames, tags } = extractMentionsAndTags(caption);

        const formatCaption = await replaceHrefs(caption);

        const mentionUserIds: any = [];
        const userInMentions = await UserModel.find({
            username: { $in: mentionUsernames },
        });
        userInMentions.forEach((user) => {
            const userId = new mongoose.Types.ObjectId(user._id);
            mentionUserIds.push(userId);
        });

        const newPost = await PostModel.create({
            postBy: new mongoose.Types.ObjectId(postBy),
            caption: formatCaption,
            mentions: mentionUserIds,
            tags,
            mediaFiles: (uploadedFiles as MediaFile[]) ?? [],
        });

        await newPost.save();

        const post = await PostModel.populate(newPost, [
            { path: "postBy", select: USER_MODEL_HIDDEN_FIELDS },
            { path: "mentions", select: USER_MODEL_HIDDEN_FIELDS },
        ]);

        return res.status(200).json({ message: "Create post successfully", data: post });
    } catch (error) {
        next(error);
    }
}

export async function editPostHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const { caption, postId } = editPostSchema.parse(req.body) as editPostInput;

        const { mentions: mentionUsernames, tags } = extractMentionsAndTags(caption);

        const formatCaption = await replaceHrefs(caption);

        const mentionUserIds: any = [];
        const userInMentions = await UserModel.find({
            username: { $in: mentionUsernames },
        });
        userInMentions.forEach((user) => {
            const userId = new mongoose.Types.ObjectId(user._id);
            mentionUserIds.push(userId);
        });

        const updatedPost = await PostModel.findByIdAndUpdate(postId, {
            caption: formatCaption,
            mentions: mentionUserIds,
            tags,
            isEdited: true,
        });

        if (!updatedPost) {
            return res.status(404).json({ message: "Post not found" });
        }

        const post = await PostModel.populate(updatedPost, [
            { path: "postBy", select: USER_MODEL_HIDDEN_FIELDS },
            { path: "mentions", select: USER_MODEL_HIDDEN_FIELDS },
        ]);

        return res.status(200).json({ message: "Edit post successfully", data: post });
    } catch (error) {
        next(error);
    }
}

export async function deletePostHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const id = req.params.id;

        if (!id) {
            return res.status(400).json({ message: "Post ID is required" });
        }

        const post = await PostModel.findById(id);

        const mediaFiles: MediaFile[] | null = post && post.mediaFiles;

        if (mediaFiles && mediaFiles.length > 0) {
            const promises = mediaFiles.map((file) => cloudinary.uploader.destroy(file.publicId));
            await Promise.all(promises);
        }

        await PostModel.findByIdAndDelete(id);
        await CommentModel.deleteMany({ target: new mongoose.Types.ObjectId(id) });

        return res.status(200).json({ message: "Delete post successfully" });
    } catch (error) {
        next(error);
    }
}

export async function getAllPostsHandler(_req: Request, res: Response, next: NextFunction) {
    try {
        const req = _req as RequestWithUser;
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 15;

        // Me: Blocked some users
        const currentUserId = req.user._id?.toString();
        const currentUser = await UserModel.findById(currentUserId);
        const blockedUsers = currentUser?.blockedUsers ?? [];

        // Users: Blocked me
        const blockedByUsers = await UserModel.find({
            blockedUsers: {
                $in: [new mongoose.Types.ObjectId(currentUserId)],
            },
        }).distinct("_id");

        const condition = {
            $or: [
                { postBy: currentUser?._id }, // Include my posts
                { postBy: { $nin: [...blockedUsers, ...blockedByUsers] } }, // Exclude posts from both blocked and blocking users
            ],
        };

        const skip = (Number(page) - 1) * limit;
        const totalPosts = await PostModel.countDocuments(condition);
        const totalPages = Math.ceil(totalPosts / limit);

        const posts = await PostModel.aggregate([
            {
                $match: condition,
            },
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limit },
            ...getPostQueryHelper.postLookups,
            ...getPostQueryHelper.originalPostLookups,
            {
                $project: {
                    ...getPostQueryHelper.projectFields,
                    comment: 0,
                },
            },
        ]);

        return res
            .status(200)
            .json({ message: "Get all posts successfully", data: posts, totalPosts, totalPages, page, limit });
    } catch (error) {
        next(error);
    }
}

export async function getFollowingPostsHandler(req: Request, res: Response, next: NextFunction) {
    try {
        // const req = _req as RequestWithUser;

        const userId = req.query.userId;
        // const userId = req.user._id?.toString();
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 15;

        const skip = (Number(page) - 1) * limit;

        const user = await UserModel.findById(userId);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const followingIds = user?.followings ?? [];

        const totalPosts = await PostModel.countDocuments({
            postBy: { $in: followingIds }, // Get following posts
        });
        const totalPages = Math.ceil(totalPosts / limit);

        const posts = await PostModel.aggregate([
            { $match: { postBy: { $in: followingIds } } },
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limit },
            ...getPostQueryHelper.postLookups,
            ...getPostQueryHelper.originalPostLookups,
            {
                $project: {
                    ...getPostQueryHelper.projectFields,
                    comment: 0,
                },
            },
        ]);

        return res
            .status(200)
            .json({ message: "Get following posts successfully", data: posts, totalPosts, totalPages, page, limit });
    } catch (error) {
        next(error);
    }
}

export async function getPostDetailHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const postId = req.params.id;

        if (!postId) {
            return res.status(400).json({ message: "Post ID is required" });
        }

        const post = await PostModel.aggregate([
            { $match: { _id: new mongoose.Types.ObjectId(postId) } },
            {
                // Join postBy field with users collection
                $lookup: {
                    from: "users",
                    localField: "postBy",
                    foreignField: "_id",
                    as: "postBy",
                },
            },
            { $unwind: "$postBy" }, // Deconstruct postBy array to object
            {
                $lookup: {
                    from: "users",
                    localField: "mentions",
                    foreignField: "_id",
                    as: "mentions",
                },
            },
            {
                $lookup: {
                    from: "comments",
                    localField: "_id",
                    foreignField: "target",
                    as: "comments",
                },
            },
            {
                $addFields: {
                    likeCount: { $size: "$likes" },
                    commentCount: { $size: "$comments" },
                },
            },
            {
                $project: {
                    "postBy.password": 0, // Exclude sensitive fields
                    "postBy.refreshToken": 0,
                    "postBy.__v": 0,
                    "mentions.password": 0,
                    "mentions.refreshToken": 0,
                    "mentions.__v": 0,
                    comments: 0, // Exclude comments array
                },
            },
        ]);
        return res.status(200).json({ message: "Get post detail successfully", data: post[0] });
    } catch (error) {
        next(error);
    }
}

export async function getLikedPostsHandler(_req: Request, res: Response, next: NextFunction) {
    try {
        const req = _req as RequestWithUser;

        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 15;

        // Me: Blocked some users
        const currentUserId = req.user._id?.toString();
        const currentUser = await UserModel.findById(currentUserId);
        const blockedUsers = currentUser?.blockedUsers ?? [];

        // Users: Blocked me
        const blockedByUsers = await UserModel.find({
            blockedUsers: {
                $in: [new mongoose.Types.ObjectId(currentUserId)],
            },
        }).distinct("_id");

        const condition = {
            $and: [
                { likes: { $in: [currentUser?._id] } }, // Include my liked posts
                { postBy: { $nin: [...blockedUsers, ...blockedByUsers] } }, // Exclude posts from both blocked and blocking users
            ],
        };

        const skip = (page - 1) * limit;

        const totalPosts = await PostModel.countDocuments(condition);
        const totalPages = Math.ceil(totalPosts / limit);

        const posts = await PostModel.aggregate([
            { $match: condition },
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limit },
            ...getPostQueryHelper.postLookups,
            ...getPostQueryHelper.originalPostLookups,
            {
                $project: {
                    ...getPostQueryHelper.projectFields,
                    comment: 0,
                },
            },
        ]);

        return res
            .status(200)
            .json({ message: "Get following posts successfully", data: posts, totalPosts, totalPages, page, limit });
    } catch (error) {
        next(error);
    }
}

export async function getUserPostsHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const userId = req.query.userId as string;
        const type = req.query.type as "repost" | "post";
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 15;

        const skip = (page - 1) * limit;

        const user = await UserModel.findById(userId);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        let condition: any = {
            postBy: new mongoose.Types.ObjectId(userId),
        };

        if (type === "repost") {
            condition = {
                reposts: { $in: [new mongoose.Types.ObjectId(userId)] },
            };
        }
        const totalPosts = await PostModel.countDocuments(condition);
        const totalPages = Math.ceil(totalPosts / limit);

        const posts = await PostModel.aggregate([
            { $match: condition },
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limit },
            ...getPostQueryHelper.postLookups,
            ...getPostQueryHelper.originalPostLookups,
            {
                $project: {
                    ...getPostQueryHelper.projectFields,
                    comment: 0,
                },
            },
        ]);

        return res
            .status(200)
            .json({ message: "Get following posts successfully", data: posts, totalPosts, totalPages, page, limit });
    } catch (error) {
        next(error);
    }
}

export async function likePostHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const { postId, userId } = req.body;

        const updatedPost = await PostModel.findByIdAndUpdate(postId, {
            $push: { likes: userId },
        });

        if (!updatedPost) {
            return res.status(404).json({ message: "Post not found" });
        }

        const post = await PostModel.populate(updatedPost, [
            { path: "postBy", select: USER_MODEL_HIDDEN_FIELDS },
            { path: "mentions", select: USER_MODEL_HIDDEN_FIELDS },
        ]);

        return res.status(200).json({ message: "Post liked successfully", data: post });
    } catch (error) {
        next(error);
    }
}

export async function unlikePostHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const { postId, userId } = req.body;

        const updatedPost = await PostModel.findByIdAndUpdate(postId, {
            $pull: { likes: userId },
        });

        if (!updatedPost) {
            return res.status(404).json({ message: "Post not found" });
        }

        const post = await PostModel.populate(updatedPost, [
            { path: "postBy", select: USER_MODEL_HIDDEN_FIELDS },
            { path: "mentions", select: USER_MODEL_HIDDEN_FIELDS },
        ]);

        return res.status(200).json({ message: "Post unliked successfully", data: post });
    } catch (error) {
        next(error);
    }
}

export async function repostHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const { postId, userId } = req.body;

        const post = await PostModel.findById(postId);

        if (!post) {
            return res.status(404).json({ message: "Post not found" });
        }

        const repostedPost = await PostModel.create({
            postBy: new mongoose.Types.ObjectId(userId),
            originalPost: new mongoose.Types.ObjectId(postId),
        });

        await PostModel.findByIdAndUpdate(postId, {
            $push: { reposts: userId },
        });

        await repostedPost.save();

        const newPost = await PostModel.populate(repostedPost, [
            { path: "postBy", select: USER_MODEL_HIDDEN_FIELDS },
            { path: "mentions", select: USER_MODEL_HIDDEN_FIELDS },
        ]);

        return res.status(200).json({ message: "Repost post successfully", data: newPost });
    } catch (error) {
        next(error);
    }
}

export async function unRepostHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const { originalPostId, postId, userId } = req.body;

        const post = await PostModel.findById(postId);

        if (!post) {
            return res.status(404).json({ message: "Post not found" });
        }

        await PostModel.findByIdAndUpdate(originalPostId, {
            $pull: { reposts: userId },
        });
        await PostModel.findByIdAndDelete(postId);

        return res.status(200).json({ message: "Unrepost post successfully" });
    } catch (error) {
        next(error);
    }
}

// Post Activities
export async function getUsersLikedPostHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const postId = req.params.id;
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 5;

        if (!postId) {
            return res.status(400).json({ message: "Post ID is required" });
        }

        const post = await PostModel.findById(postId);

        if (!post) {
            return res.status(404).json({ message: "Post not found" });
        }

        // Pagination
        const skip = (Number(page) - 1) * limit;
        const totalUsers = post.likes.length;
        const totalPages = Math.ceil(totalUsers / limit);

        // Get users with pagination
        const users = await UserModel.find({
            _id: { $in: post.likes },
        })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .select(USER_MODEL_HIDDEN_FIELDS);

        return res
            .status(200)
            .json({ message: "Get users liked post successfully", data: users, totalUsers, totalPages, page, limit });
    } catch (error) {
        next(error);
    }
}

export async function getUsersRepostedPostHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const postId = req.params.id;
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 5;

        if (!postId) {
            return res.status(400).json({ message: "Post ID is required" });
        }

        const post = await PostModel.findById(postId);

        if (!post) {
            return res.status(404).json({ message: "Post not found" });
        }

        // Pagination
        const skip = (Number(page) - 1) * limit;
        const totalUsers = post.likes.length;
        const totalPages = Math.ceil(totalUsers / limit);

        const users = await UserModel.find({
            _id: { $in: post.reposts },
        })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .select(USER_MODEL_HIDDEN_FIELDS);

        return res.status(200).json({
            message: "Get users reposted post successfully",
            data: users,
            totalUsers,
            totalPages,
            page,
            limit,
        });
    } catch (error) {
        next(error);
    }
}
