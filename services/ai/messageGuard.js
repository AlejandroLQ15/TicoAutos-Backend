/**
 * Moderación de mensajes del inbox (preguntas y respuestas) vía OpenAI.
 *
 * Variables:
 *   OPENAI_API_KEY                      — obligatoria en producción
 *   OPENAI_CHAT_MODERATION_MODEL        — opcional, default gpt-4o-mini
 *   OPENAI_CHAT_MODERATION_DISABLED     — si es "true", omite la llamada (solo desarrollo local)
 */

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const MAX_CHARS = 2800;

const BASE_POLICY = `Eres moderador de un marketplace de vehículos en Costa Rica (TicoAutos).
Los interesados y vendedores deben coordinar solo dentro de la plataforma: no pueden intercambiar datos de contacto directo.

Rechaza (allow: false) si el texto intenta compartir o pedir: teléfonos, correos, WhatsApp/Telegram/Signal, @ de redes, enlaces a perfiles o chats externos, "escríbeme al", "te paso mi número", direcciones muy específicas para quedar fuera de la app, o cualquier forma de salirse de la plataforma para negociar.

Permite (allow: true) preguntas y respuestas sobre el auto, precio en abstracto, estado, documentación, disponibilidad, provincia genérica, citas del tipo "¿puedo verlo?" sin incluir teléfono ni usuario de red social.

Responde únicamente con un objeto JSON válido: {"allow":true} o {"allow":false,"reason":"mensaje breve y cordial en español para mostrar al usuario"}.`;

function systemPrompt(kind) {
  const role =
    kind === 'answer'
      ? 'El mensaje es la respuesta del vendedor al comprador.'
      : 'El mensaje es la pregunta o comentario del comprador al vendedor.';
  return `${role}\n\n${BASE_POLICY}`;
}

function stripJsonFence(raw) {
  const s = String(raw || '').trim();
  return s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
}

function parseVerdict(content) {
  const cleaned = stripJsonFence(content);
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return { allowed: false, message: 'No pudimos validar el mensaje. Reformúlalo sin datos de contacto e intenta de nuevo.' };
  }
  if (parsed.allow === true) return { allowed: true };
  if (parsed.allow === false && typeof parsed.reason === 'string' && parsed.reason.trim()) {
    return { allowed: false, message: parsed.reason.trim() };
  }
  if (parsed.allow === false) {
    return { allowed: false, message: 'Por políticas de la plataforma no podemos publicar ese mensaje. Mantén la conversación aquí, sin datos de contacto personales.' };
  }
  return { allowed: false, message: 'No pudimos validar el mensaje. Intenta de nuevo con un texto más simple.' };
}

/**
 * Evalúa si un texto puede publicarse en el chat.
 * @param {string} text
 * @param {{ kind: 'question' | 'answer' }} opts
 * @returns {Promise<{ allowed: true } | { allowed: false, message: string }>}
 */
async function moderateOutboundChatText(text, opts = {}) {
  const kind = opts.kind === 'answer' ? 'answer' : 'question';
  const trimmed = String(text ?? '').trim();

  if (!trimmed) {
    return { allowed: false, message: 'Escribe un mensaje antes de enviarlo.' };
  }
  if (trimmed.length > MAX_CHARS) {
    return { allowed: false, message: 'El mensaje es demasiado largo. Acórtalo e intenta de nuevo.' };
  }

  const apiKey = (process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) {
    if (process.env.OPENAI_CHAT_MODERATION_DISABLED === 'true') {
      console.warn('[messageGuard] OPENAI_CHAT_MODERATION_DISABLED=true — no se aplicó moderación.');
      return { allowed: true };
    }
    const err = new Error('OPENAI_API_KEY no está configurada.');
    err.code = 'OPENAI_NOT_CONFIGURED';
    throw err;
  }

  const model = (process.env.OPENAI_CHAT_MODERATION_MODEL || 'gpt-4o-mini').trim();
  const timeoutMs = 22000;
  const signal =
    typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
      ? AbortSignal.timeout(timeoutMs)
      : undefined;

  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 180,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt(kind) },
        {
          role: 'user',
          content: `Analiza el siguiente mensaje y responde solo con JSON según las reglas.\n\n{"mensaje":${JSON.stringify(trimmed)}}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = new Error(`OpenAI respondió ${res.status}`);
    err.code = 'OPENAI_HTTP_ERROR';
    throw err;
  }

  const data = await res.json();
  const rawContent = data.choices?.[0]?.message?.content;
  return parseVerdict(rawContent);
}

module.exports = { moderateOutboundChatText, MAX_CHARS };
