import {ChatGoogle} from "@langchain/google-gauth";
import {getValueTool, putValueTool} from "./tools";
import {ChatPromptTemplate} from "@langchain/core/prompts";
import {AgentExecutor, createToolCallingAgent} from "langchain/agents";

async function chat() {
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

  const result = await agentExecutor.invoke({
    input: "Set alpha to the same value that bravo has and tell me the old and new value for alpha.",
  });

  console.log(result);
}

chat().then();
