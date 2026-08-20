import express from "express";

import authRoutes from "../modules/auth/auth.route";
import userRoutes from "../modules/users/user.route";
import postRoutes from "../modules/posts/post.route";
import commentRoutes from "../modules/comments/comment.route";
import notificationRoutes from "../modules/notifications/notification.route";
import searchRoutes from "../modules/search/search.route";
import messageRoutes from "../modules/messages/message.route";
import conversationRoutes from "../modules/messages/conversation.route";
import stickerRoutes from "../modules/stickers/sticker.route";
import themeRoutes from "../modules/themes/theme.route";
import accountRoutes from "../modules/users/account.route";

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/user", userRoutes);
router.use("/post", postRoutes);
router.use("/comment", commentRoutes);
router.use("/notification", notificationRoutes);
router.use("/search", searchRoutes);
router.use("/message", messageRoutes);
router.use("/conversation", conversationRoutes);
router.use("/sticker", stickerRoutes);
router.use("/theme", themeRoutes);
router.use("/account", accountRoutes);

export default router;
