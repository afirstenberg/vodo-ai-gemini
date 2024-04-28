import {ChatGoogle} from "@langchain/google-gauth";
import {ChatPromptTemplate} from "@langchain/core/prompts";
import {AgentExecutor, createToolCallingAgent} from "langchain/agents";
import {RunnableWithMessageHistory} from "@langchain/core/runnables";
import {ChatMessageHistory} from "@langchain/community/stores/message/in_memory";
import {ChainValues} from "@langchain/core/dist/utils/types";
import {MemTool} from "./memTool";
import {AbstractDriveTool} from "./driveTool";
import * as logger from "firebase-functions/logger";

export type ChatSessionInput = {
  sessionId: string;

  history?: ChatMessageHistory;

  mem?: MemTool;

  drive: AbstractDriveTool;
};

export class ChatSession {

  sessionId: string;

  history: ChatMessageHistory;

  mem: MemTool = new MemTool();

  drive: AbstractDriveTool;

  constructor(params: ChatSessionInput){
    this.sessionId = params.sessionId;
    this.drive = params.drive;
    this.history = params.history || new ChatMessageHistory();
  }

  async getMessageHistory(...args: Array<any>): Promise<ChatMessageHistory> {
    return this.history;
  }

  async setMessageHistory( newHistory: ChatMessageHistory): Promise<ChatMessageHistory> {
    this.history = newHistory;
    return this.history;
  }

  async invokeWithModel( input: string, modelName: string ): Promise<ChainValues> {

    const llm = new ChatGoogle({
      modelName,
      temperature: 0.1,
    });
    const tools = [
      //...this.mem.getTools(),
      ...this.drive.getTools(),
    ];

    const driveDescription = this.drive.currentFile?.description ?? "";

    const systemPrompt = `
      You are a helpful assistant that knows how to use tools.
      Your responses should be suitable for reading over the phone. 
      It is very important to use tools to answer the question or follow the instructions
      rather than coming up with your own answer. Tool calls are good.
      If there is a vague reference to a name, consider the last name mentioned,
      but don't forget to use a tool to process it.
      When sending a message to the user, you should refer to the spreadsheet
      and columns in the spreadsheet by name or title. But when making tool calls,
      you should use the appropriate id.
      ${driveDescription}
    `;
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", systemPrompt],
      ["placeholder", "{chat_history}"],
      ["human", "{input}"],
      ["placeholder", "{agent_scratchpad}"],
    ]);

    const agent = await createToolCallingAgent({
      llm,
      tools,
      prompt,
    });

    const agentExecutor = new AgentExecutor({
      agent,
      tools,
      returnIntermediateSteps: true,
    });

    const agentWithHistory = new RunnableWithMessageHistory({
      runnable: agentExecutor,
      getMessageHistory: async (_id) => this.getMessageHistory(_id),
      inputMessagesKey: "input",
      historyMessagesKey: "chat_history",
    })

    const result= await agentWithHistory.invoke({
      input,
    },{
      configurable: {
        sessionId: this.sessionId,
      }
    });

    await this.setMessageHistory( new ChatMessageHistory(result.chat_history) );
    return result;

  }

  async msg( input: string ): Promise<string> {
    let result = await this.invokeWithModel( input, "gemini-1.0-pro-001" );
    logger.debug('msg result', result);
    let co = 3;
    while( !result.intermediateSteps?.length && co-- ){
      logger.info(`Trying again: ${result.output}`, result);
      // result = await this.invokeWithModel( input, "gemini-1.5-pro-preview-0409" );
      result = await this.invokeWithModel( `I don't think you used a tool. Please try again. ${input}`, "gemini-1.0-pro-001" );
    }
    return result.output;

  }
}
