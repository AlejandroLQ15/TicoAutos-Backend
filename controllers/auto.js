const Vehicle = require('../models/vehicule');

const autoPost = async (req, res) => {
  try {
    const { marca, modelo, anio, precio, estado } = req.body;
    
    if (!marca || !modelo || !anio || !precio) {
      return res.status(400).json({
        success: false,
        message: 'All fields (marca, modelo, anio, precio) are required'
      });
    }
    
    const nuevoAuto = new Vehicle({
      marca,
      modelo,
      anio,
      precio,
      estado: estado || 'disponible',
      owner_id: req.user.id
    });
    
    await nuevoAuto.save();
    res.status(201).json({
      success: true,
      data: nuevoAuto
    });
  } catch (error) {
    console.log(error);
    res.status(400).json({ success: false });
  }
};

const autoGet = async (req, res) => {
  try {
    const autos = await Vehicle.find().populate('owner_id', 'username nombre');
    res.status(200).json({
      success: true,
      data: autos
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false});
  }
};

const autoGetMine = async (req, res) => {
  try {
    const autos = await Vehicle.find({ owner_id: req.user.id }).populate('owner_id', 'username nombre');
    res.status(200).json({
      success: true,
      data: autos
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false });
  }
};

const autoGetById = async (req, res) => {
  try {
    const auto = await Vehicle.findById(req.params.id).populate('owner_id', 'username nombre');
    if (!auto) {
      return res.status(404).json({ success: false});
    }
    
    res.status(200).json({
      success: true,
      message: 'Auto retrieved successfully',
      data: auto
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false });
  }
};

const autoDelete = async (req, res) => {
  try {
    const auto = await Vehicle.findById(req.params.id);
    if (!auto) {
      return res.status(404).json({ success: false });
    }
    
    if (auto.owner_id.toString() !== req.user.id) {
      return res.status(403).json({ success: false });
    }
    
    await Vehicle.findByIdAndDelete(req.params.id);
    
    res.status(200).json({
      success: true,
      data: auto
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false});
  }
};

const autoPut = async (req, res) => {
  try {
    const auto = await Vehicle.findById(req.params.id);
    if (!auto) {
      return res.status(404).json({ success: false });
    }

    if (auto.owner_id.toString() !== req.user.id) {
      return res.status(403).json({ success: false });
    }

    const allowedFields = ['marca', 'modelo', 'anio', 'precio', 'estado'];
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        auto[field] = req.body[field];
      }
    }

    await auto.save();

    res.status(200).json({
      success: true,
      data: auto
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false});
  }
};

module.exports = { autoPost, autoGet, autoGetMine, autoGetById, autoDelete, autoPut };