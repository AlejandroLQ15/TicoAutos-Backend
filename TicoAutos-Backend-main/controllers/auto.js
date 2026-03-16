const Vehicle = require('../models/vehicule');

const autoPost = async (req, res) => {
  try {
    const body = req.body || {};
    const marca = (body.marca || '').trim();
    const modelo = (body.modelo || '').trim();
    const anio = body.anio != null && body.anio !== '' ? parseInt(body.anio, 10) : null;
    const precio = body.precio != null && body.precio !== '' ? parseFloat(body.precio) : null;
    const estado = (body.estado || 'disponible').toLowerCase();
    const kilometraje = body.kilometraje != null && body.kilometraje !== '' ? parseInt(body.kilometraje, 10) : null;
    const tipoCombustible = (body.tipoCombustible || '').toLowerCase() || null;
    const tipoTransmision = (body.tipoTransmision || '').toLowerCase() || null;
    const provincia = (body.provincia || '').trim() || null;

    if (!marca || !modelo || anio == null || precio == null) {
      return res.status(400).json({
        success: false,
        message: 'Marca, modelo, año y precio son obligatorios.'
      });
    }

    const filesList = Array.isArray(req.files) ? req.files : (req.files ? [req.files].flat() : []);
    const fotos = filesList.map((f) => '/uploads/vehicles/' + (f.filename || f.name));

    const nuevoAuto = new Vehicle({
      marca,
      modelo,
      anio,
      precio,
      estado: ['disponible', 'reservado', 'vendido'].includes(estado) ? estado : 'disponible',
      fotos,
      kilometraje: Number.isInteger(kilometraje) && kilometraje >= 0 ? kilometraje : null,
      tipoCombustible: ['gasolina', 'diesel', 'hibrido', 'electrico'].includes(tipoCombustible) ? tipoCombustible : null,
      tipoTransmision: ['automatico', 'manual'].includes(tipoTransmision) ? tipoTransmision : null,
      provincia: provincia || null,
      owner_id: req.user.id
    });

    await nuevoAuto.save();
    res.status(201).json({
      success: true,
      data: nuevoAuto
    });
  } catch (error) {
    console.log(error);
    res.status(400).json({ success: false, message: error.message || 'Error al crear vehículo' });
  }
};

const autoGet = async (req, res) => {
  try {
    const {
      marca,
      modelo,
      minAnio,
      maxAnio,
      minPrecio,
      maxPrecio,
      estado,
      tipoCombustible,
      tipoTransmision,
      page = 1,
      limit = 10
    } = req.query;

    const filter = {};

    if (marca && String(marca).trim() !== '') {
      filter.marca = new RegExp(String(marca).trim(), 'i');
    }
    if (modelo && String(modelo).trim() !== '') {
      filter.modelo = new RegExp(String(modelo).trim(), 'i');
    }
    if (minAnio !== undefined && minAnio !== '') {
      const n = parseInt(minAnio, 10);
      if (!Number.isNaN(n)) filter.anio = { ...(filter.anio || {}), $gte: n };
    }
    if (maxAnio !== undefined && maxAnio !== '') {
      const n = parseInt(maxAnio, 10);
      if (!Number.isNaN(n)) filter.anio = { ...(filter.anio || {}), $lte: n };
    }
    if (minPrecio !== undefined && minPrecio !== '') {
      const n = parseFloat(minPrecio);
      if (!Number.isNaN(n)) filter.precio = { ...(filter.precio || {}), $gte: n };
    }
    if (maxPrecio !== undefined && maxPrecio !== '') {
      const n = parseFloat(maxPrecio);
      if (!Number.isNaN(n)) filter.precio = { ...(filter.precio || {}), $lte: n };
    }
    if (estado && ['disponible', 'reservado', 'vendido'].includes(String(estado).toLowerCase())) {
      filter.estado = String(estado).toLowerCase();
    }
    if (tipoCombustible && ['gasolina', 'diesel', 'hibrido', 'electrico'].includes(String(tipoCombustible).toLowerCase())) {
      filter.tipoCombustible = String(tipoCombustible).toLowerCase();
    }
    if (tipoTransmision && ['automatico', 'manual'].includes(String(tipoTransmision).toLowerCase())) {
      filter.tipoTransmision = String(tipoTransmision).toLowerCase();
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const [autos, totalItems] = await Promise.all([
      Vehicle.find(filter)
        .populate('owner_id', 'username nombre')
        .sort({ anio: -1, precio: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Vehicle.countDocuments(filter)
    ]);

    const totalPages = Math.max(1, Math.ceil(totalItems / limitNum));

    res.status(200).json({
      success: true,
      data: autos,
      page: pageNum,
      limit: limitNum,
      totalPages,
      totalItems
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false });
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

    const body = req.body || {};
    if (body.marca !== undefined) auto.marca = String(body.marca).trim();
    if (body.modelo !== undefined) auto.modelo = String(body.modelo).trim();
    if (body.anio !== undefined && body.anio !== '') auto.anio = parseInt(body.anio, 10);
    if (body.precio !== undefined && body.precio !== '') auto.precio = parseFloat(body.precio);
    if (body.estado !== undefined && ['disponible', 'reservado', 'vendido'].includes(String(body.estado).toLowerCase())) auto.estado = String(body.estado).toLowerCase();
    if (body.kilometraje !== undefined) auto.kilometraje = body.kilometraje === '' ? null : parseInt(body.kilometraje, 10);
    if (body.tipoCombustible !== undefined && ['gasolina', 'diesel', 'hibrido', 'electrico'].includes(String(body.tipoCombustible).toLowerCase())) auto.tipoCombustible = String(body.tipoCombustible).toLowerCase();
    if (body.tipoTransmision !== undefined) auto.tipoTransmision = ['automatico', 'manual'].includes(String(body.tipoTransmision).toLowerCase()) ? String(body.tipoTransmision).toLowerCase() : null;
    if (body.provincia !== undefined) auto.provincia = (body.provincia || '').trim() || null;

    const filesList = Array.isArray(req.files) ? req.files : (req.files ? [req.files].flat() : []);
    if (filesList.length > 0) {
      auto.fotos = filesList.map((f) => '/uploads/vehicles/' + (f.filename || f.name));
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