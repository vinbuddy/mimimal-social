import express, { Router } from "express";
import { autocompleteHandler, searchPostsHandler } from "./search.controller";
import { verifyToken } from "../../middlewares/verify-token.middleware";

const router: Router = express.Router();

router.get("/autocomplete", verifyToken, autocompleteHandler);
router.get("/post", verifyToken, searchPostsHandler);

export default router;
