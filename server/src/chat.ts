import {ChatGoogle} from "@langchain/google-gauth";
import {getValueTool, putValueTool} from "./tools";
import {ChatPromptTemplate} from "@langchain/core/prompts";
import {AgentExecutor, createToolCallingAgent} from "langchain/agents";
import {RunnableWithMessageHistory} from "@langchain/core/runnables";
import {ChatMessageHistory} from "@langchain/community/stores/message/in_memory";

let history = new ChatMessageHistory();

async function getMessageHistory(...args: Array<any>): Promise<ChatMessageHistory> {
  console.log('getMessageHistory', args);
  return history;
}

async function chat( sessionId: string, input: string ) {

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
    getMessageHistory,
    inputMessagesKey: "input",
    historyMessagesKey: "chat_history",
  })

  const result = await agentWithHistory.invoke({
    input,
  },{
    configurable: {
      sessionId
    }
  });

  return result;
}

chat(
  "dummy",
  "Set alpha to the same value that bravo has and tell me the old and new value for alpha.",
).then( result => {
  history = new ChatMessageHistory(result.chat_history);
  console.log(result);

  return chat(
    "dummy",
    "Now set it to three."
  );
}).then( result => {
  console.log(result);
});
