import express, { Router } from "express";
import {
    createNotificationHandler,
    deleteNotificationHandler,
    getUserNotificationsHandler,
    readAllNotificationsHandler,
} from "./notification.controller";
import { verifyToken } from "../../middlewares/verify-token.middleware";

const router: Router = express.Router();

router.post("/", verifyToken, createNotificationHandler);
router.post("/read-all/:userId", verifyToken, readAllNotificationsHandler);
router.get("/:userId", verifyToken, getUserNotificationsHandler);
router.delete("/:id", verifyToken, deleteNotificationHandler);
export default router;
