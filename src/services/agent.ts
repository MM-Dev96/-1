import { GoogleGenAI } from "@google/genai";

const MODELS_TO_TRY = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'];

export async function executeGeminiCall<T>(apiKeys: string[], prompt: string, taskName: string, callFn: (ai: GoogleGenAI, modelName: string) => Promise<T>): Promise<T> {
  const attempts = 3;
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= attempts; attempt++) {
    for (let i = 0; i < MODELS_TO_TRY.length; i++) {
      const modelName = MODELS_TO_TRY[i];
      const keyIndex = (attempt - 1 + i) % apiKeys.length;
      const apiKey = apiKeys[keyIndex];

      if (!apiKey) continue;
      
      try {
        const ai = new GoogleGenAI({ 
           apiKey: apiKey,
           httpOptions: {
             timeout: 600000 
           }
        });
        console.log(`[${taskName}] Attempt ${attempt}, trying model ${modelName} with key index ${keyIndex}...`);
        
        return await callFn(ai, modelName);

      } catch (error: any) {
        lastError = error;
        console.error(`[${taskName}] Model ${modelName} failed on attempt ${attempt}:`, error.message);
        const isRateLimit = error.message.includes('429') || error.status === 429;
        
        if (isRateLimit && attempt < attempts) {
           await new Promise(resolve => setTimeout(resolve, attempt * 2000));
        }
      }
    }
  }

  throw new Error(`[${taskName}] Failed after ${attempts} attempts across models. Last error: ${lastError?.message}`);
}

export async function* callGeminiStream(apiKeys: string[], prompt: string, taskName: string, jobId?: string, io?: any): AsyncGenerator<{text: string}, void, unknown> {
  yield* await executeGeminiCall(apiKeys, prompt, taskName, async (ai, modelName) => {
    try {
      const responseStream = await ai.models.generateContentStream({
        model: modelName,
        contents: prompt,
        config: {
          temperature: 0.5,
          topP: 0.95,
          topK: 40,
        }
      });
      
      const iterateChunks = async function* () {
        for await (const chunk of responseStream) {
           yield { text: chunk.text };
        }
      };

      return iterateChunks();
    } catch (e: any) {
       console.error("Stream initialization error:", e);
       throw e;
    }
  });
}

export async function callGeminiText(apiKeys: string[], prompt: string, taskName: string) {
  return await executeGeminiCall(apiKeys, prompt, taskName, async (ai, modelName) => {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        temperature: 0.7,
        topP: 0.95,
        topK: 40,
      }
    });
    return response.text;
  });
}
