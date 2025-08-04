// ai.js (or wherever you create your OpenAI client)
import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config({ path: "./env" }); // loads .env from custom path

const client = new OpenAI({
  baseURL: "https://models.inference.ai.azure.com",
  apiKey: process.env.GITHUB_TOKEN,
});

const response = await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [
    { role: "system", content: "" },
    {
      role: "user",
      content: "List 3 distinct differences between deep thinking models and standard LLMs like GPT-4o",
    },
  ],
  temperature: 1,
  max_tokens: 4096,
  top_p: 1,
});

console.log(response.choices?.[0]?.message?.content);
