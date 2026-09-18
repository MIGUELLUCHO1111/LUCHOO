"use client";

import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";

export function useTicketSocket(
  ticketId: string,
  handlers: {
    onNewComment?: (comment: unknown) => void;
    onTicketUpdated?: (ticket: unknown) => void;
  }
) {
  const socketRef = useRef<Socket | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const socket = io({ path: "/api/socket" });
    socketRef.current = socket;

    socket.emit("ticket:join", ticketId);
    socket.on("comment:new", (comment) => handlersRef.current.onNewComment?.(comment));
    socket.on("ticket:updated", (ticket) => handlersRef.current.onTicketUpdated?.(ticket));

    return () => {
      socket.emit("ticket:leave", ticketId);
      socket.disconnect();
    };
  }, [ticketId]);
}
