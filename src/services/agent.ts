import { GoogleGenAI } from "@google/genai";

const MODELS_TO_TRY = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];

export async function executeGeminiCall<T>(apiKeys: string[], prompt: string, taskName: string, callFn: (ai: GoogleGenAI, modelName: string) => Promise<T>, jobId?: string, io?: any): Promise<T> {
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
             timeout: 90000 // 90 seconds timeout
           }
        });
        console.log(`[${taskName}] Attempt ${attempt}, trying model ${modelName} with key index ${keyIndex}...`);
        
        return await callFn(ai, modelName);

      } catch (error: any) {
        lastError = error;
        
        let shortMsg = error.message;
        try {
           const parsed = JSON.parse(shortMsg);
           if (parsed.error && parsed.error.message) {
              shortMsg = parsed.error.message.split('\n')[0];
           }
        } catch(e) {}
        
        console.log(`[${taskName}] Model ${modelName} failed on attempt ${attempt}: ${shortMsg}`);
        const isQuotaExceeded = error.message?.includes('Quota exceeded');
        const isRateLimit = error.message?.includes('429') || error.status === 429 || error.message?.includes('Too Many Requests');
        
        let delayMs = attempt * 2000;
        
        if (isQuotaExceeded) {
           console.log(`[${taskName}] Quota exceeded for model ${modelName} (key index ${keyIndex}), immediately trying next...`);
           if (io && jobId) {
              io.emit('job_retry', { jobId, message: `انتهت حصة مفتاح API الحالي. الانتقال للنموذج/المفتاح التالي فوراً...` });
           }
           continue; // Skip the delay and try next model/key
        } else if (isRateLimit) {
           const match = error.message?.match(/retry in (\d+(\.\d+)?)s/i);
           if (match) {
              delayMs = Math.ceil(parseFloat(match[1])) * 1000 + 1000;
           } else {
              delayMs = 5000 * attempt; // Faster fail: 5s, 10s...
           }
        }
        
        const isLastModel = i === MODELS_TO_TRY.length - 1;
        
        if (isRateLimit && !isLastModel) {
           if (io && jobId) {
              io.emit('job_retry', { jobId, message: `تجاوز الحد الأقصى لنموذج (${modelName}). الانتقال للنموذج التالي فوراً...` });
           }
           console.log(`[${taskName}] Rate limit on ${modelName}, immediately trying next model...`);
           continue; // Skip the delay and try next model
        }

        if (isRateLimit && isLastModel) {
           if (attempt >= 2) { // Max 2 attempts for rate limit
              throw new Error('تجاوز الحد الأقصى لطلبات الذكاء الاصطناعي على جميع النماذج. يرجى إضافة مفاتيح API أخرى في الإعدادات أو المحاولة بعد قليل.');
           }
           if (io && jobId) {
              io.emit('job_retry', { jobId, message: `تجاوز الحد الأقصى للطلبات. جاري الانتظار ${Math.ceil(delayMs/1000)} ثانية قبل المحاولة مرة أخرى...` });
           }
        } else if (!isRateLimit) {
           if (io && jobId) {
              io.emit('job_retry', { jobId, message: `حدث خطأ (${modelName}). جاري المحاولة مرة أخرى...` });
           }
        }
        
        if (attempt < attempts || !isLastModel) {
           console.log(`[${taskName}] Waiting ${delayMs}ms before next attempt...`);
           await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }
  }

  let finalErrorMessage = lastError?.message || 'Unknown error';
  if (finalErrorMessage.includes('429') || finalErrorMessage.includes('Too Many Requests') || finalErrorMessage.includes('Quota exceeded')) {
    finalErrorMessage = 'لقد تجاوزت الحد المسموح به لطلبات الذكاء الاصطناعي (Quota Exceeded). يرجى المحاولة لاحقاً أو إضافة مفاتيح API إضافية في الإعدادات.';
  } else {
    try {
      const parsed = JSON.parse(finalErrorMessage);
      if (parsed.error && parsed.error.message) {
        finalErrorMessage = parsed.error.message;
      }
    } catch(e) {}
  }
  
  throw new Error(`[${taskName}] Failed after ${attempts} attempts. Last error: ${finalErrorMessage}`);
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
      
      const iterator = responseStream[Symbol.asyncIterator]();
      const firstResult = await iterator.next(); // This will throw if there's a 429!
      
      const iterateChunks = async function* () {
        try {
          if (!firstResult.done && firstResult.value) {
             yield { text: firstResult.value.text || '' };
          }
          while (true) {
             const res = await iterator.next();
             if (res.done) break;
             if (res.value) {
               yield { text: res.value.text || '' };
             }
          }
        } catch (streamError: any) {
          let msg = streamError.message || 'Stream error';
          if (msg.includes('429') || msg.includes('Quota exceeded')) {
            msg = 'انقطع الاتصال بسبب تجاوز الحد المسموح به لطلبات الذكاء الاصطناعي (Quota Exceeded).';
          } else {
            try {
              const parsed = JSON.parse(msg);
              if (parsed.error && parsed.error.message) msg = parsed.error.message;
            } catch(e) {}
          }
          throw new Error(msg);
        }
      };

      return iterateChunks();
    } catch (e: any) {
       throw e;
    }
  }, jobId, io);
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
    return response.text || "";
  });
}

