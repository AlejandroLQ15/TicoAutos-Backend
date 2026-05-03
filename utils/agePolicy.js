/**
 * Política de mayoría de edad para registro y sesiones.
 *
 * Regla de negocio (punto 1 del enunciado):
 * - La persona debe tener al menos MIN_REGISTRATION_AÑOS cumplidos
 *   según el calendario de Costa Rica (America/Costa_Rica).
 *
 * Fuente de fecha de nacimiento (punto 3):
 * - Preferimos la fecha devuelta por el API del padrón cuando exista.
 * - Si el API no la incluye (p. ej. gometa), el cliente envía fecha declarada
 *   y debe aceptar explícitamente la declaración de veracidad.
 *
 * @module utils/agePolicy
 */

const TZ_CR = 'America/Costa_Rica';

/** Edad mínima configurable; default 18 (mayoría de edad en CR). */
const minRegistrationAge = () =>
  Math.max(1, parseInt(process.env.MIN_REGISTRATION_AGE || '18', 10));

/**
 * Partes de calendario (año, mes, día) en la zona horaria indicada.
 * @param {Date} [when=new Date()]
 * @param {string} [timeZone=TZ_CR]
 * @returns {{ year: number, month: number, day: number }}
 */
function getCalendarYMDInZone(when = new Date(), timeZone = TZ_CR) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = fmt.formatToParts(when);
  const y = Number(parts.find((p) => p.type === 'year')?.value);
  const m = Number(parts.find((p) => p.type === 'month')?.value);
  const d = Number(parts.find((p) => p.type === 'day')?.value);
  return { year: y, month: m, day: d };
}

/**
 * Años cumplidos al día de referencia (solo fecha civil, sin hora).
 * @param {{ year: number, month: number, day: number }} birth
 * @param {{ year: number, month: number, day: number }} ref
 */
function completedAgeYears(birth, ref) {
  let age = ref.year - birth.year;
  if (ref.month < birth.month || (ref.month === birth.month && ref.day < birth.day)) {
    age -= 1;
  }
  return age;
}

/**
 * Valida formato estricto YYYY-MM-DD (solo dígitos y guiones).
 * @param {unknown} raw
 * @returns {string|null} fecha normalizada o null
 */
function normalizeISODateOnly(raw) {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return s;
}

/**
 * Intenta extraer fecha de nacimiento del JSON del padrón (claves habituales / futuras).
 * @param {object|null|undefined} data
 * @returns {string|null} YYYY-MM-DD o null
 */
function extractBirthDateFromPadronPayload(data) {
  if (!data || typeof data !== 'object') return null;

  const candidates = [
    data.fechaNacimiento,
    data.fecha_nacimiento,
    data.birthdate,
    data.dateOfBirth,
    data.date_of_birth,
    data.dob,
  ];

  const first = data.results?.[0];
  if (first && typeof first === 'object') {
    candidates.push(
      first.fechaNacimiento,
      first.fecha_nacimiento,
      first.birthdate,
      first.dateOfBirth,
      first.date_of_birth,
      first.dob,
      first.birthday
    );
  }

  for (const c of candidates) {
    const n = normalizeISODateOnly(c);
    if (n) return n;
    if (typeof c === 'string' && /^\d{8}$/.test(c)) {
      const y = c.slice(0, 4);
      const mo = c.slice(4, 6);
      const da = c.slice(6, 8);
      const n2 = normalizeISODateOnly(`${y}-${mo}-${da}`);
      if (n2) return n2;
    }
  }
  return null;
}

/**
 * Resuelve la fecha de nacimiento final y su origen para persistencia y auditoría.
 *
 * @param {object} opts
 * @param {object|null} opts.padronJson - Cuerpo JSON ya obtenido del padrón
 * @param {unknown} opts.declaredDate - fecha enviada por el cliente (YYYY-MM-DD)
 * @param {unknown} opts.declaracionAceptada - obligatoria si la fecha es declarada
 * @returns {{ ok: true, birthIso: string, source: 'padron'|'declarada' } | { ok: false, message: string, code?: string }}
 */
function resolveBirthDateForRegistration({ padronJson, declaredDate, declaracionAceptada }) {
  const fromPadron = extractBirthDateFromPadronPayload(padronJson);
  if (fromPadron) {
    return { ok: true, birthIso: fromPadron, source: 'padron' };
  }

  const declared = normalizeISODateOnly(declaredDate);
  if (!declared) {
    return {
      ok: false,
      code: 'FECHA_NACIMIENTO_REQUERIDA',
      message:
        'No pudimos obtener tu fecha de nacimiento desde el padrón. ' +
        'Indica tu fecha de nacimiento (formato AAAA-MM-DD) y confirma que es correcta.',
    };
  }

  const accepted = declaracionAceptada === true || declaracionAceptada === 'true' || declaracionAceptada === '1';
  if (!accepted) {
    return {
      ok: false,
      code: 'DECLARACION_REQUERIDA',
      message:
        'Debes confirmar que la fecha de nacimiento es veraz para poder continuar. ' +
        'Marca la casilla de declaración en el formulario.',
    };
  }

  return { ok: true, birthIso: declared, source: 'declarada' };
}

/**
 * Comprueba si la persona cumple la edad mínima a "hoy" en Costa Rica.
 * @param {string} birthIso - YYYY-MM-DD
 * @param {Date} [referenceDate=new Date()] - instante de referencia (se proyecta a calendario CR)
 * @returns {{ ok: true } | { ok: false, message: string, code: string }}
 */
function assertMeetsMinimumAge(birthIso, referenceDate = new Date()) {
  const birthStr = normalizeISODateOnly(birthIso);
  if (!birthStr) {
    return { ok: false, code: 'FECHA_INVALIDA', message: 'La fecha de nacimiento registrada no es válida. Contacta a soporte.' };
  }

  const [y, m, d] = birthStr.split('-').map(Number);
  const birth = { year: y, month: m, day: d };
  const ref = getCalendarYMDInZone(referenceDate, TZ_CR);
  const refStr = `${String(ref.year).padStart(4, '0')}-${String(ref.month).padStart(2, '0')}-${String(ref.day).padStart(2, '0')}`;

  if (birthStr > refStr) {
    return { ok: false, code: 'FECHA_FUTURA', message: 'La fecha de nacimiento no puede ser posterior a hoy.' };
  }

  const age = completedAgeYears(birth, ref);
  const min = minRegistrationAge();

  if (age < min) {
    return {
      ok: false,
      code: 'UNDERAGE',
      message: `Debes tener al menos ${min} años cumplidos para usar TicoAutos. Si crees que es un error, revisa tu fecha de nacimiento o el dato del padrón.`,
    };
  }

  return { ok: true };
}

module.exports = {
  TZ_CR,
  minRegistrationAge,
  getCalendarYMDInZone,
  completedAgeYears,
  normalizeISODateOnly,
  extractBirthDateFromPadronPayload,
  resolveBirthDateForRegistration,
  assertMeetsMinimumAge,
};
