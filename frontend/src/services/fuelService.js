import { executeTransaction } from "./api";

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
  GET_REFUEL_BY_ID: 95,
  CREATE_HEAVY_REFUEL: 96,
  GET_HEAVY_REFUEL_BY_ID: 97,
  GET_ALL_HEAVY_REFUELS: 98,
  UPDATE_HEAVY_REFUEL: 99,
  DELETE_HEAVY_REFUEL: 100,
};

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
  getRefuelById(id) {
    return executeTransaction(TX.GET_REFUEL_BY_ID, { id }).then(unwrap);
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

  // ---------- Heavy fleet (pending transactions 96-100, English payload) ----------
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
};

export default fuelService;