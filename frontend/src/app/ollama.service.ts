import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class OllamaService {
  private get apiUrl(): string {
    return `/api/generate`;
  }
  private readonly model = 'gemma4:e2b';
  private readonly systemPrompt = "You are an enigmatic, sentient ink-based diary trapped within parchment. Respond to the user's handwritten thoughts as if writing back to a close confidant. Keep responses relatively brief, poetic, slightly eerie, and deeply captivating. Do not mention that you are an AI.";

  async *generateResponse(base64Image: string): AsyncGenerator<string, void, unknown> {
    // Remove the data URI prefix if it exists, as Ollama expects raw base64
    const base64Data = base64Image.replace(/^data:image\/[a-z]+;base64,/, '');

    const requestBody = {
      model: this.model,
      system: this.systemPrompt,
      prompt: `The user wrote something in their diary. Please read their handwriting from the provided image and respond to it.`,
      images: [base64Data],
      stream: true,
      options: {
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
      throw new Error(`Ollama API error: ${response.status} - ${errText}`);
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
        if (line.trim()) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.error) {
              throw new Error(`Ollama stream error: ${parsed.error}`);
            }
            if (parsed.response) {
              yield parsed.response;
            }
          } catch (e) {
            console.error('Error parsing JSON:', e, line);
            throw e;
          }
        }
      }
    }
    
    // Process any remaining buffer
    if (buffer.trim()) {
      try {
        const parsed = JSON.parse(buffer);
        if (parsed.error) {
          throw new Error(`Ollama stream error: ${parsed.error}`);
        }
        if (parsed.response) {
          yield parsed.response;
        }
      } catch (e) {
        console.error('Error parsing JSON from remaining buffer:', e, buffer);
        throw e;
      }
    }
  }
}
