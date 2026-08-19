import { z } from 'zod';

const textContentPartSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
});

const imageContentPartSchema = z.object({
  type: z.literal('image_url'),
  image_url: z.object({
    url: z.string(),
    detail: z.enum(['auto', 'low', 'high']).optional(),
  }),
});

const contentPartSchema = z.union([textContentPartSchema, imageContentPartSchema]);

const messageContentSchema = z.union([z.string(), z.array(contentPartSchema)]);

const toolCallSchema = z.object({
  id: z.string(),
  type: z.literal('function'),
  function: z.object({
    name: z.string(),
    arguments: z.string(),
  }),
});

const chatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant', 'tool']),
  content: messageContentSchema.nullable(),
  name: z.string().optional(),
  tool_calls: z.array(toolCallSchema).optional(),
  tool_call_id: z.string().optional(),
});

const toolSchema = z.object({
  type: z.literal('function'),
  function: z.object({
    name: z.string(),
    description: z.string().optional(),
    parameters: z.record(z.string(), z.unknown()).optional(),
  }),
});

export const chatCompletionRequestSchema = z
  .object({
    model: z.string().min(1, 'model is required'),
    messages: z.array(chatMessageSchema).min(1, 'messages must contain at least one message'),
    temperature: z.number().min(0).max(2).optional(),
    top_p: z.number().min(0).max(1).optional(),
    n: z.number().int().positive().optional(),
    stream: z.boolean().optional(),
    stop: z.union([z.string(), z.array(z.string())]).optional(),
    max_tokens: z.number().int().positive().optional(),
    presence_penalty: z.number().min(-2).max(2).optional(),
    frequency_penalty: z.number().min(-2).max(2).optional(),
    logit_bias: z.record(z.string(), z.number()).optional(),
    user: z.string().optional(),
    tools: z.array(toolSchema).optional(),
    tool_choice: z
      .union([z.literal('none'), z.literal('auto'), z.record(z.string(), z.unknown())])
      .optional(),
    response_format: z.record(z.string(), z.unknown()).optional(),
    seed: z.number().int().optional(),
  })
  .passthrough();

export type ChatCompletionRequest = z.infer<typeof chatCompletionRequestSchema>;
