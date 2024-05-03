# vodo-ai-gemini

Building on Vodo Drive and earlier AI experiments, a way to talk with your spreadsheets.
Going beyond just asking questions of your data - letting you update your data.

Visit the project demo at: https://vodo-ai.web.app/

## Inspiration

This project builds on UX lessons learned from over 10 years of the Vodo (pronounced like to-do) project.

Originally started as part of the Google Glass "Foundry" hackathon, the goal has been to explore new and dynamic ways to work with spreadsheets. Spreadsheets are the most common programming language used today, and are well understood by many people who do not consider themselves technical.

One of the most powerful aspects of spreadsheets is that they are self-describing - column headers are frequently used to describe the contents in those columns, so a system needs to adapt to whatever the column header describes.

As Vodo moved into the Google Assistant 7 years ago, the goal was to provide an ambient, ubiquitous, voice-first interface to spreadsheets, allowing users to both set and retrieve information. Using an intent-based system with Dialogflow, this was fairly straightforward. The most challenging aspect was being able to dynamically adapt to the different column names. Because of this, conversations with Vodo at this time felt very stilted:
* User: Open the spreadsheet named "blood pressure"
* Vodo: Ok, I've opened the spreadsheet named "blood pressure"
* User: Add a new row
* Vodo: Ok, I've added a new row
* User: Set Systolic Pressure to 110
* Vodo: Ok, I've set "Systolic Blood Pressure" to 110
* User: Diastolic Blood Pressure is 70
* Vodo: Ok, I've set "Diastolic Blood Pressure" to 70
  While some work can be done to reduce this (for example, adding an intent to both open and add a row at the same time), it was challenging to make this adapt to the dynamic nature of spreadsheets.

A year ago, as part of another hackathon, I explored using pre-trained Large Language Models to see how well they could be used to answer questions against a spreadsheet. This was done by having the LLM generate a formula and then placing the formula into the sheet and evaluating it. The results were encouraging and demonstrated in [this YouTube video](https://www.youtube.com/watch?v=nvb1TDZgBHU).

While querying data is very cool, and tremendously practical, queries are becoming a common use of LLMs. With the demise of Conversational Actions, and a desire to make it easier to add and update data to a spreadsheet, it was time to see what LLMs could offer in this space as well.

## What it does

I explore several new features with this phase:
* Allow for much more natural input with phrases such as "Record that my blood pressure today was 110 over 70" that will create a new entry with this data, while copying the formulas and formatting from a previous entry.
* Permit its use as a "what if" scenario tool, which is popular for spreadsheets, by having it copy a row and replacing data, instead of just adding a new row without data.
* A simple interface that can be deployed on a mobile device to make it quick and easy to record new entries. Even if this could not be as ubiquitous or hands-free as the Google Assistant version, it is a start.
* Enhancing the goal that all steps can be audited and understood.

### The UI

The user interface is a basic HTML page with both a text entry field and a prominent button to start and stop recording from the microphone. The button is positioned to make it easy to trigger the microphone immediately after opening the app and after each round of the conversation.

As part of each response, if a spreadsheet is open, the user can select the spreadsheet icon to open the spreadsheet in its own window.

For audio input, audio output will also be played in addition to the text. People can confirm what was heard by the system (for example, to see if background noise interfered) by clicking on the icon next to the speech bubble for their input, and can re-play the response from Vodo by clicking on the icon next to that speech bubble.

### Starting the conversation

Once the UI is open, a person can immediately ask to get a list of what files are available. They can also ask to open a file by its name. Because of the semantic features that Gemini provides, one can even express things like "I want to check the scores" and it will open the file named "Scores".

Because of some challenges described below, it is important to open a file before you try to update it. I have some ideas about how to address this in the future.

### Adding data

Once a file is open, people can add new rows, add or update the data in a row, and perform "what if" calculations through phrases such as
* "Add another row"
* "What if the mortgage rate was 8%"
* "What if it was 7% instead?"
* "Record my blood pressure as 100 / 62"

When the system adds a row, it copies the formulas and functions from the previous row. If the first column is a date, it inserts the current date/time there (since this is a very common pattern in spreadsheets). For "what if" scenarios, it also copies the data from the previous row, in the assumption that people will change some, but not all, of this data.

In the examples above, you can see that sometimes columns were referenced in the context of previous updates. So the first time they can talk about "the mortgage rate" and the next time just talk about "it". Gemini is able to use the context to determine the correct column to use in these cases.

Similarly, Gemini's training allows common phrases to be mapped to one or more correct columns. So if the column is actually called "interest rate", a phrase "mortgage rate" would still work. Even more exciting is that the phrase "100 / 62" is a common way to express the two values for blood pressure, and Gemini can set it by those column names specifically.

## How I built it

The system is split into several components:
* A front-end written in "plain" modern HTML / CSS / JavaScript
* The primary Vodo component that is written in TypeScript using LangChain.js. This component is divided into several modules including:
    * Components responsible for converting speech to text and text to speech if required.
    * A component that is responsible for managing the conversation with Gemini and delegating function requests to other modules as appropriate. This includes monitoring for potential hallucinations and where other safety monitors may be included in the future.
    * Overall session state management is handled through another component
    * A specific "Drive" module that is responsible for function execution that interacts with the files themselves.
* This implementation includes Google Apps Script functions that are called by the Drive module to perform the actual operations on files

### Front-end

The front-end is a web page that is hosted on Firebase Hosting. It uses fairly generic HTML, CSS, and JavaScript, although it does use the Bootstrap library for layout and the Firebase library for communication with the Vodo server. Microphone control is handled through the Web MediaStream Recorder API.

Icons are from FontAwesome. Other image and audio assets are either openly licensed or were made by me.

### Vodo server

The Vodo server is written in TypeScript using the LangChain.js library and runs as a Firebase Cloud Function. It accesses the Gemini API running on Vertex AI. Messages from the user come in using the "callable" method of implementing Firebase Cloud Function endpoints.

This server is responsible for maintaining the overall state of a conversation, including what file is currently open and being worked on and the conversation history with the user that is sent to Gemini along with the user request. Currently this state is just stored in memory, however the state management system is designed to use other storage components, including a Firestore table that allows user-specific access to only their history.

One great advantage to using Vertex AI with Firebase Cloud Functions is that authentication to the Gemini API was almost completely transparent. Because Firebase Cloud Functions provided Application Default Credentials for a default service account, calls done in the same project required no additional authentication on my part. All I needed to do was make sure the Vertex AI API, and the APIs to handle text to speech and speech to text, were enabled for the project.

As noted above, it has several components. I'll highlight two of the most notable components here.

#### ChatSession

This is the component that manages a single conversation with a user. It is responsible for:
* Taking the message and sending it to Gemini along with the current function definitions
* Managing multiple rounds of responses from Gemini that include function call requests from Gemini and the results that are generated by the DriveTool component.
* Getting a response from the ultimate result of these multiple exchanges
* Verifying that there were function calls performed, thus reducing the risk of hallucinations.
* Returning these results

At the core, the multiple rounds of function-request and function-response are managed through a standard component in LangChain.js that is designed to do exactly this - a ToolCallingAgent.

However, during tests I found that it would often hallucinate a response and not call any tools to get an answer, no matter what prompt instructions were given. To reduce this, I split the task into two parts - a method that did the work with the ToolCallingAgent, and a different method that checks the work and ensures that Gemini requested tool functions had been called. If not, it re-sends the prompt with additional instructions to Gemini to use the tool. It is easy to see how future enhancements can be done to this "monitor" to check for safety violations or other server problems and possibly re-try using different models, specialty prompts, or even use different prompts based on other contextual information.

#### DriveTool

This component provides several key elements:
* Keeping track of the currently open spreadsheet and the metadata about it (current row, the columns and their attributes, etc)
* Providing supplemental data about the currently open prompt to system instructions for Gemini
* When a spreadsheet is opened, dynamically creating the function definitions for functions that set values. This allows Gemini to know, as part of the function definitions, exactly what columns can be set and what the types of those columns are.
* Providing the LangChain.js tool definitions, which include the actual method that needs to be called to produce results that will be sent to Gemini

While there is a mock drive tool that we used for some initial testing, the primary implementation takes the request from Gemini and makes a call to the Apps Script server to perform the actual command on real files. A production service would, instead, directly use the Google Drive and Google Sheets API directly, making calls to an authenticated person's files on their behalf.

### Apps Script server

For demo purposes, the DriveTool sends requests to an Apps Script server which has been configured to run as a single user and only work with a limited number of files in a specific Google Drive folder. In this way, authentication issues are delegated to the Apps Script server rather than requiring a complex front-end authentication configuration (that would also have necessitated a security review before being approved).

The Apps Script server is fairly straightforward, using standard Apps Script components to access Google Drive and Google Sheets.

## Challenges I ran into

Along the way, there were a number of issues I encountered. Some were easy to avoid, work around, or work with. Others were more major stumbling blocks.

### LangChain.js, Gemini, and Tool support

When the hackathon started, there was no implementation of the function tool for LangChain.js and Gemini. I implemented it, contributed it to the project, and worked with the LangChain.js team to make sure it was integrated and compatible with their other tools and agents. This took a lot of time away from actually working on Vodo.

### Invalid function requests from Gemini

During testing with the "gemini-1.0-pro-002" model, I was getting valid results back only about 1/3 of the time, with another 1/3 producing function call requests that were referencing non-existent tools, and the remainder being blocked for safety reasons.

I finally thought to test with the "gemini-1.0-pro-001" model and the problems vanished, although it meant I would be using a less well developed model. I contacted sources I had within Google Cloud and, ultimately, the problems I was seeing were [opend as a bug](https://issuetracker.google.com/issues/336615874).

### Dynamic function parameter definitions

In order to make sure that Gemini didn't hallucinate by either trying to set read-only columns (ie - those with formulas) to some value or trying to set a column to the wrong type (ie - setting something that is meant to hold a number to a string), I wanted to take advantage of the ability to define the function parameter signature to encourage Gemini to behave correctly.

While this works well, I discovered that the ToolCallingAgent class requires that a tool's schema must be fully defined before the agent itself is invoked. This means that, since the schema is only known once the spreadsheet is opened, it must be opened in a separate step from the data update itself being performed.

I decided to cope with this for the moment. In the future, I'll be looking into potential solutions to the problem, including:
* Switching to LangGraph, which offers a more flexible approach to function request processing
* Writing my own iteration system that works with LangChain.js tools, but applies my own logic to how to use them

### LangChain.js and function parameter definitions containing objects

Gemini's function tool specification is similar to the JSON Schema specification, but it is not identical. Specifically, JSON Schema includes a parameter called "additionalProperties" inside objects which cause an error when sent to Gemini. I realized that the way LangChain.js was removing this from the parameters sent to Gemini were insufficient in nested objects, and this was causing an error with the nested objects I was using.

I restructured my objects so they were flat, instead, and [opened a bug](https://github.com/langchain-ai/langchainjs/pull/5247), expecting to fix it after the hackathon. I was thrilled that someone else saw the bug and fixed it as their first contribution to LangChain.js.

### Prompt and description engineering

By far the biggest barrier is the non-deterministic nature of how LLMs work and the coaxing necessary to get them to behave even somewhat consistently. With functions, this extends to needing to make sure the descriptions are also accurate and descriptive enough that they encourage Gemini to reply with useful patterns.

I had set the temperature fairly low, out of concerns that a higher temperature would cause more hallucinations when it came to the function call processing. But I'm wondering if this had led to more stilted conversations and overly conservative function calling. While this seems to work well for the moment, I feel like I'll have to keep revisiting this problem.

## Accomplishments that I'm proud of

When I tested "set blood pressure to 110/70" and it worked right out of the box, I was absolutely thrilled. This was a feature that I had wanted since I first got Vodo working on the Google Assistant seven years ago, but it seemed out of reach given the technology of the time. I recorded my blood pressure daily, and losing the ability to easily record it using my voice when Actions on Google shut down was a serious blow. I've already put a shortcut to Vodo AI on my phone and am eager to use it as a replacement.

I was also pretty pleased with my contributions to LangChain.js, including how other people have seen and fixed my bugs. The community support for trying to build cutting-edge tools in a public project, and make this power available to everyone, means a lot to me.

## What I learned

This was my first  try using a function calling tool, and the first chance I had to use them with an agent in LangChain.js. That was a tremendous learning experience, and I feel I'm now better prepared to find a better solution than the default ToolCallingAgent.

I've also never used TypeScript on a project of my own, although I've used it when contributing to LangChain.js, so it was an experience to learn how to configure this for my development environment.

This was also my first chance to use the microphone in a web page, and work directly with the speech to text and text to speech APIs. Previously I had done all these through the Google Assistant and Dialogflow.

Overall, it was also a great opportunity for me to brush up and modernize some of my existing skills with other technologies, including Firebase Cloud Functions and the Firebase libraries.

## What's next for Vodo AI

With these experiments, Vodo feels tantalizingly close to being able to create the next version of Vodo Drive. There are still quite a few necessary components, including:
* Adding Firebase Authentication as the first step towards keeping user sessions private and granting them access to their own files.
* Using Gemini to do spreadsheet queries by testing it with the solutions I tried out last year.
* Improving the UI to make it more ambient and quick-and-easy to use.
* Improving the infrastructure around handling dynamic function definitions.
* Exploring other Gemini models to see if they produce better results during function calls or better answers to the user.
