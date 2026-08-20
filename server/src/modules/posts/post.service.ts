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
            $lookup: {
                from: "postlikes",
                localField: "_id",
                foreignField: "post",
                as: "likes",
            },
        },
        {
            $lookup: {
                from: "posts",
                localField: "_id",
                foreignField: "originalPost",
                as: "reposts",
            },
        },
        {
            $addFields: {
                likeCount: { $size: { $ifNull: ["$likes", []] } },
                commentCount: { $size: { $ifNull: ["$comments", []] } },
                repostCount: { $size: { $ifNull: ["$reposts", []] } },
            },
        },
        { $project: { likes: 0, reposts: 0 } }, // exclude heavy arrays from final doc
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
            $lookup: {
                from: "postlikes",
                localField: "originalPost._id",
                foreignField: "post",
                as: "originalPost.likes",
            },
        },
        {
            $lookup: {
                from: "posts",
                localField: "originalPost._id",
                foreignField: "originalPost",
                as: "originalPost.reposts",
            },
        },
        {
            $addFields: {
                "originalPost.likeCount": { $size: { $ifNull: ["$originalPost.likes", []] } },
                "originalPost.commentCount": { $size: { $ifNull: ["$originalPost.comments", []] } },
                "originalPost.repostCount": { $size: { $ifNull: ["$originalPost.reposts", []] } },
            },
        },
        { $project: { "originalPost.likes": 0, "originalPost.reposts": 0 } },
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
