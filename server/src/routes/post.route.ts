import express, { Router } from "express";
import {
    createPostHandler,
    deletePostHandler,
    editPostHandler,
    getAllPostsHandler,
    getFollowingPostsHandler,
    getLikedPostsHandler,
    getPostDetailHandler,
    getUserPostsHandler,
    getUsersLikedPostHandler,
    getUsersRepostedPostHandler,
    likePostHandler,
    repostHandler,
    unlikePostHandler,
    unRepostHandler,
} from "../controllers/post.controller";
import { verifyAdminToken, verifyToken } from "../middlewares/verify-token.middleware";
import multer from "multer";
const uploadFile = multer();

const router: Router = express.Router();

router.post("/", verifyToken, uploadFile.array("mediaFiles"), createPostHandler);
router.put("/", verifyToken, editPostHandler);
router.get("/", verifyToken, getAllPostsHandler);
router.get("/following", verifyToken, getFollowingPostsHandler);
router.get("/liked", verifyToken, getLikedPostsHandler);
router.get("/user-post", verifyToken, getUserPostsHandler);
router.post("/repost", verifyToken, repostHandler);
router.post("/un-repost", verifyToken, unRepostHandler);

router.get("/user-liked/:id", verifyToken, getUsersLikedPostHandler);
router.get("/user-reposted/:id", verifyToken, getUsersRepostedPostHandler);

router.get("/:id", getPostDetailHandler);

router.delete("/:id", verifyToken, deletePostHandler);
router.post("/like", verifyToken, likePostHandler);
router.post("/unlike", verifyToken, unlikePostHandler);

export default router;
