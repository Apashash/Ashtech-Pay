import type { Response } from "express";
import { v4 as uuidv4 } from "uuid";

interface SSEClient {
  id: string;
  userId: string;
  isAdmin: boolean;
  res: Response;
  activeTicketId: string | null;
}

const clients = new Map<string, SSEClient>();

export function addSSEClient(userId: string, isAdmin: boolean, res: Response): string {
  const connectionId = uuidv4();
  clients.set(connectionId, { id: connectionId, userId, isAdmin, res, activeTicketId: null });
  return connectionId;
}

export function removeSSEClient(connectionId: string) {
  clients.delete(connectionId);
}

export function setActiveTicket(connectionId: string, ticketId: string | null) {
  const client = clients.get(connectionId);
  if (client) client.activeTicketId = ticketId;
}

export function isUserOnline(userId: string): boolean {
  for (const client of clients.values()) {
    if (client.userId === userId) return true;
  }
  return false;
}

export function getOnlineUserIds(): string[] {
  const ids = new Set<string>();
  for (const client of clients.values()) ids.add(client.userId);
  return Array.from(ids);
}

export function getAdminViewingTicket(ticketId: string): boolean {
  for (const client of clients.values()) {
    if (client.isAdmin && client.activeTicketId === ticketId) return true;
  }
  return false;
}

export function getUserViewingTicket(userId: string, ticketId: string): boolean {
  for (const client of clients.values()) {
    if (client.userId === userId && client.activeTicketId === ticketId) return true;
  }
  return false;
}

function sendEvent(res: Response, event: string, data: object) {
  try {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  } catch {}
}

export function notifyUser(userId: string, event: string, data: object) {
  for (const client of clients.values()) {
    if (client.userId === userId) {
      sendEvent(client.res, event, data);
    }
  }
}

export function notifyAdmins(event: string, data: object) {
  for (const client of clients.values()) {
    if (client.isAdmin) {
      sendEvent(client.res, event, data);
    }
  }
}

export function broadcastOnlineStatus() {
  const onlineIds = getOnlineUserIds();
  for (const client of clients.values()) {
    sendEvent(client.res, "online_status", { onlineIds });
  }
}
