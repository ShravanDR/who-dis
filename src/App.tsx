import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Landing from './screens/Landing'
import Setup from './screens/Setup'
import JoinGame from './screens/JoinGame'
import ClueSubmission from './screens/ClueSubmission'
import SubmissionMonitor from './screens/SubmissionMonitor'
import Quiz from './screens/Quiz'

export default function App() {
  return (
    <BrowserRouter basename="/who-dis">
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/setup" element={<Setup />} />
        <Route path="/join/:code" element={<JoinGame />} />
        <Route path="/submit/:code" element={<ClueSubmission />} />
        <Route path="/monitor/:code" element={<SubmissionMonitor />} />
        <Route path="/quiz/:code" element={<Quiz />} />
      </Routes>
    </BrowserRouter>
  )
}
