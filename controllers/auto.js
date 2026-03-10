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
      message: 'Auto created successfully',
      data: nuevoAuto
    });
  } catch (error) {
    console.log(error);
    res.status(400).json({ success: false, message: 'Error creating auto' });
  }
};

const autoGet = async (req, res) => {
  try {
    const autos = await Vehicle.find().populate('owner_id', 'username nombre');
    res.status(200).json({
      success: true,
      message: 'Autos retrieved successfully',
      data: autos
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: 'Error retrieving autos' });
  }
};

const autoGetById = async (req, res) => {
  try {
    const auto = await Vehicle.findById(req.params.id).populate('owner_id', 'username nombre');
    if (!auto) {
      return res.status(404).json({ success: false, message: 'Auto not found' });
    }
    
    res.status(200).json({
      success: true,
      message: 'Auto retrieved successfully',
      data: auto
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: 'Error retrieving auto' });
  }
};

const autoDelete = async (req, res) => {
  try {
    const auto = await Vehicle.findById(req.params.id);
    if (!auto) {
      return res.status(404).json({ success: false, message: 'Auto not found' });
    }
    
    if (auto.owner_id.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized. You are not the owner of this vehicle.' });
    }
    
    await Vehicle.findByIdAndDelete(req.params.id);
    
    res.status(200).json({
      success: true,
      message: 'Auto deleted successfully',
      data: auto
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: 'Error deleting auto' });
  }
};

module.exports = { autoPost, autoGet, autoGetById, autoDelete };