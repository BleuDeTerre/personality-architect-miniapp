/**
 * Gemma 3 API Client
 * Uses Google AI Studio (aistudio.google.com) API via @google/generative-ai
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

export type GemmaModel = 'gemma-3-27b' | 'gemma-2-9b-it' | 'gemma-2-27b-it';

/** Gemma клиент через Google AI Studio. */
export function gemmaClient() {
    const apiKey = process.env.GEMMA_API_KEY;
    if (!apiKey) {
        throw new Error('GEMMA_API_KEY must be set for Gemma (Google AI Studio)');
    }
    
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Возвращаем объект с методом chat.completions.create для единого интерфейса
    return {
        chat: {
            completions: {
                create: async (params: {
                    model: string;
                    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
                    temperature?: number;
                    response_format?: { type: 'json_object' };
                }) => {
                    const modelName = params.model;
                    const model = genAI.getGenerativeModel({ model: modelName });
                    
                    // Конвертируем сообщения в формат Google AI
                    const systemMessages: string[] = [];
                    const conversationHistory: Array<{ role: 'user' | 'model'; parts: string }> = [];
                    
                    for (const msg of params.messages) {
                        if (msg.role === 'system') {
                            systemMessages.push(msg.content);
                        } else if (msg.role === 'user') {
                            const content = systemMessages.length > 0 
                                ? `${systemMessages.join('\n\n')}\n\n${msg.content}`
                                : msg.content;
                            conversationHistory.push({ role: 'user', parts: content });
                            systemMessages.length = 0;
                        } else if (msg.role === 'assistant') {
                            conversationHistory.push({ role: 'model', parts: msg.content });
                        }
                    }
                    
                    // Если остались system messages, добавляем к последнему user message
                    if (systemMessages.length > 0 && conversationHistory.length > 0) {
                        const lastMsg = conversationHistory[conversationHistory.length - 1];
                        if (lastMsg.role === 'user') {
                            lastMsg.parts = `${systemMessages.join('\n\n')}\n\n${lastMsg.parts}`;
                        }
                    }
                    
                    const generationConfig: any = {
                        temperature: params.temperature ?? 0.7,
                    };
                    
                    if (params.response_format?.type === 'json_object') {
                        generationConfig.responseMimeType = 'application/json';
                    }
                    
                    const result = await model.generateContent({
                        contents: conversationHistory.map(msg => ({
                            role: msg.role === 'user' ? 'user' : 'model',
                            parts: [{ text: msg.parts }],
                        })),
                        generationConfig,
                    });
                    
                    const response = result.response;
                    const text = response.text();
                    
                    // Возвращаем в формате, совместимом с остальным кодом
                    return {
                        choices: [{
                            message: {
                                role: 'assistant' as const,
                                content: text,
                            },
                        }],
                    };
                },
            },
        },
    };
}

/** Выбор модели Gemma для Google AI Studio. */
export function pickGemmaModel(): GemmaModel {
    const model = process.env.GEMMA_MODEL as GemmaModel;
    // По умолчанию используем gemma-3-27b
    return model || 'gemma-3-27b';
}
