import {ChatSession} from "./chat";
import {ChatMessageHistory} from "@langchain/community/stores/message/in_memory";
import {AbstractDriveTool, DriveState, RemoteDriveTool} from "./driveTool";
import {logger} from "firebase-functions";
import {BaseMessage} from "@langchain/core/messages";

abstract class AbstractSession {

  abstract loadSession( id: string ): Promise<ChatSession>;

  abstract saveSession( session: ChatSession ): Promise<ChatSession>;

  async newSession( id?: string ): Promise<ChatSession> {
    const sessionId: string = id ?? await this.newSessionId();
    const history: ChatMessageHistory = new ChatMessageHistory();
    const drive: AbstractDriveTool = this.newDriveTool({});
    const ret: ChatSession = new ChatSession({
      sessionId,
      history,
      drive,
    });
    return this.saveSession( ret );
  }

  async newSessionId(): Promise<string> {
    return `${Date.now()}`;
  }

  newDriveTool(state: DriveState): AbstractDriveTool {
    return new RemoteDriveTool(state);
  }
}

type SessionState = {
  sessionId: string;
  history: BaseMessage[];
  drive: DriveState;
}

export class MemorySession extends AbstractSession {

  session: Record<string, SessionState> = {};

  async loadSession(id: string): Promise<ChatSession> {
    logger.debug( "loadSession", {id} );
    const input = this.session[id];
    if( input ){
      return new ChatSession({
        sessionId: input.sessionId,
        history: new ChatMessageHistory(input.history),
        drive: this.newDriveTool(input.drive),
      });
    } else {
      return this.newSession( id );
    }
  }

  async saveSession(session: ChatSession): Promise<ChatSession> {
    const sessionId = session.sessionId;
    const history = await session.history.getMessages();
    const drive: DriveState = await session.drive.getDriveState();
    const sessionState: SessionState = {
      sessionId,
      history,
      drive,
    }
    logger.debug( "saveSession", {sessionState} );
    this.session[sessionId] = sessionState;
    return session;
  }

}