import express, { Router } from "express";
import {
    createCommentHandler,
    deleteCommentHandler,
    getCommentsByTargetHandler,
    getRepliesHandler,
    likeCommentHandler,
    unlikeCommentHandler,
} from "../controllers/comment.controller";
import { verifyToken } from "../middlewares/verify-token.middleware";

const router: Router = express.Router();

router.get("/", getCommentsByTargetHandler);
router.get("/reply", getRepliesHandler);
router.post("/", verifyToken, createCommentHandler);
router.delete("/:id", verifyToken, deleteCommentHandler);

router.put("/like", verifyToken, likeCommentHandler);
router.put("/unlike", verifyToken, unlikeCommentHandler);

export default router;
