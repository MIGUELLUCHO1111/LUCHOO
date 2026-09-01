import api, { executeTransaction, getCurrentProfile } from "./api";

const TX = {
  CREATE_VEHICLE: 81,
  GET_VEHICLE_BY_ID: 82,
  GET_ALL_VEHICLES: 83,
  UPDATE_VEHICLE: 84,
  CREATE_REFUEL: 85,
  GET_REFUELS_BY_VEHICLE: 86,
  GET_ALL_REFUELS: 87,
  UPDATE_REFUEL: 88,
  DELETE_REFUEL: 89,
  DELETE_VEHICLE: 90,
  CREATE_HEAVY_REFUEL: 105,
  GET_HEAVY_REFUEL_BY_ID: 106,
  GET_ALL_HEAVY_REFUELS: 107,
  UPDATE_HEAVY_REFUEL: 108,
  DELETE_HEAVY_REFUEL: 109,
  GET_CARGA_BY_ID: 110,
  CREATE_TANK: 111,
  GET_ALL_TANKS: 112,
  GET_TANK_BY_ID: 113,
  UPDATE_TANK: 114,
  DELETE_TANK: 115,
  GET_MOVEMENTS_BY_TANK: 116,
  REGISTER_MOVEMENT: 117,
};

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

/** Las fotos vienen como ruta relativa (`/fuel/photos/file/...`); arma la URL completa. */
export const resolvePhotoUrl = (url) => (url ? `${API_BASE_URL}${url}` : null);

const unwrap = (res) => {
  const d = res?.data;
  if (d?.data?.data !== undefined) return d.data.data;
  if (Array.isArray(d?.data)) return d.data;
  return d;
};

const fuelService = {
  // ---------- Fleet (Light) vehicles ----------
  createVehicle(data) {
    return executeTransaction(TX.CREATE_VEHICLE, data).then(unwrap);
  },
  getVehicleById(id) {
    return executeTransaction(TX.GET_VEHICLE_BY_ID, { id }).then(unwrap);
  },
  getAllVehicles() {
    return executeTransaction(TX.GET_ALL_VEHICLES, {}).then(unwrap);
  },
  updateVehicle(id, data) {
    return executeTransaction(TX.UPDATE_VEHICLE, { id, ...data }).then(unwrap);
  },
  deleteVehicle(id) {
    return executeTransaction(TX.DELETE_VEHICLE, { id }).then(unwrap);
  },

  // ---------- Refuel records (light fleet, wire keys follow the backend) ----------
  createRefuel(data) {
    return executeTransaction(TX.CREATE_REFUEL, data).then(unwrap);
  },
  getCargaById(id) {
    return executeTransaction(TX.GET_CARGA_BY_ID, { id }).then(unwrap);
  },
  getRefuelsByVehicle(vehicleId) {
    return executeTransaction(TX.GET_REFUELS_BY_VEHICLE, { vehicle_id: vehicleId }).then(unwrap);
  },
  getAllRefuels() {
    return executeTransaction(TX.GET_ALL_REFUELS, {}).then(unwrap);
  },
  updateRefuel(id, data) {
    return executeTransaction(TX.UPDATE_REFUEL, { id, ...data }).then(unwrap);
  },
  deleteRefuel(id) {
    return executeTransaction(TX.DELETE_REFUEL, { id }).then(unwrap);
  },

  // ---------- Heavy fleet (Fuel.Pesada, tx 105-109) ----------
  createHeavyRefuel(data) {
    return executeTransaction(TX.CREATE_HEAVY_REFUEL, data).then(unwrap);
  },
  getHeavyRefuelById(id) {
    return executeTransaction(TX.GET_HEAVY_REFUEL_BY_ID, { id }).then(unwrap);
  },
  getAllHeavyRefuels() {
    return executeTransaction(TX.GET_ALL_HEAVY_REFUELS, {}).then(unwrap);
  },
  updateHeavyRefuel(id, data) {
    return executeTransaction(TX.UPDATE_HEAVY_REFUEL, { id, ...data }).then(unwrap);
  },
  deleteHeavyRefuel(id) {
    return executeTransaction(TX.DELETE_HEAVY_REFUEL, { id }).then(unwrap);
  },

  // ---------- Tanque de gasoil (Fuel.Tanque, tx 111-117) ----------
  createTank(data) {
    return executeTransaction(TX.CREATE_TANK, data).then(unwrap);
  },
  getAllTanks() {
    return executeTransaction(TX.GET_ALL_TANKS, {}).then(unwrap);
  },
  getTankById(id) {
    return executeTransaction(TX.GET_TANK_BY_ID, { id }).then(unwrap);
  },
  updateTank(id, data) {
    return executeTransaction(TX.UPDATE_TANK, { id, ...data }).then(unwrap);
  },
  deleteTank(id) {
    return executeTransaction(TX.DELETE_TANK, { id }).then(unwrap);
  },
  getMovementsByTank(tankId) {
    return executeTransaction(TX.GET_MOVEMENTS_BY_TANK, { tank_id: tankId }).then(unwrap);
  },
  registerMovement(data) {
    return executeTransaction(TX.REGISTER_MOVEMENT, data).then(unwrap);
  },

  // ---------- Fotos de llenado (fuera del dispatcher, multipart real) ----------
  uploadFuelPhoto({ targetType, targetId, file }) {
    const formData = new FormData();
    formData.append("target_type", targetType);
    formData.append("target_id", targetId);
    formData.append("profile", getCurrentProfile());
    formData.append("photo", file);
    return api
      .post("/fuel/photos", formData, { headers: { "Content-Type": undefined } })
      .then((res) => res?.data?.data);
  },
  deleteFuelPhoto(id) {
    return api.delete(`/fuel/photos/${id}`, { params: { profile: getCurrentProfile() } });
  },
};

export default fuelService;