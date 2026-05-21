import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

const client = new Anthropic();

export async function POST(req: NextRequest) {
  const { question } = await req.json();

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    messages: [
      {
        role: 'user',
        content: `أنت مستشار قانوني محترف. أجب على هذا السؤال القانوني بشكل واضح ومفيد باللغة العربية.

بعد الإجابة، أضف في النهاية هذا القسم بالضبط:

---SUGGESTED_QUESTIONS---
سؤال مقترح متعلق بالموضوع 1
سؤال مقترح متعلق بالموضوع 2
سؤال مقترح متعلق بالموضوع 3
---END_SUGGESTED---

السؤال: ${question}`
      }
    ],
  });

  const fullText = message.content[0].type === 'text' ? message.content[0].text : '';
  
  const parts = fullText.split('---SUGGESTED_QUESTIONS---');
  const answer = parts[0].trim();
  
  let suggestions: string[] = [];
  if (parts[1]) {
    const suggestionsText = parts[1].split('---END_SUGGESTED---')[0].trim();
    suggestions = suggestionsText.split('\n').filter(s => s.trim()).slice(0, 3);
  }

  return NextResponse.json({ answer, suggestions });
}