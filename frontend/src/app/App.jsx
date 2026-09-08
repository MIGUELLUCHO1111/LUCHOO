import { Routes, Route } from "react-router-dom";
import { 
  Login, 
  Forgot, 
  ResetPassword, 
  Dashboard, 
  NotFound, 
  Reports,
  Persons,
  Users,
  Profiles,
  FuelLightFleet,
  FuelHeavyFleet,
  FuelTank,
  Vehicles,
  Tracker,
  TrackerMapPage,
  TrackerReport
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
          <Route path='/forgot-password' element={<Forgot />} />
          <Route path='/reset-password' element={<ResetPassword />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/security/persons" element={<Persons />} />
            <Route path="/security/users" element={<Users />} />
            <Route path="/security/profiles" element={<Profiles />} />
            <Route path="/fuel" element={<FuelLightFleet />} />
            <Route path="/fuel/heavy" element={<FuelHeavyFleet />} />
            <Route path="/fuel/tank" element={<FuelTank />} />
            <Route path="/fuel/vehicles" element={<Vehicles />} />
            <Route path="/tracker" element={<Tracker />} />
            <Route path="/tracker/map" element={<TrackerMapPage />} />
            <Route path="/tracker/report" element={<TrackerReport />} />
            <Route path="/reports" element={<Reports />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </ConfirmProvider>
  );
}
export default App;