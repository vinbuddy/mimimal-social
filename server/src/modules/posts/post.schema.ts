import { z } from "zod";
import { mediaFileSchema } from "../../schemas/mediaFile.schema";

export const createPostSchema = z.object({
    postBy: z.string(),
    caption: z.string(),
});

export const editPostSchema = z.object({
    caption: z.string(),
    postId: z.string(),
});

export type createPostInput = z.infer<typeof createPostSchema>;
export type editPostInput = z.infer<typeof editPostSchema>;
