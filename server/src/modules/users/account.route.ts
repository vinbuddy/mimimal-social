import express, { Router } from "express";
import env from "dotenv";
import { verifyToken } from "../../middlewares/verify-token.middleware";
import {
    blockUserHandler,
    changePasswordHandler,
    getBlockedUsersHandler,
    unblockUserHandler,
    verifyChangePasswordOTPHandler,
} from "./account.controller";

env.config();

const router: Router = express.Router();

router.post("/change-password", verifyToken, changePasswordHandler);
router.post("/change-password/verify", verifyToken, verifyChangePasswordOTPHandler);

router.put("/block/:id", verifyToken, blockUserHandler);
router.put("/unblock/:id", verifyToken, unblockUserHandler);
router.get("/blocked", verifyToken, getBlockedUsersHandler);

export default router;
