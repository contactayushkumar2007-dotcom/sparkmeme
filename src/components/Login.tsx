import { useState } from "react";
import { supabase } from "../services/supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setLoading(true);
    setMessage("");
    const { error } = isSignUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });
    if (error) setMessage(error.message);
    else if (isSignUp)
      setMessage("Account created! Check your email to confirm, then log in.");
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold">
          {isSignUp ? "Create your account" : "Log in to SparkMeme"}
        </h1>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border rounded-lg p-3"
        />
        <input
          type="password"
          placeholder="Password (min 6 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border rounded-lg p-3"
        />
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full bg-black text-white rounded-lg p-3"
        >
          {loading ? "Please wait..." : isSignUp ? "Sign up" : "Log in"}
        </button>
        {message && <p className="text-sm">{message}</p>}
        <button
          onClick={() => setIsSignUp(!isSignUp)}
          className="text-sm underline"
        >
          {isSignUp ? "Already have an account? Log in" : "New here? Sign up"}
        </button>
      </div>
    </div>
  );
}