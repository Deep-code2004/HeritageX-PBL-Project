import { once } from "node:events";
import { app } from "./app";
import { env } from "./config/env";
import { prisma } from "./config/prisma";

async function startServer(): Promise<void> {
  try {
    await prisma.$connect();
  } catch (error) {
    try {
      await prisma.$disconnect();
    } catch (disconnectError) {
      const errorName = disconnectError instanceof Error ? disconnectError.name : "Unknown error";
      console.error("Failed to clean up after database connection failure:", errorName);
    }
    throw error;
  }

  const server = app.listen(env.PORT);

  try {
    await once(server, "listening");
  } catch (error) {
    await prisma.$disconnect();
    throw error;
  }

  server.on("error", (error) => {
    console.error("HTTP server error:", error);
    process.exitCode = 1;
  });

  console.log(`🚀 HeritageX Backend running on http://localhost:${env.PORT}`);
  console.log(`🌿 Environment: ${env.NODE_ENV}`);
  console.log(`🩺 Health check: http://localhost:${env.PORT}/api/health`);
  console.log(`🩺 Readiness check: http://localhost:${env.PORT}/api/ready`);

  let shuttingDown = false;
  const shutdown = (signal: NodeJS.Signals): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} signal received: closing HTTP server`);
    server.close((error) => {
      if (error) {
        console.error("Failed to close HTTP server cleanly:", error);
        process.exitCode = 1;
      }

      void prisma
        .$disconnect()
        .then(() => console.log("HTTP server and database connection closed"))
        .catch((disconnectError: unknown) => {
          console.error("Failed to disconnect database cleanly:", disconnectError);
          process.exitCode = 1;
        });
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

startServer().catch((error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${env.PORT} is already in use. Stop the other server or set PORT to a free port.`);
  } else {
    console.error(
      "Backend startup failed. Check the environment configuration and database connectivity.",
      error.name
    );
  }
  process.exitCode = 1;
});
