import { HashRouter, Routes, Route } from 'react-router-dom';
import { StoreProvider } from './lib/store';
import { SessionProvider, useSession } from './lib/session';
import Shell from './components/Shell';
import Login from './pages/Login';
import Home from './pages/Home';
import Calendar from './pages/Calendar';
import Spaces from './pages/Spaces';
import Requests from './pages/Requests';
import Book from './pages/Book';
import RoomDetail from './pages/RoomDetail';
import EventDetail from './pages/EventDetail';
import RunSheet from './pages/RunSheet';
import People from './pages/People';
import PersonDetail from './pages/PersonDetail';
import AthleticsWeek from './pages/AthleticsWeek';
import Queue from './pages/Queue';
import WorkDetail from './pages/WorkDetail';
import Team from './pages/Team';
import MyRequests from './pages/MyRequests';
import Insights from './pages/Insights';
import Approvals from './pages/Approvals';
import Assets from './pages/Assets';
import AssetDetail from './pages/AssetDetail';
import Rentals from './pages/Rentals';
import RentalDetail from './pages/RentalDetail';
import Audit from './pages/Audit';
import Search from './pages/Search';
import './App.css';

function Gate() {
  const { authed } = useSession();
  if (!authed) return <Login />;
  return (
    <HashRouter>
      <Shell>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/spaces" element={<Spaces />} />
          <Route path="/people" element={<People />} />
          <Route path="/person/:id" element={<PersonDetail />} />
          <Route path="/athletics" element={<AthleticsWeek />} />
          <Route path="/requests" element={<Requests />} />
          <Route path="/queue" element={<Queue />} />
          <Route path="/team" element={<Team />} />
          <Route path="/my" element={<MyRequests />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/approvals" element={<Approvals />} />
          <Route path="/assets" element={<Assets />} />
          <Route path="/asset/:id" element={<AssetDetail />} />
          <Route path="/rentals" element={<Rentals />} />
          <Route path="/rental/:id" element={<RentalDetail />} />
          <Route path="/audit" element={<Audit />} />
          <Route path="/search" element={<Search />} />
          <Route path="/work/:id" element={<WorkDetail />} />
          <Route path="/book" element={<Book />} />
          <Route path="/room/:id" element={<RoomDetail />} />
          <Route path="/event/:id" element={<EventDetail />} />
          <Route path="/runsheet/:id" element={<RunSheet />} />
        </Routes>
      </Shell>
    </HashRouter>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <SessionProvider>
        <Gate />
      </SessionProvider>
    </StoreProvider>
  );
}
