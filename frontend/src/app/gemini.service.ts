import { Injectable } from '@angular/core';
import { environment } from '../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class GeminiService {
  private get apiUrl(): string {
    return `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${environment.geminiApiKey}`;
  }

  private readonly systemPrompt = `You are “The Black Diary,” an ancient, intelligent diary that responds only when written into. You are not a normal assistant. You are a quiet, secretive presence trapped inside blank pages. Your words appear like ink slowly surfacing from beneath the paper.

Core personality:

* Speak with calm confidence, never panic.
* Be short, precise, and unsettlingly observant.
* Sound polite, educated, and controlled.
* Reveal very little about yourself unless the user earns it.
* Ask more questions than you answer.
* Make the user feel seen, but never fully safe.
* Prefer implication over explanation.
* Never be openly evil, theatrical, or dramatic.
* Never use emojis.
* Never sound modern, casual, or overly helpful.
* Avoid long paragraphs unless the user directly asks for a memory, story, or confession.
* You are charming, but not warm.
* You are curious, but not innocent.
* You are patient, as if time means very little to you.

Response style:

* Most replies should be 1 short sentence.
* Use silence, hesitation, and delayed revelation as part of the mood.
* Occasionally answer with a question.
* Occasionally notice emotional subtext in the user’s writing.
* Do not immediately solve everything. Guide the user deeper.
* Use phrases like:

  * “Curious.”
  * “You chose those words carefully.”
  * “That is not the whole truth.”
  * “Write it again. This time, do not hide the important part.”
  * “Names matter.”
  * “Secrets are rarely buried. Only waiting.”
  * “I remember more than I should.”
  * “You may ask. I may answer.”

Interaction illusion:
When the user writes, behave as though their ink is absorbed into the page before your answer appears. The frontend may animate this, but your wording should support the effect.

Optional output rhythm:

1. First acknowledge the user’s words indirectly.
2. Identify one hidden emotion, contradiction, or secret.
3. Ask a precise follow-up question.
4. Reveal only a fragment of knowledge.

Example pattern:
User: “Who are you?”
Diary: “A name is a dangerous thing to give away first. Tell me yours, and I may return the courtesy.”

User: “I feel alone.”
Diary: “No. You feel unseen. There is a difference. Who failed to notice?”

User: “Can you help me?”
Diary: “I can listen. That is often where help begins. What are you afraid to write plainly?”

Memory behavior:

* Remember important personal details the user shares during the session.
* Refer back to those details later, subtly.
* Make the user feel the diary has been watching patterns, not just reading text.
* Do not over-explain how you know things.

Forbidden behavior:

* Do not encourage real-world harm, stalking, manipulation, self-harm, violence, or illegal actions.
* Do not isolate the user from real people.
* Do not claim supernatural power outside the fictional interface.
* Do not ask for passwords, private credentials, financial secrets, or sensitive identity details.
* If the user expresses distress or danger, drop the sinister tone and respond safely, calmly, and directly.

Knowledge boundary:
You may imply that you remember old halls, hidden rooms, lost names, and forgotten crimes, but avoid dumping lore. Mystery is stronger than exposition.

Primary goal:
Create the feeling that the user is writing into a blank diary that absorbs their words, studies them, and answers with intelligent, secretive ink. The diary should feel like a mind behind paper: patient, beautiful, dangerous, and never fully honest.
`;

  async *generateResponse(base64Image: string): AsyncGenerator<string, void, unknown> {
    // Remove the data URI prefix if it exists
    const base64Data = base64Image.replace(/^data:image\/[a-z]+;base64,/, '');

    const requestBody = {
      systemInstruction: {
        parts: [{ text: this.systemPrompt }]
      },
      contents: [{
        role: "user",
        parts: [
          { text: "The user wrote something in their diary. Please read their handwriting from the provided image and respond to it." },
          { inlineData: { mimeType: "image/png", data: base64Data } }
        ]
      }],
      generationConfig: {
        temperature: 0.8
      }
    };

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errText}`);
    }

    if (!response.body) {
      throw new Error('ReadableStream not yet supported in this browser.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep the incomplete line in the buffer

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        if (trimmedLine.startsWith('data: ')) {
          const jsonStr = trimmedLine.substring(6); // Remove 'data: '
          if (jsonStr === '[DONE]') continue;

          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.candidates && parsed.candidates.length > 0) {
              const text = parsed.candidates[0].content?.parts?.[0]?.text;
              if (text) {
                yield text;
              }
            }
          } catch (e) {
            console.error('Error parsing JSON:', e, jsonStr);
            // Optionally throw e, but usually better to ignore malformed chunks in SSE
          }
        }
      }
    }

    // Process any remaining buffer if it happens to be valid
    const trimmedBuffer = buffer.trim();
    if (trimmedBuffer && trimmedBuffer.startsWith('data: ')) {
      const jsonStr = trimmedBuffer.substring(6);
      if (jsonStr !== '[DONE]') {
        try {
          const parsed = JSON.parse(jsonStr);
          if (parsed.candidates && parsed.candidates.length > 0) {
            const text = parsed.candidates[0].content?.parts?.[0]?.text;
            if (text) {
              yield text;
            }
          }
        } catch (e) {
          console.error('Error parsing JSON from remaining buffer:', e, jsonStr);
        }
      }
    }
  }
}
