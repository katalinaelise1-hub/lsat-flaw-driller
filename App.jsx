import { useState, useRef } from "react";

const FLAW_TYPES = [
  "Ad Hominem",
  "Appeal to Authority",
  "Appeal to Popularity",
  "Circular Reasoning",
  "Confusing Correlation with Causation",
  "Equivocation",
  "False Dichotomy",
  "Hasty Generalization",
  "Ignoring the Possibility",
  "Sampling Bias",
  "Straw Man",
  "Unwarranted Assumption",
  "Necessary vs. Sufficient Confusion",
  "Part to Whole / Composition",
  "Whole to Part / Division",
  "Appeal to Emotion",
  "Slippery Slope",
];

const SYSTEM_PROMPT = `You are an expert LSAT instructor specializing in Flaw questions (also called "Identify the Flaw" or "Flaw in the Reasoning" questions). Your role is to generate realistic LSAT-style flaw questions and evaluate student answers.

When generating a question, respond ONLY with a valid JSON object (no markdown, no backticks) with this exact structure:
{
  "stimulus": "The argument or passage text here...",
  "question_stem": "The question stem (e.g., 'The reasoning in the argument is flawed because the argument...')",
  "answer_choices": {
    "A": "Answer choice A text",
    "B": "Answer choice B text", 
    "C": "Answer choice C text",
    "D": "Answer choice D text",
    "E": "Answer choice E text"
  },
  "correct_answer": "B",
  "flaw_type": "The specific flaw category name",
  "explanation": "Detailed explanation of why the correct answer is right and why each wrong answer is wrong, using precise LSAT logical language"
}

Rules for generating questions:
1. Write in authentic LSAT style - formal, dense, logical
2. The stimulus should be 3-6 sentences presenting a flawed argument
3. Wrong answers should be plausible but clearly incorrect on careful analysis
4. Use authentic LSAT answer choice language (e.g., "fails to consider that...", "takes for granted that...", "confuses a condition sufficient for...", "mistakes the cause of...")
5. Make difficulty appropriate for LSAT - challenging but fair
6. The flaw type requested should match one of the 17 standard LSAT flaw types`;

const EVAL_SYSTEM_PROMPT = `You are an expert LSAT instructor. A student has answered an LSAT flaw question. Evaluate their answer and provide coaching feedback.

Respond ONLY with a valid JSON object (no markdown, no backticks):
{
  "is_correct": true or false,
  "feedback": "2-3 sentence coaching feedback explaining the result",
  "key_takeaway": "One precise sentence about the logical language or concept to remember for this flaw type on the LSAT"
}`;

async function callClaude(system, userMessage) {
  const response = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.content?.map(b => b.text || '').join('') || '';
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

export default function App() {
  const [mode, setMode] = useState("home");
  const [selectedFlaw, setSelectedFlaw] = useState("Random");
  const [question, setQuestion] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [evaluation, setEvaluation] = useState(null);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({ correct: 0, total: 0, streak: 0 });
  const [flawHistory, setFlawHistory] = useState({});

  const fetchQuestion = async (flawType) => {
    setMode("loading");
    setError(null);
    setSelectedAnswer(null);
    setEvaluation(null);

    const target =
      flawType === "Random"
        ? FLAW_TYPES[Math.floor(Math.random() * FLAW_TYPES.length)]
        : flawType;

    try {
      const parsed = await callClaude(
        SYSTEM_PROMPT,
        `Generate a challenging LSAT-style Flaw question specifically testing the flaw type: "${target}". Make it realistic and difficult.`
      );
      parsed._targetFlaw = target;
      setQuestion(parsed);
      setMode("question");
    } catch (err) {
      setError("Failed to load question. Please check your API key and try again.");
      setMode("home");
    }
  };

  const submitAnswer = async (choice) => {
    setSelectedAnswer(choice);
    setMode("loading");

    const evalPrompt = `Question stimulus: "${question.stimulus}"
Question stem: "${question.question_stem}"
Answer choices: ${JSON.stringify(question.answer_choices)}
Correct answer: ${question.correct_answer}
Student selected: ${choice}
Flaw type being tested: ${question.flaw_type}`;

    try {
      const parsed = await callClaude(EVAL_SYSTEM_PROMPT, evalPrompt);
      setEvaluation(parsed);
    } catch {
      setEvaluation({
        is_correct: choice === question.correct_answer,
        feedback: "Answer evaluated locally.",
        key_takeaway: "",
      });
    }

    const isCorrect = choice === question.correct_answer;
    setStats(prev => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      total: prev.total + 1,
      streak: isCorrect ? prev.streak + 1 : 0,
    }));
    setFlawHistory(prev => ({
      ...prev,
      [question.flaw_type]: {
        correct: (prev[question.flaw_type]?.correct || 0) + (isCorrect ? 1 : 0),
        total: (prev[question.flaw_type]?.total || 0) + 1,
      },
    }));
    setMode("result");
  };

  const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : null;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0a0f",
      fontFamily: "'Georgia', 'Times New Roman', serif",
      color: "#e8e0d0",
    }}>
      {/* Top Bar */}
      <div style={{
        borderBottom: "1px solid #2a2a3a",
        padding: "16px 32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "#0d0d16",
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
          <span style={{ fontSize: "11px", letterSpacing: "0.2em", color: "#6060a0", textTransform: "uppercase", fontFamily: "monospace" }}>LSAT</span>
          <span style={{ fontSize: "20px", fontWeight: "bold", color: "#c8b89a", letterSpacing: "0.02em" }}>Flaw Driller</span>
        </div>
        <div style={{ display: "flex", gap: "24px", fontSize: "12px", fontFamily: "monospace" }}>
          {stats.total > 0 && (
            <>
              <span style={{ color: "#7070b0" }}>
                <span style={{ color: "#a0d090" }}>{stats.correct}</span>/{stats.total}
              </span>
              <span style={{ color: accuracy >= 70 ? "#a0d090" : accuracy >= 50 ? "#d0c060" : "#d07060" }}>
                {accuracy}%
              </span>
              {stats.streak > 1 && <span style={{ color: "#e0a040" }}>🔥 {stats.streak}</span>}
            </>
          )}
        </div>
      </div>

      <div style={{ maxWidth: "760px", margin: "0 auto", padding: "32px 24px" }}>

        {/* HOME */}
        {mode === "home" && (
          <div>
            <div style={{ marginBottom: "40px" }}>
              <h1 style={{ fontSize: "clamp(28px, 5vw, 42px)", fontWeight: "normal", lineHeight: 1.2, color: "#d4c8a8", marginBottom: "12px" }}>
                Master the Flaw
              </h1>
              <p style={{ color: "#6a6a8a", fontSize: "15px", lineHeight: 1.6, maxWidth: "520px" }}>
                Identify, name, and eliminate. Drill every flaw type with authentic LSAT-style questions and precise logical language coaching.
              </p>
            </div>

            <div style={{ marginBottom: "32px" }}>
              <div style={{ fontSize: "10px", letterSpacing: "0.15em", color: "#606080", marginBottom: "14px", textTransform: "uppercase", fontFamily: "monospace" }}>
                Target Flaw Type
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {["Random", ...FLAW_TYPES].map(f => (
                  <button
                    key={f}
                    onClick={() => setSelectedFlaw(f)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "3px",
                      border: selectedFlaw === f ? "1px solid #7070c0" : "1px solid #2a2a3a",
                      background: selectedFlaw === f ? "#1a1a30" : "transparent",
                      color: selectedFlaw === f ? "#a0a0e0" : "#606080",
                      fontSize: "12px",
                      cursor: "pointer",
                      fontFamily: "monospace",
                    }}
                  >
                    {f}
                    {flawHistory[f] && (
                      <span style={{
                        marginLeft: "6px",
                        color: (flawHistory[f].correct / flawHistory[f].total) >= 0.6 ? "#80c080" : "#c08080",
                        fontSize: "10px",
                      }}>
                        {flawHistory[f].correct}/{flawHistory[f].total}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div style={{ color: "#d07060", fontSize: "13px", marginBottom: "16px", fontFamily: "monospace" }}>{error}</div>
            )}

            <button
              onClick={() => fetchQuestion(selectedFlaw)}
              style={{
                padding: "14px 40px",
                background: "#1a1a30",
                border: "1px solid #4040a0",
                borderRadius: "3px",
                color: "#a0a0e0",
                fontSize: "14px",
                cursor: "pointer",
                fontFamily: "monospace",
                letterSpacing: "0.08em",
              }}
            >
              GENERATE QUESTION →
            </button>

            {/* Quick Reference */}
            <div style={{ marginTop: "56px", paddingTop: "32px", borderTop: "1px solid #1a1a28" }}>
              <div style={{ fontSize: "10px", letterSpacing: "0.15em", color: "#606080", marginBottom: "20px", textTransform: "uppercase", fontFamily: "monospace" }}>
                Quick Reference — LSAT Answer Choice Language
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "12px" }}>
                {[
                  { name: "Necessary vs. Sufficient", phrase: '"confuses a condition sufficient for X with one necessary for X"' },
                  { name: "Causation/Correlation", phrase: '"mistakes a correlation for a causal relationship"' },
                  { name: "Hasty Generalization", phrase: '"draws a general conclusion from an unrepresentative sample"' },
                  { name: "False Dichotomy", phrase: '"takes for granted that no option exists besides A or B"' },
                  { name: "Circular Reasoning", phrase: '"takes for granted the very conclusion it sets out to establish"' },
                  { name: "Ad Hominem", phrase: '"attacks the character of a person rather than addressing their argument"' },
                ].map(item => (
                  <div key={item.name} style={{
                    padding: "12px 16px",
                    background: "#0f0f1a",
                    border: "1px solid #1e1e30",
                    borderRadius: "3px",
                  }}>
                    <div style={{ fontSize: "11px", color: "#8080c0", fontFamily: "monospace", marginBottom: "4px" }}>{item.name}</div>
                    <div style={{ fontSize: "12px", color: "#787870", fontStyle: "italic", lineHeight: 1.5 }}>{item.phrase}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* LOADING */}
        {mode === "loading" && (
          <div style={{ textAlign: "center", paddingTop: "80px" }}>
            <div style={{
              display: "inline-block",
              width: "40px", height: "40px",
              border: "2px solid #2a2a3a",
              borderTopColor: "#6060a0",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <div style={{ marginTop: "20px", color: "#505070", fontSize: "13px", fontFamily: "monospace" }}>
              constructing argument...
            </div>
          </div>
        )}

        {/* QUESTION */}
        {mode === "question" && question && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
              <div style={{ fontSize: "10px", letterSpacing: "0.15em", color: "#606080", fontFamily: "monospace", textTransform: "uppercase" }}>
                Flaw Question
              </div>
              <div style={{
                fontSize: "11px", fontFamily: "monospace",
                padding: "3px 10px",
                border: "1px solid #2a2a40",
                borderRadius: "20px",
                color: "#5050a0",
              }}>
                {question._targetFlaw}
              </div>
            </div>

            <div style={{
              background: "#0d0d1a",
              border: "1px solid #1e1e30",
              borderLeft: "3px solid #3a3a70",
              borderRadius: "3px",
              padding: "24px 28px",
              marginBottom: "20px",
              lineHeight: 1.75,
              fontSize: "15px",
              color: "#d0c8a8",
            }}>
              {question.stimulus}
            </div>

            <div style={{ fontSize: "14px", color: "#a0a0c0", marginBottom: "24px", fontStyle: "italic", lineHeight: 1.6 }}>
              {question.question_stem}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {Object.entries(question.answer_choices).map(([letter, text]) => (
                <button
                  key={letter}
                  onClick={() => submitAnswer(letter)}
                  style={{
                    display: "flex", gap: "16px", alignItems: "flex-start",
                    padding: "16px 20px",
                    background: "#0d0d16",
                    border: "1px solid #1e1e30",
                    borderRadius: "3px",
                    color: "#c8c0a8",
                    fontSize: "14px",
                    cursor: "pointer",
                    textAlign: "left",
                    lineHeight: 1.6,
                  }}
                >
                  <span style={{
                    minWidth: "22px", height: "22px",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    border: "1px solid #3a3a60",
                    borderRadius: "50%",
                    fontSize: "11px",
                    color: "#7070b0",
                    fontFamily: "monospace",
                    flexShrink: 0,
                    marginTop: "1px",
                  }}>{letter}</span>
                  <span>{text}</span>
                </button>
              ))}
            </div>

            <button
              onClick={() => setMode("home")}
              style={{ marginTop: "24px", padding: "8px 16px", background: "transparent", border: "none", color: "#404060", fontSize: "12px", cursor: "pointer", fontFamily: "monospace" }}
            >
              ← back
            </button>
          </div>
        )}

        {/* RESULT */}
        {mode === "result" && question && evaluation && (
          <div>
            <div style={{
              padding: "20px 24px",
              marginBottom: "24px",
              background: evaluation.is_correct ? "rgba(40, 80, 40, 0.2)" : "rgba(80, 30, 30, 0.2)",
              border: `1px solid ${evaluation.is_correct ? "#2a5a2a" : "#6a2a2a"}`,
              borderRadius: "3px",
              display: "flex", alignItems: "center", gap: "16px",
            }}>
              <span style={{ fontSize: "28px" }}>{evaluation.is_correct ? "✓" : "✗"}</span>
              <div>
                <div style={{ fontSize: "16px", color: evaluation.is_correct ? "#80d080" : "#d08080", fontWeight: "bold", marginBottom: "4px" }}>
                  {evaluation.is_correct ? "Correct" : `Incorrect — Answer was ${question.correct_answer}`}
                </div>
                <div style={{ fontSize: "13px", color: "#908878", lineHeight: 1.5 }}>{evaluation.feedback}</div>
              </div>
            </div>

            <div style={{ marginBottom: "20px" }}>
              <div style={{ fontSize: "10px", letterSpacing: "0.15em", color: "#606080", fontFamily: "monospace", marginBottom: "14px", textTransform: "uppercase" }}>
                Answer Review
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {Object.entries(question.answer_choices).map(([letter, text]) => {
                  const isCorrect = letter === question.correct_answer;
                  const isSelected = letter === selectedAnswer;
                  return (
                    <div key={letter} style={{
                      display: "flex", gap: "14px", alignItems: "flex-start",
                      padding: "14px 18px",
                      background: isCorrect ? "rgba(30, 60, 30, 0.3)" : isSelected ? "rgba(60, 20, 20, 0.3)" : "#0a0a14",
                      border: `1px solid ${isCorrect ? "#2a5a2a" : isSelected ? "#5a2a2a" : "#1a1a28"}`,
                      borderRadius: "3px",
                      fontSize: "13px",
                      color: isCorrect ? "#90d090" : isSelected ? "#d09090" : "#706860",
                      lineHeight: 1.6,
                    }}>
                      <span style={{
                        minWidth: "20px", height: "20px",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        border: `1px solid ${isCorrect ? "#3a7a3a" : isSelected ? "#7a3a3a" : "#2a2a40"}`,
                        borderRadius: "50%",
                        fontSize: "10px",
                        fontFamily: "monospace",
                        flexShrink: 0,
                        marginTop: "1px",
                      }}>{letter}</span>
                      <span>{text}</span>
                      {isCorrect && <span style={{ marginLeft: "auto", color: "#60b060", fontSize: "11px", flexShrink: 0 }}>✓ correct</span>}
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{
              padding: "20px 24px",
              background: "#0a0a14",
              border: "1px solid #1a1a28",
              borderRadius: "3px",
              marginBottom: "20px",
            }}>
              <div style={{ fontSize: "10px", letterSpacing: "0.15em", color: "#606080", fontFamily: "monospace", marginBottom: "12px", textTransform: "uppercase" }}>
                Full Explanation
              </div>
              <div style={{ fontSize: "13px", color: "#908878", lineHeight: 1.75 }}>{question.explanation}</div>
            </div>

            {evaluation.key_takeaway && (
              <div style={{
                padding: "16px 20px",
                background: "#0d0d20",
                border: "1px solid #2a2a50",
                borderLeft: "3px solid #5050a0",
                borderRadius: "3px",
                marginBottom: "28px",
              }}>
                <div style={{ fontSize: "10px", letterSpacing: "0.15em", color: "#5050a0", fontFamily: "monospace", marginBottom: "8px", textTransform: "uppercase" }}>
                  Key Takeaway
                </div>
                <div style={{ fontSize: "13px", color: "#a0a0d0", lineHeight: 1.6, fontStyle: "italic" }}>{evaluation.key_takeaway}</div>
              </div>
            )}

            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <button
                onClick={() => fetchQuestion(selectedFlaw)}
                style={{
                  padding: "12px 28px",
                  background: "#1a1a30",
                  border: "1px solid #4040a0",
                  borderRadius: "3px",
                  color: "#a0a0e0",
                  fontSize: "13px",
                  cursor: "pointer",
                  fontFamily: "monospace",
                  letterSpacing: "0.06em",
                }}
              >
                NEXT QUESTION →
              </button>
              <button
                onClick={() => setMode("home")}
                style={{
                  padding: "12px 20px",
                  background: "transparent",
                  border: "1px solid #2a2a40",
                  borderRadius: "3px",
                  color: "#505070",
                  fontSize: "13px",
                  cursor: "pointer",
                  fontFamily: "monospace",
                }}
              >
                Change Focus
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
