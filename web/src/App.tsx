import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { Protected } from './lib/auth';
import { SettingsProvider } from './lib/settings';
import Analytics from './pages/Analytics';
import { Forgot, Login, Register, Reset } from './pages/Auth';
import Assignments from './pages/Assignments';
import Classes from './pages/Classes';
import Dashboard from './pages/Dashboard';
import Focus from './pages/Focus';
import Landing from './pages/Landing';
import Library from './pages/Library';
import Notes from './pages/Notes';
import Notifications from './pages/Notifications';
import Planner from './pages/Planner';
import Settings from './pages/Settings';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot" element={<Forgot />} />
      <Route path="/reset" element={<Reset />} />
      <Route path="/app" element={<Protected><SettingsProvider><AppShell /></SettingsProvider></Protected>}>
        <Route index element={<Dashboard />} />
        <Route path="planner" element={<Planner />} />
        <Route path="classes" element={<Classes />} />
        <Route path="assignments" element={<Assignments />} />
        <Route path="library" element={<Library />} />
        <Route path="notes" element={<Notes />} />
        <Route path="focus" element={<Focus />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
