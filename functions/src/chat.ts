import {ChatGoogle} from "@langchain/google-gauth";
import {ChatPromptTemplate} from "@langchain/core/prompts";
import {AgentExecutor, createToolCallingAgent} from "langchain/agents";
import {RunnableWithMessageHistory} from "@langchain/core/runnables";
import {ChatMessageHistory} from "@langchain/community/stores/message/in_memory";
import {ChainValues} from "@langchain/core/dist/utils/types";
import {MemTool} from "./memTool";
import {AbstractDriveTool, MockDriveTool} from "./driveTool";

export type ChatSessionInput = {
  sessionId?: string;
};

export class ChatSession {

  sessionId: string;

  history: ChatMessageHistory =  new ChatMessageHistory();

  mem: MemTool = new MemTool();

  drive: AbstractDriveTool = new MockDriveTool();

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

  async invokeWithModel( input: string, modelName: string ): Promise<ChainValues> {

    const llm = new ChatGoogle({
      modelName,
      temperature: 0.1,
    });
    const tools = [
      //...this.mem.getTools(),
      ...this.drive.getTools(),
    ];
    const systemPrompt = `
      You are a helpful assistant that knows how to use tools.
      Your responses should be suitable for reading over the phone. 
      It is very important to use tools to answer the question or follow the instructions
      rather than coming up with your own answer. Tool calls are good.
      If there is a vague reference to a name, consider the last name mentioned,
      but don't forget to use a tool to process it.
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

    const result = await agentWithHistory.invoke({
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
    console.log(result);
    console.log(result.intermediateSteps);
    let co = 3;
    while( !result.intermediateSteps?.length && co-- ){
      console.log(`Trying again: ${result.output}`);
      // result = await this.invokeWithModel( input, "gemini-1.5-pro-preview-0409" );
      result = await this.invokeWithModel( `I don't think you used a tool. Please try again. ${input}`, "gemini-1.0-pro-001" );
    }
    return result.output;

  }
}

export async function run(): Promise<void> {
  const session = new ChatSession();

  // const messagesMem = [
  //   "Set bravo to 9",
  //   "Set alpha to the same value that bravo has and tell me the old and new value for alpha.",
  //   "Now set it to 3.",
  //   "Set charlie to 5",
  //   "Change it to 4 instead.",
  //   "What are all the values that we have set?",
  // ];

  const messagesDrive = [
    "Record how tall I am",
    // "Record how much I weigh"
  ]

  const messages = [
    ...messagesDrive,
  ]

  for( let co=0; co<messages.length; co++  ){
    const input = messages[co];
    console.log( `you: ${input}`);
    const reply = await session.msg( input );
    console.log( `bot: ${reply}` );
  }

}

run().then();
