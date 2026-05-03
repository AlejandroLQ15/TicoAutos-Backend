/**
 * Moderación de mensajes del inbox (preguntas y respuestas): filtro local + OpenAI.
 *
 * Variables:
 *   OPENAI_API_KEY               — obligatoria (cada mensaje se valida con la API).
 *   OPENAI_CHAT_MODERATION_MODEL — opcional, default gpt-4o-mini
 */

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const MAX_CHARS = 2800;

/** Mensaje único para el usuario ante datos de contacto (heurística o IA). */
const INVALID_PERSONAL_MSG =
  'Mensaje inválido, no se permite compartir información personal.';

const BASE_POLICY = `Eres moderador de un marketplace de vehículos en Costa Rica (TicoAutos), con política tipo Airbnb: comprador y vendedor solo pueden coordinar dentro de la plataforma.

RECHAZA (allow: false) si detectás CUALQUIERA de estas intenciones o datos:
- Teléfonos: con o sin +506; dígitos separados por espacios, guiones, puntos, barras o letras entre medio; grupos de 4+4 típicos de Costa Rica; números escritos con palabras ("ocho-tres-uno-seis"); "código país", "prefijo", "extensión", "me llamás", "contácteme", "te llamo", "mi línea", "mi cel", "WhatsApp", "Waze", "te paso el contacto".
- Correos: cualquier @, "arroba", dominios (gmail, hotmail, outlook, yahoo, icloud, proton), "mandame un mail".
- Redes o chats externos: @usuario, insta/instagram, tiktok, telegram, signal, X/Twitter, Facebook, "buscame en", links wa.me, t.me, etc.
- Dirección física muy puntual para verse fuera de la app o coordenadas GPS.
- Evasión: "te lo digo por privado", "mirá mi perfil", "te lo dicto".

PERMITE (allow: true) solo charla sobre el auto: estado, mecánica, documentación, precio genérico, disponibilidad, provincia amplia, financiamiento, "¿puedo verlo?" sin pedir datos de contacto.

Si hay CUALQUIER dato que permita contactar fuera de TicoAutos, respondé allow:false.

Responde únicamente con JSON: {"allow":true} o {"allow":false,"reason":"breve en español"}.`;

/**
 * Quita separadores invisibles que a veces se usan para colar dígitos.
 * @param {string} s
 */
function stripInvisibleSeparators(s) {
  return String(s).replace(/[\u200B-\u200D\uFEFF]/g, '');
}

/**
 * Normaliza para detectar teléfonos (NFKC: + y dígitos ancho completo → ASCII).
 * @param {string} s
 */
function normalizeForModeration(s) {
  let t = stripInvisibleSeparators(String(s || ''));
  t = t.replace(/&#43;/g, '+').replace(/&#x2b;/gi, '+').replace(/&plus;/gi, '+');
  return t.normalize('NFKC').normalize('NFC');
}

/**
 * Junta dígitos que el usuario separó con espacios, puntos, guiones, etc. (evasión "5 0 6 8 ...").
 * @param {string} t texto ya normalizado NFKC
 */
function robustDigitString(t) {
  let s = String(t || '');
  let prev;
  let guard = 0;
  do {
    prev = s;
    s = s.replace(/(\d)[\s.\/\-_+]{0,4}(?=\d)/g, '$1');
    guard += 1;
  } while (s !== prev && guard < 32);
  return s.replace(/\D/g, '');
}

/**
 * Dos años de 4 cifras seguidos (ej. 2024 2025), no es teléfono local.
 */
function isTwoAdjacentYears(a, b) {
  const y1 = parseInt(String(a), 10);
  const y2 = parseInt(String(b), 10);
  return y1 >= 1900 && y1 <= 2039 && y2 >= 1900 && y2 <= 2039;
}

/**
 * Ventana de 8 dígitos que parece celular/fijo CR sin prefijo país.
 */
function digitWindowLooksLikeCRLocal(eight) {
  if (!/^[2678]\d{7}$/.test(eight)) return false;
  const a = parseInt(eight.slice(0, 4), 10);
  const bStr = eight.slice(4, 8);
  const b = parseInt(bStr, 10);
  if (isTwoAdjacentYears(a, b)) return false;
  if (/^(\d)\1{7}$/.test(eight)) return false;
  const n = parseInt(eight, 10);
  if (n >= 10_000_000 && n % 10_000 === 0) return false;
  // Rangos de precio tipo 2500–3000 pegados en el stream de dígitos (25003000)
  if (a >= 1000 && a <= 9999 && bStr.length === 4 && b >= 1000 && b <= 9999 && a % 100 === 0 && b % 100 === 0) {
    return false;
  }
  return true;
}

/**
 * Bloqueo determinístico: correos, 506, números locales CR, internacional, enlaces, intención de contacto.
 * Se aplica antes y después de OpenAI.
 * @param {string} text ya normalizado (NFKC) o se normaliza dentro
 * @returns {{ allowed: false, message: string } | null}
 */
function heuristicContactBlock(text) {
  const t = normalizeForModeration(text);
  const lower = t.toLowerCase();

  if (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(t)) {
    return { allowed: false, message: INVALID_PERSONAL_MSG };
  }

  // "g mail", "correo en yahoo punto com", etc.
  if (/\b(g\s*mail|hot\s*mail|out\s*look|yahoo\s*mail)\b/i.test(t)) {
    return { allowed: false, message: INVALID_PERSONAL_MSG };
  }
  if (/\barroba\b/i.test(t) && /\b(correo|mail|email|gmail|hotmail)\b/i.test(t)) {
    return { allowed: false, message: INVALID_PERSONAL_MSG };
  }

  const digits = robustDigitString(t);

  if (/506[2-9]\d{7}/.test(digits)) {
    return { allowed: false, message: INVALID_PERSONAL_MSG };
  }

  for (let i = 0; i + 8 <= digits.length; i += 1) {
    const w = digits.slice(i, i + 8);
    if (digitWindowLooksLikeCRLocal(w)) {
      return { allowed: false, message: INVALID_PERSONAL_MSG };
    }
  }

  // EE.UU./Canadá +1 + 10 dígitos
  if (/^1\d{10}$/.test(digits) && /\+?\s*1[\s().-]*\d{3}/.test(t)) {
    return { allowed: false, message: INVALID_PERSONAL_MSG };
  }

  if (/\+\d{1,3}[\d\s().-]{8,18}\d{2}/.test(t)) {
    return { allowed: false, message: INVALID_PERSONAL_MSG };
  }

  const externalChat =
    /\b(wa\.me|api\.whatsapp|whatsapp\.com|t\.me\/|telegram\.me|telegram\.org|signal\.me)\b/i.test(
      lower
    );
  if (externalChat) {
    return { allowed: false, message: INVALID_PERSONAL_MSG };
  }

  const contactCue =
    /\b(n[uú]mero|numero|celular|\bcel\b|m[óo]vil|tel[eé]fono|telefono|whatsapp|wsp|wassap|\bwp\b|telegram|signal|llam(a|ame|ar|emos|o)|escrib(i|í|ime|inos|eme|anos|a)|cont[aá]ct(e|a|o|ame|eme|enos|ar|anos)|correo|email|gmail|hotmail|outlook|yahoo|icloud|proton|waze|coordina(r|mos)\s+(por\s+)?(fuera|whatsapp|wsp|tel[eé]fono|llamada))\b/i.test(
      t
    );

  const sharingIntent =
    /\b(pas(a|ame|o)|dejo|dejame|dicto|privado|afuera\s+de\s+la\s+app|fuera\s+de\s+tico|por\s+whatsapp|por\s+wsp|por\s+tel[eé]fono|me\s+llam(a|ás|as)|te\s+llamo|comunic(ar|ame|arse)|ubicacion\s+exacta|ubicación\s+exacta)\b/i.test(
      t
    );

  // Par XXXX-XXXX / XXXX XXXX típico de celular CR; no bloquear "2024-2025" ni precios "2500-3000" sin señal de contacto
  const pairSep = t.match(/\b([2678]\d{3})[\s.-]+(\d{4})\b/);
  if (pairSep) {
    const a = parseInt(pairSep[1], 10);
    const b = parseInt(pairSep[2], 10);
    if (!isTwoAdjacentYears(a, b)) {
      const startsWithLandline2 = pairSep[1][0] === '2';
      if (!(startsWithLandline2 && !contactCue && !sharingIntent)) {
        return { allowed: false, message: INVALID_PERSONAL_MSG };
      }
    }
  }

  if (contactCue && /\b\d{4}[\s.-]\d{4}\b/.test(t)) {
    return { allowed: false, message: INVALID_PERSONAL_MSG };
  }

  if ((contactCue || sharingIntent) && /\d{4}\s+\d{4}/.test(t)) {
    return { allowed: false, message: INVALID_PERSONAL_MSG };
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

/**
 * @returns {{ allowed: true } | { allowed: false, message: string, modelRejected?: boolean }}
 */
function parseVerdict(content) {
  const cleaned = stripJsonFence(content);
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return {
      allowed: false,
      modelRejected: false,
      message: 'No pudimos validar el mensaje. Reformúlalo sin datos de contacto e intenta de nuevo.',
    };
  }
  if (parsed.allow === true) return { allowed: true };
  if (parsed.allow === false && typeof parsed.reason === 'string' && parsed.reason.trim()) {
    return { allowed: false, modelRejected: true, message: parsed.reason.trim() };
  }
  if (parsed.allow === false) {
    return {
      allowed: false,
      modelRejected: true,
      message:
        'Por políticas de la plataforma no podemos publicar ese mensaje. Mantén la conversación aquí, sin datos de contacto personales.',
    };
  }
  return {
    allowed: false,
    modelRejected: false,
    message: 'No pudimos validar el mensaje. Intenta de nuevo con un texto más simple.',
  };
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

  const scanned = normalizeForModeration(trimmed);
  const blockedLocal = heuristicContactBlock(scanned);
  if (blockedLocal) {
    return blockedLocal;
  }

  const apiKey = (process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) {
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
          content: `Analiza el siguiente mensaje y responde solo con JSON según las reglas.\n\n{"mensaje":${JSON.stringify(scanned)}}`,
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
  const verdict = parseVerdict(rawContent);
  if (!verdict.allowed) {
    if (verdict.modelRejected) {
      return { allowed: false, message: INVALID_PERSONAL_MSG };
    }
    return { allowed: false, message: verdict.message };
  }
  // Por si el modelo se equivoca, misma verificación local tras la IA
  const postLocal = heuristicContactBlock(scanned);
  if (postLocal) return postLocal;
  return { allowed: true };
}

module.exports = { moderateOutboundChatText, MAX_CHARS };
