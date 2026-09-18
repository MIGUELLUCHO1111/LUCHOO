import { createServer } from "http";
import next from "next";
import { Server as SocketIOServer } from "socket.io";

const port = parseInt(process.env.PORT || "3000", 10);
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

declare global {
  var io: SocketIOServer | undefined;
}

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    handle(req, res);
  });

  const io = new SocketIOServer(httpServer, {
    path: "/api/socket",
  });

  io.on("connection", (socket) => {
    socket.on("ticket:join", (ticketId: string) => {
      socket.join(`ticket:${ticketId}`);
    });
    socket.on("ticket:leave", (ticketId: string) => {
      socket.leave(`ticket:${ticketId}`);
    });
  });

  globalThis.io = io;

  httpServer.listen(port, () => {
    console.log(`> Fullpetro TI listo en http://localhost:${port}`);
  });
});
