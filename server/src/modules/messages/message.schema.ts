import { z } from "zod";
import { paginationQuerySchema } from "../../schemas/base.schema";

export const createMessageSchema = z.object({
    senderId: z.string(),
    conversationId: z.string().optional(),
    content: z.string().optional(),
    replyTo: z.string().optional(),
    stickerUrl: z.string().optional(),
    gifUrl: z.string().optional(),
});

// req.query
export const getMessagesQuerySchema = paginationQuerySchema.extend({
    conversationId: z.string(),
});

export const getUsersReactedMessageQuerySchema = z.object({
    emoji: z.string(),
    messageId: z.string(),
});

export const getMessagesWithCursorQuerySchema = paginationQuerySchema.extend({
    messageId: z.string().optional(),
    conversationId: z.string(),
    direction: z.enum(["next", "prev", "both", "init"]),
});

export type CreateMessageInput = z.infer<typeof createMessageSchema>;
