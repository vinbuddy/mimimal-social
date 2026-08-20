import express, { Router } from "express";
import { verifyToken } from "../../middlewares/verify-token.middleware";
import {
    createMessageHandler,
    deleteMessageHandler,
    getConversationMessagesHandler,
    getMessagesWithCursorHandler,
    getUsersReactedMessageHandler,
    markMessageAsSeenHandler,
    reactMessageHandler,
    retractMessageHandler,
    searchMessagesHandler,
    unreactMessageHandler,
} from "./message.controller";
import multer from "multer";

const uploadFile = multer();
const router: Router = express.Router();

router.post("/", verifyToken, uploadFile.array("mediaFiles"), createMessageHandler);
router.get("/", verifyToken, getConversationMessagesHandler);
router.get("/cursor-pagination", verifyToken, getMessagesWithCursorHandler);
router.get("/reaction", verifyToken, getUsersReactedMessageHandler);

router.post("/reaction/:id", verifyToken, reactMessageHandler);
router.post("/unreaction/:id", verifyToken, unreactMessageHandler);
router.delete("/delete/:id", verifyToken, deleteMessageHandler);
router.delete("/retract/:id", verifyToken, retractMessageHandler);
router.post("/mark-seen", verifyToken, markMessageAsSeenHandler);
router.get("/search", verifyToken, searchMessagesHandler);

export default router;
