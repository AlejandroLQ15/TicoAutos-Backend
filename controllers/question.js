const Question = require('../models/question');
const Vehicle = require('../models/vehicule');
const { moderateOutboundChatText } = require('../services/ai/messageGuard');

// Crear pregunta sobre un vehículo (mensaje del chat/inbox hacia el vendedor).
const questionPost = async (req, res) => {
  try {
    const { pregunta, vehiculo_id } = req.body;

    if (!pregunta || !vehiculo_id) {
      return res.status(400).json({ success: false, message: 'Indicá la pregunta y el vehículo.' });
    }

    const vehiculo = await Vehicle.findById(vehiculo_id);
    if (!vehiculo) {
      return res.status(404).json({ success: false, message: 'Vehículo no encontrado' });
    }

    if (!vehiculo.owner_id) {
      return res.status(500).json({ success: false, message: 'El vehículo no tiene dueño registrado' });
    }

    let moderation;
    try {
      moderation = await moderateOutboundChatText(pregunta, { kind: 'question' });
    } catch (modErr) {
      console.error('[questionPost] Moderación:', modErr.message);
      return res.status(503).json({
        success: false,
        code: 'MODERATION_UNAVAILABLE',
        message:
          modErr.code === 'OPENAI_NOT_CONFIGURED'
            ? 'El servicio de revisión de mensajes no está configurado. Contactá al administrador.'
            : 'No pudimos revisar tu mensaje en este momento. Intentá de nuevo en unos minutos.',
      });
    }
    if (!moderation.allowed) {
      return res.status(422).json({
        success: false,
        code: 'MESSAGE_MODERATION',
        message: moderation.message,
      });
    }

    const nuevaPregunta = new Question({
      pregunta,
      vehiculo_id,
      usuario_pregunta_id: req.user.id,
      usuario_duenio_id: vehiculo.owner_id
    });

    await nuevaPregunta.save();

    res.status(201).json({
      success: true,
      data: nuevaPregunta
    });
  } catch (error) {
    console.log(error);
    res.status(400).json({ success: false, message: error.message });
  }
};

// Lista preguntas de un auto solo para quien preguntó o el dueño del anuncio (privacidad).
const questionGetByVehicle = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Debes iniciar sesión para ver las preguntas.' });
    }

    const questions = await Question.find({ vehiculo_id: req.params.vehiculoId })
      .populate('usuario_pregunta_id', 'username nombre foto_perfil')
      .populate('usuario_duenio_id', 'username nombre foto_perfil')
      .sort({ fecha_pregunta: -1 })
      .lean();

    const filtered = questions.filter(
      (q) =>
        String(q.usuario_pregunta_id?._id || q.usuario_pregunta_id) === String(userId) ||
        String(q.usuario_duenio_id?._id || q.usuario_duenio_id) === String(userId)
    );

    res.status(200).json({
      success: true,
      data: filtered
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Preguntas que yo hice a otros vendedores (mi bandeja como comprador).
const questionGetMine = async (req, res) => {
  try {
    const questions = await Question.find({ usuario_pregunta_id: req.user.id })
      .populate('vehiculo_id', 'marca modelo anio precio estado')
      .populate('usuario_duenio_id', 'username nombre foto_perfil')
      .sort({ fecha_pregunta: -1 });

    res.status(200).json({
      success: true,
      data: questions
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Las preguntas no se editan por requisito del negocio (historial fiel del chat).
const questionBlockUpdate = async (req, res) => {
  return res.status(405).json({ success: false });
};

module.exports = { questionPost, questionGetByVehicle, questionGetMine, questionBlockUpdate };