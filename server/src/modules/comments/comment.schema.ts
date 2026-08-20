import { z } from "zod";

export const createCommentSchema = z.object({
    target: z.string(),
    targetType: z.string(),
    content: z.string(),
    commentBy: z.string(),
    rootComment: z.string().optional(),
    replyTo: z.string().optional(),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
