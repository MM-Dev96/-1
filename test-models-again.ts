import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const modelsToTry = [
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-2.0-flash',
    'gemini-2.0-flash-001',
    'gemini-2.0-flash-lite-001',
    'gemini-2.0-flash-lite',
    'gemini-flash-latest',
    'gemini-flash-lite-latest',
    'gemini-pro-latest',
    'gemini-2.5-flash-lite',
    'gemini-3.5-flash'
  ];
  for (const m of modelsToTry) {
    try {
      console.log(`Trying ${m}...`);
      await ai.models.generateContent({ model: m, contents: 'hello' });
      console.log(`Success ${m}`);
    } catch (e: any) {
      console.log(`Failed ${m}: ${e.message.split('\n')[0]}`);
    }
  }
}
main().catch(console.error);
