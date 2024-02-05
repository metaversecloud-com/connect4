import { Routes, Route } from "react-router-dom";
import PlayPage from "./pages/play";
import MainPage from "./pages/main";

function App() {
  return (
    <Routes>
      <Route path="/play" element={<PlayPage/>} />
      <Route path="/waiting" element={<div>Play</div>} />
      <Route path="/game" element={<MainPage />} />
      <Route path="/admin" element={<div>Admin</div>} />
    </Routes>
  )
}

export default App
