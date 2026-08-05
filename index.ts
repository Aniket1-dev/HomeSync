// Supabase Edge Function: llm-score
// Deploy with: supabase functions deploy llm-score
// Set secret with: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//
// Called from the client like:
//   const { data, error } = await supabase.functions.invoke('llm-score', {
//     body: { bioA: "...", bioB: "..." }
//   });
//
// Keeps the Anthropic API key out of client-side code entirely.

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { bioA, bioB } = await req.json();

    if (!bioA || !bioB) {
      return new Response(JSON.stringify({ error: "bioA and bioB are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `You are scoring roommate compatibility from two self-written bios.
Consider values, communication style, and any explicit lifestyle preferences mentioned
that go beyond a simple checklist (e.g. work hours, noise tolerance, social needs).

Bio A: """${bioA}"""
Bio B: """${bioB}"""

Respond ONLY with valid JSON, no markdown fences, no preamble, in this exact shape:
{"score": <integer 0-100>, "justification": "<one sentence, under 25 words>"}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY ?? "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 200,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json();
    const text = data?.content?.map((b: any) => b.text || "").join("") ?? "{}";
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
