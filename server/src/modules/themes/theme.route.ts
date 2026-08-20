import express, { Router } from "express";
import { verifyToken } from "../../middlewares/verify-token.middleware";
import { getThemesHandler } from "./theme.controller";

const router: Router = express.Router();

router.get("/", verifyToken, getThemesHandler);
export default router;
