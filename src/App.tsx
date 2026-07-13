import { useQuiz } from "@/lib/useQuiz"
import { Terminal } from "@/variants/Terminal"

export function App() {
  const quiz = useQuiz()
  return <Terminal quiz={quiz} />
}

export default App
