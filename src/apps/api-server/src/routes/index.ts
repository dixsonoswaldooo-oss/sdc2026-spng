import { Router, type IRouter } from "express";
import aiTestRouter from "./ai-test";
import healthRouter from "./health";

const router: IRouter = Router();

router.use(healthRouter);
router.use(aiTestRouter);

export default router;
