// routes/api/game/ai-grade.js
const express = require('express');
const OpenAI = require('openai');
require('dotenv').config();

const router = express.Router();
const client = new OpenAI({ apiKey: process.env.GITHUB_TOKEN });

// POST /api/game/ai-grade
// { answer, rubric, prompt }
router.post('/api/game/ai-grade', async (req, res) => {
  const { answer, rubric, prompt } = req.body;
  if (!answer || !rubric || !prompt) return res.status(400).json({ message: 'Missing fields' });
  try {
    const messages = [
      { role: 'system', content: 'You are a strict grader. Use the rubric to assign a mark (0-1) and explain.' },
      { role: 'user', content: `Question: ${prompt}\nRubric: ${rubric}\nStudent answer: ${answer}\nRespond as JSON: { mark: <0-1>, explanation: <string> }` }
    ];
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0,
      max_tokens: 256
    });
    const text = response.choices?.[0]?.message?.content;
    const json = JSON.parse(text.match(/\{[\s\S]*\}/)[0]);
    res.json(json);
  } catch (err) {
    res.status(500).json({ message: 'AI grading failed', error: err.message });
  }
});

module.exports = router; 