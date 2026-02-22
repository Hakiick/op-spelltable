"use client";

import type { Peer as PeerType } from "peerjs";

/**
 * Creates a PeerJS instance for client-side use only.
 * This module must NEVER be imported in Server Components.
 *
 * @param id - Optional custom peer ID. If omitted, PeerJS generates one.
 * @returns A configured Peer instance connected to PeerJS Cloud.
 */
export async function createPeer(id?: string): Promise<PeerType> {
  const { Peer } = await import("peerjs");

  const debug = process.env.NODE_ENV === "development" ? 2 : 0;

  const peer = id ? new Peer(id, { debug }) : new Peer({ debug });

  return peer;
}
