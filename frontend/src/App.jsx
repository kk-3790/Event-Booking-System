import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import EventList from './pages/EventList';

function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<EventList />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* More routes (event details, booking, payment, my-bookings,
            organizer dashboard, admin dashboard) get added here as we
            build each page. */}
      </Routes>
    </>
  );
}

export default App;
