import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './i18n/LangContext'
import { Nav } from './components/Nav'
import { Footer } from './components/Footer'
import { Home } from './pages/Home'
import { Groups } from './pages/Groups'
import { Standings } from './pages/Standings'
import { Team } from './pages/Team'

export default function App() {
  return (
    <LangProvider>
      <BrowserRouter>
        <Nav />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/groups" element={<Groups />} />
          <Route path="/standings" element={<Standings />} />
          <Route path="/team/:id" element={<Team />} />
        </Routes>
        <Footer />
      </BrowserRouter>
    </LangProvider>
  )
}
