import { Routes, Route } from "react-router-dom";
import { 
  Login, 
  Dashboard, 
  NotFound, 
  FuelReports,
  HoursReports,
  Persons,
  Users,
  Profiles,
  UserActivity,
  FuelLightFleet,
  FuelHeavyFleet,
  FuelTank,
  Vehicles,
  Tracker,
  TrackerAlerts,
  TrackerMapPage,
  TrackerReport,
  HoursDailyEntry,
  HoursCompanies,
  HoursProjects,
  HoursEquipment,
  FleetList,
  FleetDetail,
  FleetDriverSheet,
  FleetCatalog,
  FleetDrivers,
  FuelTransfers,
  MaintenanceOrders,
  MaintenanceIncidents,
  MaintenanceCriticality,
  MaintenancePlan,
  MaintenanceCatalogs,
} from "@/pages";

import { AuthProvider, ConfirmProvider } from "@/context";
import { ProtectedRoute } from "@/components";

function App() {
  return (
    <ConfirmProvider>
      <AuthProvider>
        <Routes>
          <Route path='/' element={<Login />}/>
          <Route path='/login' element={<Login />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/security/persons" element={<Persons />} />
            <Route path="/security/users" element={<Users />} />
            <Route path="/security/profiles" element={<Profiles />} />
            <Route path="/security/activity" element={<UserActivity />} />
            <Route path="/fuel" element={<FuelLightFleet />} />
            <Route path="/fuel/heavy" element={<FuelHeavyFleet />} />
            <Route path="/fuel/tank" element={<FuelTank />} />
            <Route path="/fuel/transfers" element={<FuelTransfers />} />
            <Route path="/fuel/vehicles" element={<Vehicles />} />
            <Route path="/tracker" element={<Tracker />} />
            <Route path="/tracker/alerts" element={<TrackerAlerts />} />
            <Route path="/tracker/map" element={<TrackerMapPage />} />
            <Route path="/tracker/report" element={<TrackerReport />} />
            <Route path="/reports/fuel" element={<FuelReports />} />
            <Route path="/reports/hours" element={<HoursReports />} />
            <Route path="/hours" element={<HoursDailyEntry />} />
            <Route path="/hours/companies" element={<HoursCompanies />} />
            <Route path="/hours/projects" element={<HoursProjects />} />
            <Route path="/hours/equipment" element={<HoursEquipment />} />
            <Route path="/fleet" element={<FleetList />} />
            <Route path="/fleet/catalog" element={<FleetCatalog />} />
            <Route path="/fleet/drivers" element={<FleetDrivers />} />
            <Route path="/fleet/drivers/:id" element={<FleetDriverSheet />} />
            <Route path="/maintenance" element={<MaintenanceOrders />} />
            <Route path="/maintenance/incidents" element={<MaintenanceIncidents />} />
            <Route path="/maintenance/criticality" element={<MaintenanceCriticality />} />
            <Route path="/maintenance/plan" element={<MaintenancePlan />} />
            <Route path="/maintenance/catalogs" element={<MaintenanceCatalogs />} />
            <Route path="/fleet/:id" element={<FleetDetail />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </ConfirmProvider>
  );
}
export default App;