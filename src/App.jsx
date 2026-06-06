import { Routes, Route } from 'react-router-dom';
import HomeScreen from './components/HomeScreen.jsx';
import Lobby from './components/Lobby.jsx';
import GameView from './components/GameView.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeScreen />} />
      <Route path="/lobby/:code" element={<Lobby />} />
      <Route path="/game/:code" element={<GameView />} />
    </Routes>
  );
}
