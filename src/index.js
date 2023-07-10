import {result, startMonitor, stream} from "./enconvo.js";
import {ChatPromptTemplate, HumanMessagePromptTemplate, PromptTemplate} from "langchain/prompts";
import {OpenAI} from "langchain/llms/openai";

import {Readability} from "@mozilla/readability";
import jsdom, {JSDOM} from "jsdom";
import axios from "axios";
import {ChatOpenAI} from "langchain/chat_models";

// @ts-expect-error
// import wasm from '@dqbd/tiktoken/lite/tiktoken_bg.wasm';
import tiktokenModel from '@dqbd/tiktoken/encoders/cl100k_base.json' assert {type: "json"};
import {Tiktoken, init} from '@dqbd/tiktoken/lite/init';
import path from "path";
import * as fs from "fs";

export const config = {
    runtime: 'edge',
};

function main() {
    (async () => {
        const args = process.argv.slice(2);
        const {option, context, text, copiedText} = JSON.parse(args[0]);
        console.log("main-" + args[0])
        // url decode text
        let content = decodeURIComponent(text) || decodeURIComponent(context.value) || decodeURIComponent(copiedText);
        content = content.trim()
        try {
            try {
                console.log("resp:", content)
                let model
                if (option.llm === 'enconvo.chatgpt') {
                    const customUrl = new URL(option.customRequest)
                    model = new ChatOpenAI({
                        modelName: option.model,
                        openAIApiKey: option.apiKey,
                        configuration: {
                            basePath: `${customUrl.origin}/v1`,
                        },
                        streaming: true,
                        temperature: +option.temperature,
                    });

                } else if (option.llm === 'enconvo.azure-openai') {
                    const customUrl = new URL(option.endpoint)
                    const instance = customUrl.host.substring(0, customUrl.host.indexOf("."))
                    model = new ChatOpenAI({
                        azureOpenAIApiKey: option.apiKey,
                        azureOpenAIApiInstanceName: instance,
                        azureOpenAIApiDeploymentName: option.model,
                        azureOpenAIApiVersion: option.api_version,
                        streaming: true,
                        temperature: +option.temperature,
                    });
                }

                // if content is a website, get the content
                if (content.startsWith("http") || content.startsWith("https")) {
                    try {
                        const res = await axios.get(content, {})
                        // proxy: {
                        //     protocol: 'http',
                        //         host: '127.0.0.1',
                        //         port: 7890
                        // }
                        // if (promptMessages) {
                        const html = await res.data;

                        const virtualConsole = new jsdom.VirtualConsole();
                        virtualConsole.on("error", (error) => {
                            if (!error.message.includes("Could not parse CSS stylesheet")) {
                                console.error(error);
                            }
                        });

                        const doc = new JSDOM(html, {url: content})
                        const parsed = new Readability(doc.window.document).parse();

                        if (parsed) {
                            // let sourceText = cleanSourceText(parsed.textContent);
                            content = parsed.textContent;
                        } else {
                            content = html
                        }

                        content = content.trim()
                            .replace(/(\n){4,}/g, '\n\n\n')
                            .replace(/\n\n/g, ' ')
                            .replace(/ {3,}/g, '  ')
                            .replace(/\t/g, '')
                            .replace(/\n+(\s*\n)*/g, '\n');

                        // }
                    } catch (error) {
                        console.error(error);
                    }
                }

                const template = "{content}\n\nTl;dr\n respond in the text's language\n";

                const prompt = ChatPromptTemplate.fromPromptMessages(
                    [
                        HumanMessagePromptTemplate.fromTemplate(template)])
                const promptValue = await prompt.formatPromptValue({content: content})
                const promptMessages = promptValue.toChatMessages()
                console.log("prompt:", promptMessages);

                const wasmFilePath = path.resolve(`${process.env['__ROOT_DIR__']}/node/tiktoken_bg.wasm`);
                const wasmBuffer = fs.readFileSync(wasmFilePath);
                await init((imports) => WebAssembly.instantiate(wasmBuffer, imports));
                const encoding = new Tiktoken(
                    tiktokenModel.bpe_ranks,
                    tiktokenModel.special_tokens,
                    tiktokenModel.pat_str,
                );

                const tokens = encoding.encode(promptValue.toString());
                console.log("tokens:", tokens.length)
                encoding.free();


                startMonitor()

                const resp = await model.call(promptMessages, {},
                    [
                        {
                            handleLLMNewToken(token) {
                                stream([token])
                            },
                        },
                    ]);

                console.log(resp.content);
                await result("result", [resp.content])
            } catch (e) {
                throw e;
            }

        } catch (e) {
            throw e;
        }
    })().catch((err) => {
        console.log("error: " + err.message);
        stream([err.message])
        result("result", [err.message])
    });
}

main()


