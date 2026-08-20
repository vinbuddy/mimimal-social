import { Queue, Worker } from "bullmq";
import { redisClient } from "../configs/redis";
import PostModel from "../../modules/posts/post.model";
import { moderateImage } from "../helpers/media-moderation";
import cloudinary from "../configs/cloudinary";
import logger from "../configs/logger";
import { io } from "../../index"; // to emit notification to user

const QUEUE_NAME = "image-moderation";

export const imageModerationQueue = new Queue(QUEUE_NAME, {
    connection: redisClient,
});

export const imageModerationWorker = new Worker(
    QUEUE_NAME,
    async (job) => {
        const { postId, mediaFiles } = job.data;
        logger.info(`Processing image moderation for post ${postId}`);

        try {
            const imageModerationPromises = mediaFiles.map((file: any) => moderateImage(file.url));
            const imageModerationResults = await Promise.all(imageModerationPromises);

            const isNotSafe = imageModerationResults.some((result) => result === false);

            if (isNotSafe) {
                // Delete from cloudinary
                const promises = mediaFiles.map((file: any) => cloudinary.uploader.destroy(file.publicId));
                await Promise.all(promises);

                // Update post status to rejected
                const post = await PostModel.findByIdAndUpdate(postId, { moderationStatus: "rejected" });
                
                if (post) {
                    // Notify user
                    io.to(post.postBy.toString()).emit("notification", {
                        notification: {
                            type: "system",
                            content: "Your recent post was removed because it contains inappropriate content.",
                            createdAt: new Date(),
                        }
                    });
                }
                
                logger.warn(`Post ${postId} was rejected due to image moderation`);
            } else {
                // Update post status to approved
                await PostModel.findByIdAndUpdate(postId, { moderationStatus: "approved" });
                logger.info(`Post ${postId} approved`);
            }
        } catch (error) {
            logger.error(`Error in image moderation for post ${postId}:`, error);
            // Optionally set to approved if moderation fails (or keep pending)
            // await PostModel.findByIdAndUpdate(postId, { moderationStatus: "approved" });
        }
    },
    { connection: redisClient }
);
