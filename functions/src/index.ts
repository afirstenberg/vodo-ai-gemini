/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import {onRequest} from "firebase-functions/v2/https";
import {onCall} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

import {MemorySession} from "./session";
import {transcribe} from "./stt";
import {makeAudio} from "./tts";

const sessionManager = new MemorySession();

type MsgParams = {
  sessionId?: string;
  msg: string;
}

type MsgResponse = {
  sessionId: string;
  reply: string;
  currentFile?: {
    id: string;
    name: string;
  }
}

async function handleMsg({sessionId, msg}: MsgParams): Promise<MsgResponse> {
  const id = sessionId || await sessionManager.newSessionId();
  logger.info("handleMsg start", {id, sessionId, msg});
  const session = await sessionManager.loadSession( id );
  const reply = await session.msg( msg );
  await sessionManager.saveSession( session );
  const response: MsgResponse = {
    sessionId: id,
    reply,
  }
  if( session?.drive?.currentFile ){
    response.currentFile = {
      id: session?.drive?.currentFile?.id,
      name: session?.drive?.currentFile?.name,
    }
  }
  logger.info("handleMsg end", response);
  return response;
}

export const msg = onRequest( async (request, response) => {
  const sessionHeader = "X-Session-Id";
  const sessionId = request.header( sessionHeader );
  const msg = request.query.msg as string;

  const result = await handleMsg({
    sessionId,
    msg
  })

  response
    .set( sessionHeader, result.sessionId )
    .send( result.reply );
})

export const clientMsg = onCall( async (request) => {
  const result = await handleMsg( request.data );
  return result;
})

export const clientAudio = onCall( async (request) => {
  const audio64 = request.data.audio64;

  const msg = await transcribe( audio64 );
  const result = await handleMsg({
    sessionId: request.data.sessionId,
    msg,
  })
  const reply = result.reply;
  const replyAudio = await makeAudio( reply );
  return {
    ...result,
    msg,
    replyAudio,
  }
})