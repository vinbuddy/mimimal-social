import { NextFunction, Request, Response } from "express";
import logger from "../../shared/configs/logger";
import UserModel, { USER_MODEL_HIDDEN_FIELDS } from "../users/user.model";
import mongoose from "mongoose";
import {
    createMessageSchema,
    getMessagesQuerySchema,
    getMessagesWithCursorQuerySchema,
    getUsersReactedMessageQuerySchema,
} from "./message.schema";
import ConversationModel, { LastMessage } from "./conversation.model";
import { MediaFile } from "../posts/post.model";
import { uploadToCloudinary } from "../../shared/helpers/cloudinary";
import MessageModel, { Message } from "./message.model";
import { Server } from "socket.io";
import { RequestWithUser, RequestWithFiles } from "../../shared/types/request";

enum E_EMOJI {
    HEART = "❤️",
    HAHA = "😆",
    WOW = "😮",
    SAD = "😢",
    ANGRY = "😡",
}

export async function createMessageHandler(_req: Request, res: Response, next: NextFunction) {
    try {
        const req = _req as RequestWithFiles;
        const { senderId, conversationId, content, replyTo, stickerUrl, gifUrl } = createMessageSchema.parse(req.body);
        const files = req.files as Express.Multer.File[];

        let conversation = await ConversationModel.findOne({
            _id: new mongoose.Types.ObjectId(conversationId),
        });

        if (!conversation || !conversationId) {
            return res.status(404).json({ message: "Conversation not found" });
        }

        // Create the message
        let uploadedFiles: MediaFile[] = [];
        if (files && files.length > 0) {
            const uploadPromises = files.map((file) => {
                let uploadPromise = uploadToCloudinary(file, "messages");
                return uploadPromise;
            });
            uploadedFiles = await Promise.all(uploadPromises);
        }

        const newMessage = await MessageModel.create({
            sender: new mongoose.Types.ObjectId(senderId),
            conversation: conversation._id,
            content: content ?? null,
            replyTo: replyTo ? new mongoose.Types.ObjectId(replyTo) : null,
            mediaFiles: uploadedFiles || [],
            stickerUrl: stickerUrl ?? null,
            gifUrl: gifUrl ?? null,
            seenBy: [new mongoose.Types.ObjectId(senderId)],
        });

        const message = await MessageModel.populate(newMessage, [
            { path: "sender", select: USER_MODEL_HIDDEN_FIELDS },
            {
                path: "conversation",
                populate: {
                    path: "participants",
                    select: USER_MODEL_HIDDEN_FIELDS,
                },
            },
            {
                path: "replyTo",
            },
            {
                path: "seenBy",
                select: USER_MODEL_HIDDEN_FIELDS,
            },
        ]);

        let lastMessageContent = "Sent message";

        if (message.content) {
            lastMessageContent = message.content;
        } else if (stickerUrl) {
            lastMessageContent = "Sent sticker";
        } else if (gifUrl) {
            lastMessageContent = "Sent gif";
        } else if (uploadedFiles.length > 0) {
            lastMessageContent = "Sent photo";
        }

        const lastMessage: LastMessage = {
            sender: message.sender._id,
            content: lastMessageContent,
            createdAt: message._id.getTimestamp(),
        };

        conversation.lastMessage = lastMessage;
        conversation.hiddenBy = [];

        await conversation.save();

        // Send real time message in room
        const io = req.app.get("io") as Server;

        io.to(conversationId).emit("newMessage", message);

        return res.status(200).json({ message: "Create message successfully", data: message });
    } catch (error) {
        next(error);
    }
}

export async function getConversationMessagesHandler(_req: Request, res: Response, next: NextFunction) {
    try {
        const req = _req as RequestWithUser;

        const { conversationId, page, limit } = getMessagesQuerySchema.parse(req.query);

        const userId = req.user._id?.toString();

        const conversation = await ConversationModel.findById(conversationId);
        if (!conversation) {
            return res.status(404).json({ message: "Conversation not found" });
        }

        const isMember = conversation.participants.some((participant) => participant._id.toString() === userId);
        if (!isMember) {
            return res.status(403).json({ message: "You are not a member of this conversation" });
        }

        const condition = {
            conversation: new mongoose.Types.ObjectId(conversationId),
            excludedFor: { $nin: new mongoose.Types.ObjectId(userId) },
        };

        const skip = (Number(page) - 1) * limit;
        const totalMessages = await MessageModel.countDocuments(condition);
        const totalPages = Math.ceil(totalMessages / limit);

        const messages = await MessageModel.find(condition)
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 })
            .populate({
                path: "sender",
                select: USER_MODEL_HIDDEN_FIELDS,
            })
            .populate({
                path: "seenBy",
                select: USER_MODEL_HIDDEN_FIELDS,
            })
            .populate({
                path: "replyTo",
            })
            .populate({
                path: "conversation",
            })
            .populate({
                path: "reactions.user",
            });

        return res
            .status(200)
            .json({ message: "Get messages successfully", data: messages, totalMessages, totalPages, page, limit });
    } catch (error) {
        next(error);
    }
}

// Cursor-based pagination
export async function getMessagesWithCursorHandler(_req: Request, res: Response, next: NextFunction) {
    try {
        const req = _req as RequestWithUser;

        const { conversationId, direction, messageId, limit } = getMessagesWithCursorQuerySchema.parse(req.query);

        const userId = req.user._id?.toString();

        const conversation = await ConversationModel.findById(conversationId);
        if (!conversation) {
            return res.status(404).json({ message: "Conversation not found" });
        }

        const isMember = conversation.participants.some((participant) => participant._id.toString() === userId);
        if (!isMember) {
            return res.status(403).json({ message: "You are not a member of this conversation" });
        }

        let messages: Message[] = [];
        let hasNextPage = false;
        let hasPrevPage = false;

        if (direction === "init") {
            const messages = await MessageModel.find({
                conversation: new mongoose.Types.ObjectId(conversationId),
                excludedFor: { $nin: new mongoose.Types.ObjectId(userId) },
            })
                .limit(limit)
                .sort({ createdAt: -1 })
                .populate({
                    path: "seenBy",
                    select: USER_MODEL_HIDDEN_FIELDS,
                })
                .populate({ path: "sender", select: USER_MODEL_HIDDEN_FIELDS })
                .populate({ path: "replyTo" })
                .populate({
                    path: "conversation",
                    populate: {
                        path: "participants",
                        select: USER_MODEL_HIDDEN_FIELDS,
                        populate: {
                            path: "blockedUsers",
                            select: USER_MODEL_HIDDEN_FIELDS,
                        },
                    },
                })
                .populate({ path: "reactions.user", select: USER_MODEL_HIDDEN_FIELDS });

            // Check hasPrevPage
            if (messages.length === limit) {
                const lastMessage = messages[messages.length - 1];

                const prevMessages = await MessageModel.find({
                    conversation: new mongoose.Types.ObjectId(conversationId),
                    createdAt: { $lt: lastMessage.createdAt },
                }).limit(1);

                hasPrevPage = prevMessages.length > 0;
            }

            return res
                .status(200)
                .json({ message: "Get messages successfully", data: messages, hasNextPage, hasPrevPage });
        }

        const message = await MessageModel.findById(messageId)
            .populate({
                path: "sender",
                select: USER_MODEL_HIDDEN_FIELDS,
            })
            .populate({
                path: "seenBy",
                select: USER_MODEL_HIDDEN_FIELDS,
            })
            .populate({
                path: "replyTo",
            })
            .populate({
                path: "conversation",
                populate: {
                    path: "participants",
                    select: USER_MODEL_HIDDEN_FIELDS,
                    populate: {
                        path: "blockedUsers",
                        select: USER_MODEL_HIDDEN_FIELDS,
                    },
                },
            })
            .populate({
                path: "reactions.user",
                select: USER_MODEL_HIDDEN_FIELDS,
            });

        const condition: any = {
            conversation: new mongoose.Types.ObjectId(conversationId),
            excludedFor: { $nin: new mongoose.Types.ObjectId(userId) },
        };

        if (direction === "next" && message?.createdAt) {
            condition.createdAt = { $gt: new Date(message.createdAt) };
        }

        if (direction === "prev" && message?.createdAt) {
            condition.createdAt = { $lt: new Date(message.createdAt) };
        }

        // if both -> get message around (4 prev) and (4 next) of cursor;
        if (direction === "both" && message?.createdAt) {
            const prevMessages = await MessageModel.find({
                ...condition,
                createdAt: { $lt: new Date(message.createdAt) },
            })
                .limit(5)
                .sort({ createdAt: -1 })
                .populate({
                    path: "sender",
                    select: USER_MODEL_HIDDEN_FIELDS,
                })
                .populate({
                    path: "seenBy",
                    select: USER_MODEL_HIDDEN_FIELDS,
                })
                .populate({
                    path: "replyTo",
                })
                .populate({
                    path: "conversation",
                    populate: {
                        path: "participants",
                        select: USER_MODEL_HIDDEN_FIELDS,
                        populate: {
                            path: "blockedUsers",
                            select: USER_MODEL_HIDDEN_FIELDS,
                        },
                    },
                })
                .populate({
                    path: "reactions.user",
                    select: USER_MODEL_HIDDEN_FIELDS,
                })
                .lean();

            const nextMessages = await MessageModel.find({
                ...condition,
                createdAt: { $gt: new Date(message.createdAt) },
            })
                .limit(5)
                .sort({ createdAt: 1 })
                .populate({
                    path: "sender",
                    select: USER_MODEL_HIDDEN_FIELDS,
                })
                .populate({
                    path: "seenBy",
                    select: USER_MODEL_HIDDEN_FIELDS,
                })
                .populate({
                    path: "replyTo",
                })
                .populate({
                    path: "conversation",
                    populate: {
                        path: "participants",
                        select: USER_MODEL_HIDDEN_FIELDS,
                        populate: {
                            path: "blockedUsers",
                            select: USER_MODEL_HIDDEN_FIELDS,
                        },
                    },
                })
                .populate({
                    path: "reactions.user",
                    select: USER_MODEL_HIDDEN_FIELDS,
                })
                .lean();

            messages = [...nextMessages, message, ...prevMessages].sort((a, b) => {
                if (!a.createdAt || !b.createdAt) return 0;
                return b.createdAt.getTime() - a.createdAt.getTime();
            });
        }

        if (direction === "next" || direction === "prev") {
            messages = await MessageModel.find(condition)
                .limit(limit)
                .sort({ createdAt: direction == "next" ? 1 : -1 })
                .populate({
                    path: "seenBy",
                    select: USER_MODEL_HIDDEN_FIELDS,
                })
                .populate({ path: "sender", select: USER_MODEL_HIDDEN_FIELDS })
                .populate({ path: "replyTo" })
                .populate({
                    path: "conversation",
                    populate: {
                        path: "participants",
                        select: USER_MODEL_HIDDEN_FIELDS,
                        populate: {
                            path: "blockedUsers",
                            select: USER_MODEL_HIDDEN_FIELDS,
                        },
                    },
                })
                .populate({ path: "reactions.user", select: USER_MODEL_HIDDEN_FIELDS });

            const _message = direction === "prev" ? messages[messages.length - 1] : messages[0];

            const _messages = await MessageModel.find({
                conversation: new mongoose.Types.ObjectId(conversationId),
                createdAt: direction === "prev" ? { $lt: _message.createdAt } : { $gt: _message.createdAt },
            }).limit(1);

            hasNextPage = direction === "next" ? _messages.length > 0 : false;
            hasPrevPage = direction === "prev" ? _messages.length > 0 : false;
        }

        return res.status(200).json({ message: "Get messages successfully", data: messages, hasNextPage, hasPrevPage });
    } catch (error) {
        logger.error("Get messages with cursor error:", error);
        next(error);
    }
}

export async function reactMessageHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const { userId, emoji, conversationId } = req.body;
        const messageId = req.params.id;

        const message = await MessageModel.findById(messageId);

        if (!message) {
            return res.status(404).json({ message: "Message not found" });
        }

        const reactionIndex = message.reactions.findIndex((reaction) => reaction.user.toString() === userId);

        if (reactionIndex === -1) {
            message.reactions.push({ user: new mongoose.Types.ObjectId(userId), emoji });
            await message.save();
        } else {
            await MessageModel.updateOne(
                {
                    _id: message._id,
                    "reactions.user": new mongoose.Types.ObjectId(userId),
                },
                {
                    $set: {
                        "reactions.$.emoji": emoji,
                    },
                }
            );
        }

        const updatedMessage = await MessageModel.findById(message._id)
            .populate({
                path: "sender",
                select: USER_MODEL_HIDDEN_FIELDS,
            })
            .populate({
                path: "replyTo",
            })
            .populate({
                path: "conversation",
            })
            .populate({
                path: "reactions.user",
            });

        const io = req.app.get("io") as Server;

        io.to(conversationId).emit("reactMessage", updatedMessage);

        return res.status(200).json({ message: "React message successfully", data: updatedMessage });
    } catch (error) {
        next(error);
    }
}

export async function unreactMessageHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const { userId, conversationId } = req.body;
        const messageId = req.params.id;

        const message = await MessageModel.findById(messageId);

        if (!message) {
            return res.status(404).json({ message: "Message not found" });
        }

        const reactionIndex = message.reactions.findIndex((reaction) => reaction.user.toString() === userId);

        if (reactionIndex !== -1) {
            message.reactions.splice(reactionIndex, 1);
            await message.save();
        }

        const updatedMessage = await MessageModel.findOne({ _id: new mongoose.Types.ObjectId(messageId) })
            .populate({ path: "sender", select: USER_MODEL_HIDDEN_FIELDS })
            .populate({ path: "replyTo" })
            .populate({ path: "conversation" })
            .populate({ path: "reactions.user", select: USER_MODEL_HIDDEN_FIELDS });

        const io = req.app.get("io") as Server;

        io.to(conversationId).emit("unreactMessage", updatedMessage);

        return res.status(200).json({ message: "Unreact message successfully", data: updatedMessage });
    } catch (error) {
        next(error);
    }
}

function getEmojiFromClientInput(clientInput: string): string {
    const uppercasedInput = clientInput.toUpperCase() as keyof typeof E_EMOJI;

    if (uppercasedInput in E_EMOJI) {
        return E_EMOJI[uppercasedInput];
    }

    throw new Error(`Emoji with key "${clientInput}" not found`);
}

export async function getUsersReactedMessageHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const { emoji, messageId } = getUsersReactedMessageQuerySchema.parse(req.query);

        let emojiIcon;
        try {
            emojiIcon = getEmojiFromClientInput(emoji as string); // Ex: convert 'heart' to '❤️'
        } catch (error) {
            return res.status(400).json({ message: "Invalid emoji" });
        }

        const message = await MessageModel.findOne({
            _id: new mongoose.Types.ObjectId(messageId as string),
            reactions: { $elemMatch: { emoji: emojiIcon } },
        }).lean();

        if (!message) {
            return res.status(200).json({ message: "This message has not reacted yet", data: [] });
        }

        const filteredReactions = message.reactions.filter((reaction) => reaction.emoji === emojiIcon);

        const populatedReactions = await Promise.all(
            filteredReactions.map(async (reaction) => {
                if (reaction.user) {
                    const populatedUser = await UserModel.findById(reaction.user)
                        .select(USER_MODEL_HIDDEN_FIELDS)
                        .lean();
                    return { ...reaction, user: populatedUser };
                }
                return reaction;
            })
        );

        const populatedMessage = { ...message, reactions: populatedReactions };

        return res.status(200).json({ message: "Get users reacted message successfully", data: populatedMessage });
    } catch (error) {
        next(error);
    }
}

export async function deleteMessageHandler(_req: Request, res: Response, next: NextFunction) {
    try {
        const req = _req as RequestWithUser;
        const messageId = req.params.id;
        const userId = req.user._id?.toString();

        const message = await MessageModel.findById(messageId);

        if (!message) {
            return res.status(404).json({ message: "Message not found" });
        }

        if (message.sender.toString() !== userId) {
            return res.status(403).json({ message: "You are not the sender of this message" });
        }

        if (message.excludedFor.includes(new mongoose.Types.ObjectId(userId))) {
            return res.status(403).json({ message: "You have already deleted this message" });
        }

        await MessageModel.findByIdAndUpdate(messageId, {
            $addToSet: {
                excludedFor: new mongoose.Types.ObjectId(userId),
            },
        });

        return res.status(200).json({ message: "Delete message successfully" });
    } catch (error) {
        next(error);
    }
}

export async function retractMessageHandler(_req: Request, res: Response, next: NextFunction) {
    try {
        const req = _req as RequestWithUser;
        const messageId = req.params.id;
        const userId = req.user._id?.toString();

        const message = await MessageModel.findById(messageId);

        if (!message) {
            return res.status(404).json({ message: "Message not found" });
        }

        if (message.sender.toString() !== userId) {
            return res.status(400).json({ message: "You are not the sender of this message" });
        }

        if (message.excludedFor.includes(new mongoose.Types.ObjectId(userId))) {
            return res.status(400).json({ message: "You have already deleted this message" });
        }

        await MessageModel.findByIdAndUpdate(messageId, {
            isRetracted: true,
        });

        const updatedMessage = await MessageModel.findOne({ _id: new mongoose.Types.ObjectId(messageId) })
            .populate({ path: "sender", select: USER_MODEL_HIDDEN_FIELDS })
            .populate({ path: "replyTo" })
            .populate({ path: "conversation" })
            .populate({ path: "reactions.user", select: USER_MODEL_HIDDEN_FIELDS });

        const conversationId = message.conversation.toString();

        // Send io
        const io = req.app.get("io") as Server;

        io.to(conversationId).emit("retractMessage", updatedMessage);

        return res.status(200).json({ message: "Retract message successfully" });
    } catch (error) {
        next(error);
    }
}

export async function markMessageAsSeenHandler(_req: Request, res: Response, next: NextFunction) {
    try {
        const req = _req as RequestWithUser;
        const userSeenId = req.body.userId as string;
        const conversationId = req.body.conversationId as string;

        await MessageModel.updateMany(
            {
                conversation: new mongoose.Types.ObjectId(conversationId),
                seenBy: { $nin: new mongoose.Types.ObjectId(userSeenId) },
            },
            { $addToSet: { seenBy: new mongoose.Types.ObjectId(userSeenId) } }
        );

        // Get last message and seen
        const lastMessage = await MessageModel.findOne({
            conversation: new mongoose.Types.ObjectId(conversationId),
            seenBy: {
                $in: [new mongoose.Types.ObjectId(userSeenId)],
            },
        })
            .sort({ createdAt: -1 })
            .populate({ path: "sender", select: USER_MODEL_HIDDEN_FIELDS })
            .populate({
                path: "conversation",
                populate: {
                    path: "participants",
                    select: USER_MODEL_HIDDEN_FIELDS,
                },
            })
            .populate({ path: "replyTo" })
            .populate({ path: "seenBy", select: USER_MODEL_HIDDEN_FIELDS });

        // Send io
        const io = req.app.get("io") as Server;

        io.to(conversationId).emit("markMessageAsSeen", lastMessage);

        return res.status(200).json({ message: "Mark message as seen successfully" });
    } catch (error) {
        next(error);
    }
}

export async function searchMessagesHandler(_req: Request, res: Response, next: NextFunction) {
    try {
        const req = _req as RequestWithUser;
        const { search, conversationId } = req.query;
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 10;
        const userId = req.user._id?.toString();

        if (!search || !conversationId) {
            return res.status(400).json({ message: "Search query is required" });
        }

        const conversation = await ConversationModel.findById(conversationId);

        if (!conversation) {
            return res.status(404).json({ message: "Conversation not found" });
        }

        const isMember = conversation.participants.some((participant) => participant._id.toString() === userId);
        if (!isMember) {
            return res.status(403).json({ message: "You are not a member of this conversation" });
        }

        const condition = {
            conversation: new mongoose.Types.ObjectId(conversation._id),
            excludedFor: { $nin: new mongoose.Types.ObjectId(userId) },
            content: {
                $ne: null,
                $nin: ["", " "],
                $regex: search.toString().trim(),
                $options: "i",
            },
        };

        const allMatchingMessages = await MessageModel.find(condition).sort({ createdAt: -1 });

        const totalMessages = allMatchingMessages.length;
        const totalPages = Math.ceil(totalMessages / limit);

        const skip = (page - 1) * limit;

        const messages = await MessageModel.find(condition)
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 })
            .populate({
                path: "sender",
                select: USER_MODEL_HIDDEN_FIELDS,
            })
            .populate({
                path: "seenBy",
                select: USER_MODEL_HIDDEN_FIELDS,
            })
            .populate({
                path: "replyTo",
            })
            .populate({
                path: "conversation",
            })
            .populate({
                path: "reactions.user",
            });

        return res.status(200).json({
            message: "Search messages successfully",
            data: messages,
            totalMessages,
            totalPages,
            page,
            limit,
        });
    } catch (error) {
        next(error);
    }
}
