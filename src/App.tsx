import { HashRouter, Routes, Route } from 'react-router-dom';
import { SessionProvider } from './lib/session';
import Shell from './components/Shell';
import Home from './pages/Home';
import Calendar from './pages/Calendar';
import Spaces from './pages/Spaces';
import Requests from './pages/Requests';
import './App.css';

export default function App() {
  return (
    <SessionProvider>
      <HashRouter>
        <Shell>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/spaces" element={<Spaces />} />
            <Route path="/requests" element={<Requests />} />
          </Routes>
        </Shell>
      </HashRouter>
    </SessionProvider>
  );
}
