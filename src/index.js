const {res, req, clipboard, language, display} = require("enconvo/bridge");
const {CallbackManager} = require("langchain/callbacks");
const llm = require("enconvo/llm/llm");
const {SystemMessagePromptTemplate, ChatPromptTemplate} = require("langchain/prompts");
const {webutil} = require("enconvo/tools");


(async () => {
    // global.window.name = "nodejs";
    const {text, context, options} = req.body();
    console.log(`process begin...${JSON.stringify(req.body())}`)
    let contextText = text || (context === 'none' ? "" : context) || await clipboard.copy();
    console.log("begin fetch...")
    await display.showContext(contextText)

    options.verbose = true
    options.stream = true

    let chat = llm(options)
    // 判断 contextText 是否为 URL
    if (webutil.isUrl(contextText)) {
        const html = await webutil.getHtml(contextText, {})
        contextText = webutil.getText(html, true)
    }

    const templateText = `
    TL;DR the text below:
     
    Text: {text}
        
    TL;DR: 
    
    `

    let messages

    const template = ChatPromptTemplate.fromPromptMessages([
        SystemMessagePromptTemplate.fromTemplate(templateText)
    ])

    messages = await template.formatMessages({text: contextText})

    await chat.call(messages, {}, CallbackManager.fromHandlers({
        handleLLMNewToken(token, idx, runId, parentRunId, tags) {
            res.write(token);
        }
    }));
    await res.end()
})();
