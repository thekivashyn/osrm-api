import { Elysia } from "elysia";
import { AppError, errorResponse } from "../utils/response";

export const errorHandler = new Elysia({ name: "error-handler" }).onError(
  ({ error, set, code }) => {
    if (code === "VALIDATION") {
      set.status = 400;
      return errorResponse("Invalid request body");
    }

    if (error instanceof AppError) {
      set.status = error.statusCode;
      if (error.statusCode >= 500) {
        console.error("[ERROR]", error.message, error);
      }
      return errorResponse(error.message);
    }

    const message = error instanceof Error ? error.message : "Internal server error";
    set.status = 500;
    console.error("[ERROR]", message, error);
    return errorResponse(message);
  },
);
