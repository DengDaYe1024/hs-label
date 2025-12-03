import { GoogleGenAI, Type } from "@google/genai";
import { DetectedObject } from '../types';
import { GEMINI_MODEL } from '../constants';

export const detectObjects = async (base64Image: string): Promise<DetectedObject[]> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing. Please set process.env.API_KEY.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Clean the base64 string if it contains the header
  const data = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");
  
  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/png', // Assuming PNG for simplicity, though generic image works
              data: data
            }
          },
          {
            text: "Detect all distinct objects in this image. Return a list of bounding boxes with labels. Be granular."
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              label: { type: Type.STRING },
              ymin: { type: Type.NUMBER, description: "Normalized coordinate (0-1)" },
              xmin: { type: Type.NUMBER, description: "Normalized coordinate (0-1)" },
              ymax: { type: Type.NUMBER, description: "Normalized coordinate (0-1)" },
              xmax: { type: Type.NUMBER, description: "Normalized coordinate (0-1)" }
            },
            required: ["label", "ymin", "xmin", "ymax", "xmax"]
          }
        }
      }
    });

    if (response.text) {
      const result = JSON.parse(response.text) as DetectedObject[];
      return result;
    }
    return [];
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};
