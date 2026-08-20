import { z } from "zod";

export const followUserSchema = z.object({
    userId: z.string(),
    currentUserId: z.string(),
});

export type FollowUserInput = z.infer<typeof followUserSchema>;
