const Answer = require('../models/answer');
const Question = require('../models/question');
const Vehicle = require('../models/vehicule');

const answerPost = async (req, res) => {
  try {
    const { pregunta_id, texto_respuesta } = req.body;

    if (!pregunta_id || !texto_respuesta) {
      return res.status(400).json({ success: false });
    }

    const pregunta = await Question.findById(pregunta_id);
    if (!pregunta) {
      return res.status(404).json({ success: false });
    }

    const vehiculo = await Vehicle.findById(pregunta.vehiculo_id);
    if (!vehiculo) {
      return res.status(404).json({ success: false });
    }

    // Only the vehicle owner can answer inbox questions.
    if (vehiculo.owner_id.toString() !== req.user.id) {
      return res.status(403).json({ success: false });
    }

    const existingAnswer = await Answer.findOne({ pregunta_id });
    if (existingAnswer) {
      return res.status(409).json({ success: false });
    }

    const nuevaRespuesta = new Answer({
      texto_respuesta,
      pregunta_id: pregunta._id,
      vehiculo_id: vehiculo._id,
      usuario_pregunta_id: pregunta.usuario_pregunta_id,
      usuario_responde_id: req.user.id
    });

    await nuevaRespuesta.save();

    res.status(201).json({
      success: true,
      data: nuevaRespuesta
    });
  } catch (error) {
    console.log(error);
    res.status(400).json({ success: false });
  }
};

const answerGetByQuestion = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Debes iniciar sesión para ver la respuesta.' });
    }

    const question = await Question.findById(req.params.preguntaId).lean();
    if (!question) {
      return res.status(404).json({ success: false });
    }

    const askerId = String(question.usuario_pregunta_id || '');
    const ownerId = String(question.usuario_duenio_id || '');
    if (userId !== askerId && userId !== ownerId) {
      return res.status(403).json({ success: false, message: 'Solo el interesado y el propietario pueden ver esta conversación.' });
    }

    const answer = await Answer.findOne({ pregunta_id: req.params.preguntaId })
      .populate('usuario_pregunta_id', 'username nombre foto_perfil')
      .populate('usuario_responde_id', 'username nombre foto_perfil');

    if (!answer) {
      return res.status(404).json({ success: false });
    }

    res.status(200).json({
      success: true,
      data: answer
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false });
  }
};

module.exports = { answerPost, answerGetByQuestion };