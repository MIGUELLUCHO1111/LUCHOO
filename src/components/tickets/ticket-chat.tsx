"use client";

import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/utils";
import { useTicketSocket } from "@/lib/use-ticket-socket";

type Comment = {
  id: string;
  message: string;
  internal: boolean;
  createdAt: string | Date;
  authorId: string;
  author: { id: string; name: string; role: string };
};

export function TicketChat({
  ticketId,
  initialComments,
  currentUserId,
  isStaff,
}: {
  ticketId: string;
  initialComments: Comment[];
  currentUserId: string;
  isStaff: boolean;
}) {
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [message, setMessage] = useState("");
  const [internal, setInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useTicketSocket(ticketId, {
    onNewComment: (comment) => {
      const c = comment as Comment;
      if (c.internal && !isStaff) return;
      setComments((prev) => {
        if (prev.some((p) => p.id === c.id)) return prev;
        return [...prev, c];
      });
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments.length]);

  async function sendMessage() {
    if (!message.trim()) return;
    setSending(true);
    const res = await fetch(`/api/tickets/${ticketId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, internal }),
    });
    setSending(false);
    if (res.ok) {
      setMessage("");
    }
  }

  return (
    <div className="flex h-[28rem] flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto pr-1">
        {comments.length === 0 && (
          <p className="py-10 text-center text-sm text-muted">
            Aún no hay mensajes. Escribe el primero.
          </p>
        )}
        {comments.map((c) => {
          const mine = c.authorId === currentUserId;
          return (
            <div key={c.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-xl px-3.5 py-2 text-sm shadow-sm ${
                  c.internal
                    ? "bg-brand-yellow-50 border border-brand-yellow text-brand-blue-dark"
                    : mine
                    ? "bg-brand-blue text-white"
                    : "bg-brand-blue-50 text-brand-blue-dark"
                }`}
              >
                <div className="mb-0.5 flex items-center gap-2">
                  <span className="text-xs font-semibold opacity-80">{c.author.name}</span>
                  {c.internal && (
                    <span className="rounded-full bg-brand-yellow px-1.5 py-0.5 text-[10px] font-semibold text-brand-blue-dark">
                      Nota interna
                    </span>
                  )}
                </div>
                <p className="whitespace-pre-wrap">{c.message}</p>
                <p
                  className={`mt-1 text-[10px] ${mine ? "text-white/70" : "text-muted"}`}
                >
                  {formatDateTime(c.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder="Escribe un mensaje..."
          rows={2}
        />
        <div className="flex items-center justify-between">
          {isStaff ? (
            <label className="flex items-center gap-2 text-xs text-muted">
              <input
                type="checkbox"
                checked={internal}
                onChange={(e) => setInternal(e.target.checked)}
                className="h-3.5 w-3.5 accent-brand-yellow"
              />
              Nota interna (no visible para el solicitante)
            </label>
          ) : (
            <span />
          )}
          <Button size="sm" onClick={sendMessage} disabled={sending || !message.trim()}>
            <Send className="h-3.5 w-3.5" />
            Enviar
          </Button>
        </div>
      </div>
    </div>
  );
}
