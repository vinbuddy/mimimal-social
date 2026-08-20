import { z } from "zod";

export const createNotificationSchema = z.object({
    target: z.string().optional(),
    targetType: z.enum(["Comment", "Post", "User"]),
    action: z.enum(["like", "comment", "follow", "mention", "repost"]),
    photo: z.string().optional(),
    message: z.string(),
    url: z.string().optional(),
    sender: z.string(),
    receivers: z.string().array(),
});

export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;
