import express, { Router } from "express";
import { verifyToken } from "../../middlewares/verify-token.middleware";
import {
    changeConversationEmojiHandler,
    changeThemeConversationHandler,
    createPrivateConversationHandler,
    deleteConversationHandler,
    getConversationDetailHandler,
    getConversationLinksHandler,
    getConversationMediaFilesHandler,
    getConversationsHandler,
    searchConversationsByNameHandler,
} from "./conversation.controller";

const router: Router = express.Router();

router.get("/", verifyToken, getConversationsHandler);
router.get("/search", verifyToken, searchConversationsByNameHandler);

router.get("/storage/media-file", verifyToken, getConversationMediaFilesHandler);
router.get("/storage/link", verifyToken, getConversationLinksHandler);

router.get("/:id", verifyToken, getConversationDetailHandler);

router.post("/", verifyToken, createPrivateConversationHandler);
router.put("/change-emoji/:id", verifyToken, changeConversationEmojiHandler);
router.put("/change-theme/:id", verifyToken, changeThemeConversationHandler);

router.delete("/:id", verifyToken, deleteConversationHandler);

export default router;
