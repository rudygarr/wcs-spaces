import { HashRouter, Routes, Route } from 'react-router-dom';
import { StoreProvider } from './lib/store';
import { SessionProvider } from './lib/session';
import Shell from './components/Shell';
import Home from './pages/Home';
import Calendar from './pages/Calendar';
import Spaces from './pages/Spaces';
import Requests from './pages/Requests';
import Book from './pages/Book';
import RoomDetail from './pages/RoomDetail';
import EventDetail from './pages/EventDetail';
import People from './pages/People';
import PersonDetail from './pages/PersonDetail';
import './App.css';

export default function App() {
  return (
    <StoreProvider>
      <SessionProvider>
        <HashRouter>
          <Shell>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/calendar" element={<Calendar />} />
              <Route path="/spaces" element={<Spaces />} />
              <Route path="/people" element={<People />} />
              <Route path="/person/:id" element={<PersonDetail />} />
              <Route path="/requests" element={<Requests />} />
              <Route path="/book" element={<Book />} />
              <Route path="/room/:id" element={<RoomDetail />} />
              <Route path="/event/:id" element={<EventDetail />} />
            </Routes>
          </Shell>
        </HashRouter>
      </SessionProvider>
    </StoreProvider>
  );
}
