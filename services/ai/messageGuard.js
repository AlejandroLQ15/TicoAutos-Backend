/**
 * Moderación de mensajes del inbox (preguntas y respuestas) vía OpenAI.
 *
 * Variables:
 *   OPENAI_API_KEY                      — obligatoria en producción
 *   OPENAI_CHAT_MODERATION_MODEL        — opcional, default gpt-4o-mini
 *   OPENAI_CHAT_MODERATION_DISABLED     — si es "true" y no hay API key, solo aplica el filtro
 *     heurístico local (tel/correo/enlaces). Con API key, OpenAI siempre corre después del heurístico.
 */

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const MAX_CHARS = 2800;

const CONTACT_BLOCK_MSG =
  'Por políticas de la plataforma no podés compartir teléfonos, correos ni enlaces para coordinar fuera del chat. Negociá la visita o los detalles aquí, sin datos de contacto personales.';

const BASE_POLICY = `Eres moderador de un marketplace de vehículos en Costa Rica (TicoAutos), con política tipo Airbnb: comprador y vendedor solo pueden coordinar dentro de la plataforma.

RECHAZA siempre (allow: false) si el mensaje de cualquier forma intenta compartir o pedir:
- Teléfonos en cualquier formato: con +506, 506, espacios, guiones, paréntesis, puntos entre dígitos, número escrito con palabras ("ocho tres uno seis..."), "código de país", "prefijo", "extensión", "me llamás al", "te dejo el cel", "mi línea", "WhatsApp", "Waze al número", etc.
- Correos electrónicos, dominios tipo gmail/hotmail/outlook/yahoo, o pedir "mandame un mail".
- Usuarios de redes (@usuario, "seguime en insta", "buscame en FB", TikTok, Telegram, Signal, X/Twitter).
- Enlaces a chats externos (wa.me, api.whatsapp.com, t.me, telegram.me, linktr.ee, etc.) o "te paso el link".
- Direcciones físicas muy específicas para verse fuera del contexto del anuncio (calle, número de casa, punto de encuentro con coordenadas).
- Cualquier truco para evadir: letras entre números, "línea nueva", "te lo dicto", "te lo paso en privado", "mirá mi perfil".

PERMITE (allow: true) solo contenido sobre el vehículo: estado, mecánica, documentación, precio en abstracto, disponibilidad, provincia general, si acepta financiamiento, "¿puedo verlo?" o "¿hacés prueba de manejo?" sin pedir teléfono ni red social.

Ante la duda entre permitir un dato que podría usarse para contacto fuera de la app, RECHAZÁ.

Responde únicamente con JSON válido: {"allow":true} o {"allow":false,"reason":"mensaje breve y cordial en español para mostrar al usuario"}.`;

/**
 * Quita separadores invisibles que a veces se usan para colar dígitos.
 * @param {string} s
 */
function stripInvisibleSeparators(s) {
  return String(s).replace(/[\u200B-\u200D\uFEFF]/g, '');
}

/**
 * Bloqueo determinístico (primera línea de defensa): detecta correos, 506+8 dígitos,
 * patrones internacionales obvios y enlaces típicos a WhatsApp/Telegram.
 * Siempre se aplica antes de OpenAI y no se omite con OPENAI_CHAT_MODERATION_DISABLED.
 * @param {string} text
 * @returns {{ allowed: false, message: string } | null}
 */
function heuristicContactBlock(text) {
  const raw = stripInvisibleSeparators(String(text || ''));
  const t = raw.normalize('NFC');
  const lower = t.toLowerCase();

  if (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(t)) {
    return { allowed: false, message: CONTACT_BLOCK_MSG };
  }

  const digits = t.replace(/\D/g, '');
  // Costa Rica: 506 + 8 dígitos (celular fijo o móvil local)
  if (/506[2-9]\d{7}/.test(digits)) {
    return { allowed: false, message: CONTACT_BLOCK_MSG };
  }

  // EE.UU./Canadá +1 + 10 dígitos
  if (/^1\d{10}$/.test(digits) && /\+?\s*1[\s().-]*\d{3}/.test(t)) {
    return { allowed: false, message: CONTACT_BLOCK_MSG };
  }

  // + internacional largo en el texto original (evita depender solo de 506)
  if (/\+\d{1,3}[\d\s().-]{8,18}\d{2}/.test(t)) {
    return { allowed: false, message: CONTACT_BLOCK_MSG };
  }

  const externalChat =
    /\b(wa\.me|api\.whatsapp|whatsapp\.com|t\.me\/|telegram\.me|telegram\.org|signal\.me)\b/i.test(
      lower
    );
  if (externalChat) {
    return { allowed: false, message: CONTACT_BLOCK_MSG };
  }

  const contactCue =
    /\b(n[uú]mero|numero|celular|cel\.|m[óo]vil|tel[eé]fono|telefono|whatsapp|wsp|wassap|telegram|signal|llam(a|ame|ar|emos)|escrib(i|í|ime|inos)|contact(o|ame)|correo|email|gmail|hotmail|outlook|yahoo|coordina(r|mos)\s+(por\s+)?(fuera|whatsapp|wsp|tel[eé]fono|llamada))\b/i.test(
      t
    );

  // Sin 506 explícito: si suena a contacto y hay dos grupos de 4 dígitos (típico celular CR)
  if (contactCue && /\b\d{4}[\s.-]\d{4}\b/.test(t)) {
    return { allowed: false, message: CONTACT_BLOCK_MSG };
  }

  return null;
}

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

  const blockedLocal = heuristicContactBlock(trimmed);
  if (blockedLocal) {
    return blockedLocal;
  }

  const apiKey = (process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) {
    if (process.env.OPENAI_CHAT_MODERATION_DISABLED === 'true') {
      console.warn(
        '[messageGuard] Sin OPENAI_API_KEY y OPENAI_CHAT_MODERATION_DISABLED=true — solo pasó el filtro heurístico (tel/correo/enlaces). Configurá OPENAI_API_KEY para moderación completa con IA.'
      );
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
