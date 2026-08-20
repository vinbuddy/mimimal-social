import { NextFunction, Request, Response } from "express";
import PostModel, { MediaFile } from "./post.model";
import { PostLikeModel } from "./post-like.model";
import { BlockModel } from "../users/block.model";
import { FollowModel } from "../users/follow.model";
import { extractMentionsAndTags, replaceHrefs } from "../../shared/helpers/text-parser";
import UserModel, { USER_MODEL_HIDDEN_FIELDS } from "../users/user.model";
import mongoose, { Model } from "mongoose";
import { createPostInput, createPostSchema, editPostInput, editPostSchema } from "./post.schema";
import { uploadToCloudinary } from "../../shared/helpers/cloudinary";
import cloudinary from "../../shared/configs/cloudinary";
import CommentModel from "../comments/comment.model";
import { getPostQueryHelper } from "./post.service";
// import { moderateImage } from "../../shared/helpers/media-moderation";
import { RequestWithUser } from "../../shared/types/request";

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

        // Default status is pending. If no image, it's approved automatically
        const moderationStatus = uploadedFiles.length > 0 ? "pending" : "approved";

        const newPost = await PostModel.create({
            postBy: new mongoose.Types.ObjectId(postBy),
            caption: formatCaption,
            mentions: mentionUserIds,
            tags,
            mediaFiles: (uploadedFiles as MediaFile[]) ?? [],
            moderationStatus
        });

        if (uploadedFiles.length > 0) {
            // Push to background queue instead of blocking
            const { imageModerationQueue } = await import("../../shared/queues/image-moderation.queue");
            imageModerationQueue.add("moderate-images", {
                postId: newPost._id,
                mediaFiles: uploadedFiles
            });
        }

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
        const blocksByMe = await BlockModel.find({ blocker: currentUserId }).select("blocked");
        const blockedUsers = blocksByMe.map(b => b.blocked);

        // Users: Blocked me
        const blocksAgainstMe = await BlockModel.find({ blocked: currentUserId }).select("blocker");
        const blockedByUsers = blocksAgainstMe.map(b => b.blocker);

        const condition = {
            moderationStatus: { $ne: "rejected" },
            $or: [
                { postBy: new mongoose.Types.ObjectId(currentUserId) }, // Include my posts
                { postBy: { $nin: [...blockedUsers, ...blockedByUsers] } }, // Exclude posts from both blocked and blocking users
            ],
        };

        const skip = (Number(page) - 1) * limit;

        const facetResult = await PostModel.aggregate([
            { $match: condition },
            { $sort: { createdAt: -1 } },
            { $limit: 1000 }, // Optimization: Only score the top 1000 latest posts
            ...getPostQueryHelper.postLookups,
            {
                $addFields: {
                    score: {
                        $add: [
                            { $multiply: ["$likeCount", 2] },
                            { $multiply: ["$commentCount", 3] },
                            { $multiply: ["$repostCount", 1.5] }
                        ]
                    }
                }
            },
            {
                $facet: {
                    metadata: [{ $count: "total" }],
                    data: [
                        { $sort: { score: -1, createdAt: -1 } },
                        { $skip: skip },
                        { $limit: limit },
                        ...getPostQueryHelper.originalPostLookups,
                        {
                            $project: {
                                ...getPostQueryHelper.projectFields,
                                comment: 0,
                            },
                        },
                    ]
                }
            }
        ]);

        const totalPosts = facetResult[0].metadata[0]?.total || 0;
        const totalPages = Math.ceil(totalPosts / limit);
        const posts = facetResult[0].data;

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

        const followingDocs = await FollowModel.find({ follower: userId }).select("following");
        const followingIds = followingDocs.map((f: any) => f.following);

        const facetResult = await PostModel.aggregate([
            { $match: { postBy: { $in: followingIds } } },
            {
                $facet: {
                    metadata: [{ $count: "total" }],
                    data: [
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
                    ]
                }
            }
        ]);

        const totalPosts = facetResult[0].metadata[0]?.total || 0;
        const totalPages = Math.ceil(totalPosts / limit);
        const posts = facetResult[0].data;

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
        const blocksByMe = await BlockModel.find({ blocker: currentUserId }).select("blocked");
        const blockedUsers = blocksByMe.map(b => b.blocked);

        // Users: Blocked me
        const blocksAgainstMe = await BlockModel.find({ blocked: currentUserId }).select("blocker");
        const blockedByUsers = blocksAgainstMe.map(b => b.blocker);

        const myLikes = await PostLikeModel.find({ user: currentUserId }).select("post");
        const myLikedPostIds = myLikes.map(like => like.post);

        const condition = {
            $and: [
                { _id: { $in: myLikedPostIds } },
                { postBy: { $nin: [...blockedUsers, ...blockedByUsers] } },
            ],
        };

        const skip = (page - 1) * limit;

        const facetResult = await PostModel.aggregate([
            { $match: condition },
            {
                $facet: {
                    metadata: [{ $count: "total" }],
                    data: [
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
                    ]
                }
            }
        ]);

        const totalPosts = facetResult[0].metadata[0]?.total || 0;
        const totalPages = Math.ceil(totalPosts / limit);
        const posts = facetResult[0].data;

        return res
            .status(200)
            .json({ message: "Get liked posts successfully", data: posts, totalPosts, totalPages, page, limit });
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
            // Find posts where originalPost is not null and postBy is this user
            condition = {
                postBy: new mongoose.Types.ObjectId(userId),
                originalPost: { $ne: null }
            };
        }

        const facetResult = await PostModel.aggregate([
            { $match: condition },
            {
                $facet: {
                    metadata: [{ $count: "total" }],
                    data: [
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
                    ]
                }
            }
        ]);

        const totalPosts = facetResult[0].metadata[0]?.total || 0;
        const totalPages = Math.ceil(totalPosts / limit);
        const posts = facetResult[0].data;

        return res
            .status(200)
            .json({ message: "Get user posts successfully", data: posts, totalPosts, totalPages, page, limit });
    } catch (error) {
        next(error);
    }
}

export async function likePostHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const { postId, userId } = req.body;

        const postExists = await PostModel.findById(postId);
        if (!postExists) {
            return res.status(404).json({ message: "Post not found" });
        }

        const existingLike = await PostLikeModel.findOne({ post: postId, user: userId });
        if (existingLike) {
            return res.status(400).json({ message: "Post already liked" });
        }

        await PostLikeModel.create({ post: postId, user: userId });

        const post = await PostModel.populate(postExists, [
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

        const deleteResult = await PostLikeModel.deleteOne({ post: postId, user: userId });

        if (deleteResult.deletedCount === 0) {
            return res.status(400).json({ message: "You have not liked this post" });
        }

        const postExists = await PostModel.findById(postId);

        if (!postExists) {
            return res.status(404).json({ message: "Post not found" });
        }

        const post = await PostModel.populate(postExists, [
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

        const condition = { post: new mongoose.Types.ObjectId(postId) };

        // Pagination
        const skip = (Number(page) - 1) * limit;
        const totalUsers = await PostLikeModel.countDocuments(condition);
        const totalPages = Math.ceil(totalUsers / limit);

        // Get users with pagination
        const likes = await PostLikeModel.find(condition)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate({ path: "user", select: USER_MODEL_HIDDEN_FIELDS });
            
        const users = likes.map(l => l.user).filter(u => u);

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

        const condition = { originalPost: new mongoose.Types.ObjectId(postId) };

        // Pagination
        const skip = (Number(page) - 1) * limit;
        const totalUsers = await PostModel.countDocuments(condition);
        const totalPages = Math.ceil(totalUsers / limit);

        const reposts = await PostModel.find(condition)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate({ path: "postBy", select: USER_MODEL_HIDDEN_FIELDS });
            
        const users = reposts.map(r => r.postBy).filter(u => u);

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
