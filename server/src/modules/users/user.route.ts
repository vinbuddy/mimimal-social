import express, { Router } from "express";
import {
    editProfileHandler,
    followUserHandler,
    getFollowersHandler,
    getFollowingsHandler,
    getFollowSuggestionsHandler,
    getUserHandler,
    getUsersHandler,
    searchUserHandler,
    unfollowUserHandler,
} from "./user.controller";
import { verifyAdminToken, verifyToken } from "../../middlewares/verify-token.middleware";
import multer from "multer";

const uploadFile = multer();

const router: Router = express.Router();

router.get("/search", verifyToken, searchUserHandler);
router.get("/following", verifyToken, getFollowingsHandler);
router.get("/follower", verifyToken, getFollowersHandler);
router.get("/", verifyAdminToken, getUsersHandler);
router.get("/suggestion", getFollowSuggestionsHandler);
// --
router.get("/:id", verifyToken, getUserHandler);
// --

router.put("/follow", verifyToken, followUserHandler);
router.put("/unfollow", verifyToken, unfollowUserHandler);

router.put("/edit", uploadFile.single("file"), verifyToken, editProfileHandler);

export default router;
