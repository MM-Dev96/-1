import { initializeApp } from "firebase/app";
import { getVertexAI, getGenerativeModel } from "firebase/vertexai";

const firebaseConfig = {
  projectId: "favorable-plasma-bwjrd",
  appId: "1:242317721682:web:73778f19b48a03c361df8b",
  apiKey: "AIzaSyDw9tTsmc_LKrejpcKtbR2Kjs1q9aFHGeI",
  authDomain: "favorable-plasma-bwjrd.firebaseapp.com",
};

const app = initializeApp(firebaseConfig);
const vertexAI = getVertexAI(app);
const model = getGenerativeModel(vertexAI, { model: "gemini-2.5-flash" });

async function run() {
  try {
    const result = await model.generateContent("Hello!");
    console.log(result.response.text());
  } catch(e) {
    console.error(e);
  }
}
run();
