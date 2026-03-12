const Question = require('../models/question');
const Vehicle = require('../models/vehicule');

const questionPost = async (req, res) => {
  try {
    const { pregunta, vehiculo_id } = req.body;

    if (!pregunta || !vehiculo_id) {
      return res.status(400).json({ success: false });
    }

    const vehiculo = await Vehicle.findById(vehiculo_id);
    if (!vehiculo) {
      return res.status(404).json({ success: false, message: 'Vehículo no encontrado' });
    }

    if (!vehiculo.owner_id) {
      return res.status(500).json({ success: false, message: 'El vehículo no tiene dueño registrado' });
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

const questionGetByVehicle = async (req, res) => {
  try {
    const questions = await Question.find({ vehiculo_id: req.params.vehiculoId })
      .populate('usuario_pregunta_id', 'username nombre')
      .populate('usuario_duenio_id', 'username nombre')
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

const questionGetMine = async (req, res) => {
  try {
    const questions = await Question.find({ usuario_pregunta_id: req.user.id })
      .populate('vehiculo_id', 'marca modelo anio precio estado')
      .populate('usuario_duenio_id', 'username nombre')
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

const questionBlockUpdate = async (req, res) => {
  return res.status(405).json({ success: false });
};

module.exports = { questionPost, questionGetByVehicle, questionGetMine, questionBlockUpdate };
