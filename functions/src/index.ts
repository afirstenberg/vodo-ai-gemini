/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

import {MemorySession} from "./session";

const sessionManager = new MemorySession();

export const helloWorld = onRequest(async (request, response) => {
  logger.info("Hello logs!", {structuredData: true});
  response.send("Hello there!");
});

export const msg = onRequest( async (request, response) => {
  const sessionId = "TODO";
  const msg = request.query.msg as string;
  const session = await sessionManager.loadSession( sessionId );
  const reply = await session.msg( msg );
  await sessionManager.saveSession( session );
  response
    .set( "X-Session-Id", session.sessionId )
    .send( reply );
})