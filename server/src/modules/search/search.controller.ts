import { NextFunction, Request, Response } from "express";
import PostModel from "../posts/post.model";
import UserModel from "../users/user.model";
import { getPostQueryHelper } from "../posts/post.service";

export async function autocompleteHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const query = req.query.query as string;

        if (!query) {
            return res.status(400).json({ error: 'Query parameter "query" is required' });
        }

        const users = await UserModel.find({ username: { $regex: query, $options: "i" } }).limit(10);

        return res.status(200).json({ message: "Success", data: users });
    } catch (error) {
        next(error);
    }
}

export async function searchPostsHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const query = req.query.query as string;
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 15;

        if (!query) {
            return res.status(400).json({ error: 'Query parameter "query" is required' });
        }

        const skip = (Number(page) - 1) * limit;
        const totalPosts = await PostModel.countDocuments({ $text: { $search: query } });
        const totalPages = Math.ceil(totalPosts / limit);

        const posts = await PostModel.aggregate([
            { $match: { $text: { $search: query.trim() } } },
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

        return res.status(200).json({ message: "Success", data: posts, totalPosts, totalPages, page, limit });
    } catch (error) {
        next(error);
    }
}
