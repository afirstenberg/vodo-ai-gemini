import {ChatGoogle} from "@langchain/google-gauth";
import {getValueTool, putValueTool} from "./tools";
import {ChatPromptTemplate} from "@langchain/core/prompts";
import {AgentExecutor, createToolCallingAgent} from "langchain/agents";
import {RunnableWithMessageHistory} from "@langchain/core/runnables";
import {ChatMessageHistory} from "@langchain/community/stores/message/in_memory";

export type ChatSessionInput = {
  sessionId?: string;
};

export class ChatSession {

  sessionId: string;

  history: ChatMessageHistory =  new ChatMessageHistory();

  constructor(params?: ChatSessionInput){
    this.sessionId = params?.sessionId ?? this.newSession();
  }

  newSession(): string {
    return `${Date.now()}`;
  }

  async getMessageHistory(...args: Array<any>): Promise<ChatMessageHistory> {
    return this.history;
  }

  async setMessageHistory( newHistory: ChatMessageHistory): Promise<ChatMessageHistory> {
    this.history = newHistory;
    return this.history;
  }

  async msg( input: string ): Promise<string> {

    const llm = new ChatGoogle({
      modelName: "gemini-1.0-pro-001",
    });
    const tools = [
      getValueTool,
      putValueTool,
    ];
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", "You are a helpful assistant that knows how to use tools."],
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
    });

    const agentWithHistory = new RunnableWithMessageHistory({
      runnable: agentExecutor,
      getMessageHistory: async (_id) => this.getMessageHistory(_id),
      inputMessagesKey: "input",
      historyMessagesKey: "chat_history",
    })

    const result = await agentWithHistory.invoke({
      input,
    },{
      configurable: {
        sessionId: this.sessionId,
      }
    });

    // Save the message history, but we don't need to wait for it to save
    this.setMessageHistory( new ChatMessageHistory(result.chat_history) ).then();

    return result.output;
  }
}

async function run(): Promise<void> {
  const session = new ChatSession();

  const messages = [
    "Set alpha to the same value that bravo has and tell me the old and new value for alpha.",
    "Now set it to three.",
  ];

  for( let co=0; co<messages.length; co++  ){
    const input = messages[co];
    console.log( `you: ${input}`);
    const reply = await session.msg( input );
    console.log( `bot: ${reply}` );
  }

}

run().then();
