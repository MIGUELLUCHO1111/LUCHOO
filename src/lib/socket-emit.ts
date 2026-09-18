import type { Server as SocketIOServer } from "socket.io";

declare global {
  // eslint-disable-next-line no-var
  var io: SocketIOServer | undefined;
}

export function emitToTicket(ticketId: string, event: string, payload: unknown) {
  globalThis.io?.to(`ticket:${ticketId}`).emit(event, payload);
}
