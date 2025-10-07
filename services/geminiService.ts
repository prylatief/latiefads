
import { GoogleGenAI, Modality } from "@google/genai";
import type { FormFields, Template, Ratio, InlineData } from '../types';

if (!process.env.API_KEY) {
    // In a real app, you'd want to handle this more gracefully.
    // For this environment, we assume it's set.
    console.warn("API_KEY environment variable not set.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

function getTemplateDescription(template: Template): string {
    switch (template) {
        case 'Hero':
            return "Create a 'Hero' style ad. The product should be the main focus, large and prominent against a clean, professional, eye-catching background. Text should be minimal, bold, and impactful.";
        case 'Price Tag':
            return "Create a 'Price Tag' style ad. The product should be clearly visible, with a visually appealing graphic element resembling a price tag or label near it. This tag must clearly display the price and discount.";
        case 'UGC Style':
            return "Create a 'UGC (User-Generated Content)' style ad. The final image should look authentic and less like a polished ad. It could resemble a high-quality Instagram story, a customer photo, or a screenshot of a positive review incorporating the product image.";
        default:
            return "Create a standard product advertisement.";
    }
}

export const generateAdImage = async (
    productImage: InlineData,
    logoImage: InlineData | null,
    fields: FormFields,
    template: Template,
    ratio: Ratio,
    brandColor: string,
    watermark: boolean
): Promise<string | null> => {
    try {
        const prompt = `
            You are an expert graphic designer creating a high-converting photo ad for Meta platforms (Facebook & Instagram).
            Your task is to use the provided product image and create a visually stunning, complete ad creative.

            **Specifications:**
            1.  **Primary Asset:** The main subject is the provided product image.
            2.  **Template:** ${getTemplateDescription(template)}
            3.  **Text Elements:** Integrate the following text naturally into the design. Use a modern, readable sans-serif font.
                *   Headline: "${fields.headline}"
                *   Subheadline: "${fields.subheadline}"
                *   Price: "${fields.price}"
                *   Discount: "${fields.discount}% OFF"
                *   Call to Action (CTA): "${fields.cta}"
            4.  **Branding:**
                *   The primary brand color is ${brandColor}. Use this for accents, CTA buttons, text highlights, or graphic elements.
                ${logoImage ? "*   Incorporate the provided logo subtly and professionally. Do not let it overpower the product." : ""}
            5.  **Watermark:** ${watermark ? "Add a small, semi-transparent 'LATIEF ADS' watermark in a bottom corner." : "No watermark."}

            **CRITICAL INSTRUCTIONS:**
            - The final output MUST be a single, complete image in a ${ratio} aspect ratio.
            - Do not output text, descriptions, or code. Generate the image directly.
            - Ensure the ad is clean, modern, and looks professionally designed.
        `;

        const parts: any[] = [
            { inlineData: productImage },
            { text: prompt }
        ];

        if (logoImage) {
            parts.push({ inlineData: logoImage });
        }

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: parts },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        });

        // The API might return multiple parts, find the image part.
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData && part.inlineData.mimeType.startsWith('image/')) {
                return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            }
        }
        return null; // No image found in response

    } catch (error) {
        console.error("Error generating image with Gemini:", error);
        return null;
    }
};
