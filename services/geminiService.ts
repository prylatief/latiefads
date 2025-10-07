import { GoogleGenAI, Modality, Type } from "@google/genai";
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
        case 'Minimalist':
            return "Create a 'Minimalist' style ad. Use a lot of negative space, clean typography, and a simple color palette. The product should be the star, presented elegantly without clutter.";
        case 'Bold Typography':
            return "Create a 'Bold Typography' style ad. The headline should be the dominant visual element, using a large, attention-grabbing font. The product image should complement the text, not compete with it.";
        case 'Benefit-focused':
            return "Create a 'Benefit-focused' style ad. Besides the main headline, visually highlight 2-3 key benefits of the product using icons or short text callouts. The layout should be clean and easy to scan.";
        default:
            return "Create a standard product advertisement.";
    }
}

const getCurrencySymbol = (currency: string): string => {
    const symbols: { [key: string]: string } = {
        'IDR': 'Rp',
        'USD': '$',
        'EUR': '€',
        'GBP': '£',
    };
    return symbols[currency] || '';
}

export const generateAdCopy = async (productName: string, language: 'id' | 'en'): Promise<Partial<FormFields> | null> => {
    try {
        const languageInstruction = language === 'id'
            ? "Generate the response in Indonesian."
            : "Generate the response in English.";

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Generate a compelling and concise headline, subheadline, and call-to-action (CTA) for a product described as: "${productName}". The tone should be persuasive and suitable for social media ads. ${languageInstruction}`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        headline: { type: Type.STRING, description: "A short, catchy headline (5-7 words)." },
                        subheadline: { type: Type.STRING, description: "A brief, descriptive subheadline (8-12 words)." },
                        cta: { type: Type.STRING, description: "A clear, action-oriented call to action (2-3 words)." },
                    },
                    required: ["headline", "subheadline", "cta"],
                },
            },
        });

        const jsonText = response.text.trim();
        const adCopy = JSON.parse(jsonText);
        return adCopy;

    } catch (error) {
        console.error("Error generating ad copy with Gemini:", error);
        return null;
    }
};

export const generateAdImage = async (
    productImage: InlineData,
    logoImage: InlineData | null,
    fields: FormFields,
    template: Template,
    ratio: Ratio,
    brandColor: string,
    watermark: boolean
): Promise<string> => {
    try {
        const priceString = fields.price ? `${getCurrencySymbol(fields.currency)} ${Number(fields.price).toLocaleString()}` : '';
        const discountString = fields.discount ? `${fields.discount}% OFF` : '';

        const prompt = `
            You are an expert graphic designer creating a high-converting photo ad for Meta platforms (Facebook & Instagram).
            Your task is to use the provided product image and create a visually stunning, complete ad creative.

            **Specifications:**
            1.  **Primary Asset:** The main subject is the provided product image.
            2.  **Template:** ${getTemplateDescription(template)}
            3.  **Text Elements:** Integrate the following text naturally into the design. Use a modern, readable sans-serif font.
                *   Headline: "${fields.headline}"
                *   Subheadline: "${fields.subheadline}"
                *   Price: "${priceString}"
                *   Discount: "${discountString}"
                *   Call to Action (CTA): "${fields.cta}"
            4.  **Branding:**
                *   The primary brand color is ${brandColor}. Use this for accents, CTA buttons, text highlights, or graphic elements.
                ${logoImage ? "*   Incorporate the provided logo subtly and professionally. Do not let it overpower the product." : ""}
            5.  **Watermark:** ${watermark ? "Add a small, semi-transparent 'LATIEF ADS' watermark in a bottom corner." : "No watermark."}

            **CRITICAL INSTRUCTIONS:**
            - The final output MUST be a single, complete image in a ${ratio} aspect ratio.
            - Do not output text, descriptions, or code. Generate the image directly.
            - Ensure the ad is clean, modern, and looks professionally designed. Only include text elements if they have content.
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

        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData && part.inlineData.mimeType.startsWith('image/')) {
                return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            }
        }
        
        throw new Error("The API response did not contain a valid image.");

    } catch (error: any) {
        console.error("Error generating image with Gemini:", error);
        const errorMessage = error?.message || "An unknown error occurred.";

        if (errorMessage.includes("RESOURCE_EXHAUSTED") || errorMessage.includes("quota")) {
            throw new Error("You have exceeded the API request limit. Please wait a moment or reduce the batch size.");
        }

        throw new Error(errorMessage);
    }
};