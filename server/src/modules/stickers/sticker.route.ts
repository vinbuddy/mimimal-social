import express, { Router } from "express";
import { verifyToken } from "../../middlewares/verify-token.middleware";
import { getStickersHandler } from "./sticker.controller";

const router: Router = express.Router();

router.get("/", verifyToken, getStickersHandler);
export default router;
