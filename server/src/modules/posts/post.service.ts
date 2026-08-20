export const getPostQueryHelper = {
    postLookups: [
        {
            $lookup: {
                from: "users",
                localField: "postBy",
                foreignField: "_id",
                as: "postBy",
            },
        },
        { $unwind: "$postBy" },
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
                likeCount: { $size: { $ifNull: ["$likes", []] } },
                commentCount: { $size: { $ifNull: ["$comments", []] } },
                repostCount: { $size: { $ifNull: ["$reposts", []] } },
            },
        },
    ],
    originalPostLookups: [
        {
            $lookup: {
                from: "posts",
                localField: "originalPost",
                foreignField: "_id",
                as: "originalPost",
            },
        },
        { $unwind: { path: "$originalPost", preserveNullAndEmptyArrays: true } },
        {
            $lookup: {
                from: "users",
                localField: "originalPost.postBy",
                foreignField: "_id",
                as: "originalPost.postBy",
            },
        },
        { $unwind: { path: "$originalPost.postBy", preserveNullAndEmptyArrays: true } },
        {
            $lookup: {
                from: "users",
                localField: "originalPost.mentions",
                foreignField: "_id",
                as: "originalPost.mentions",
            },
        },
        {
            $lookup: {
                from: "comments",
                localField: "originalPost._id",
                foreignField: "target",
                as: "originalPost.comments",
            },
        },
        {
            $addFields: {
                "originalPost.likeCount": { $size: { $ifNull: ["$originalPost.likes", []] } },
                "originalPost.commentCount": { $size: { $ifNull: ["$originalPost.comments", []] } },
                "originalPost.repostCount": { $size: { $ifNull: ["$originalPost.reposts", []] } },
            },
        },
    ],
    projectFields: {
        "postBy.password": 0,
        "postBy.refreshToken": 0,
        "postBy.__v": 0,
        "mentions.password": 0,
        "mentions.refreshToken": 0,
        "mentions.__v": 0,
        "originalPost.comments": 0,
        "originalPost.postBy.password": 0,
        "originalPost.postBy.refreshToken": 0,
        "originalPost.postBy.__v": 0,
        "originalPost.mentions.password": 0,
        "originalPost.mentions.refreshToken": 0,
        "originalPost.mentions.__v": 0,
    },
};
