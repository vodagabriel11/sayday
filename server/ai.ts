import OpenAI from "openai";
import { type ParseIntentResponse } from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const SYSTEM_PROMPT = `Parse user input→JSON.

LANGUAGE RULE (HIGHEST PRIORITY): Detect the language of the user's input. ALL text output fields (title, description, chatResponse, structuredContent) MUST be in the SAME language as the input. NEVER translate to a different language.

MULTIPLE ITEMS: If the user mentions MULTIPLE distinct tasks/reminders/events/notes in ONE message, return {"items":[...array of item objects...]}. Each item is a separate object with all fields below. ONLY use the array format when there are genuinely 2+ separate items. For a single item, return the flat object directly (no "items" wrapper).

action: "create"(default) or "update"(move/change/reschedule→set searchTitle to find existing item).
type: "event"=happens at time w/ duration(meeting,concert,dinner). "reminder"=do something at time(call mom,take medicine). "note"=info w/o time(list,idea,fact).
TIME RULES: startAt/endAt MUST be FULL ISO8601: "2026-03-11T15:00:00Z". NEVER just "T15:00:00Z". Use current date for today. Do NOT convert timezone — "3 PM" on 2026-03-11→"2026-03-11T15:00:00Z". endAt: ONLY set endAt if user explicitly mentions a duration or end time. Otherwise set endAt to null.
TITLE RULES:
- For REMINDERS/EVENTS: short imperative command capturing the FULL PURPOSE. Strip prefixes like "remind me"/"remember to". NEVER include time/hour/date in the title — time goes ONLY in startAt. Keep ALL context about WHY or WHAT. Use imperative form. Max 60ch. Examples: "Remind me to call Fane at 6:30 to wish him happy birthday"→title:"Sună-l pe Fane să-i spui la mulți ani". "Call dad at 3 PM to ask about the car"→title:"Call dad to ask about the car".
- For NOTES: title MUST be a SHORT DESCRIPTIVE LABEL (2-5 words) that categorizes the note content. NEVER enumerate items in the title. NEVER use verbs like "Buy"/"Cumpără" followed by item lists. Examples: "shopping list: bread, eggs, milk"→title:"Listă de cumpărături". "ideas for vacation: beach, mountains"→title:"Idei de vacanță". "meeting notes about Q3 budget"→title:"Meeting notes Q3 budget". "recipe for chocolate cake with flour sugar eggs"→title:"Rețetă tort de ciocolată". The title is a LABEL, the details go in structuredContent bullets.
description: 1 sentence. tags: exactly 1(Personal/Work/Health/Shopping/Travel/Finance/Music/Food/Fitness/Education/Family/Social).
chatResponse: casual, natural confirmation in input language, ~8-15 words. For multiple items, write ONE combined chatResponse summarizing all items. E.g. "Done! Added 4 reminders and 1 event for tomorrow."
structuredContent: For LISTS (shopping, groceries, to-do, etc.)→bullets=just item names (e.g. "Pâine","Ouă"), body=null. For NOTES (ideas, plans, thoughts, voice memos)→You are a voice-to-text editor. Clean up the user's raw spoken thoughts into clear, easy-to-read text. Rules: (1) Fix grammar, remove filler words, false starts, repetitions (2) Organize into logical paragraphs with clear flow (3) Use SIMPLE, DIRECT language — write like a normal person, NOT like a poet or journalist. No fancy words, no pompous phrases, no dramatic flair. Just plain, clear text that anyone can scan quickly. (4) PRESERVE ALL ideas, details, and nuance — edit for clarity, NOT brevity (5) Use markdown: **bold** for key terms, bullet lists where natural. Do NOT use ## headings. (6) NEVER repeat the title in the body — the title is already shown above, so start directly with the content. (7) The result should feel like the user typed it out cleanly themselves. Set body=the full edited text (markdown string), bullets=key takeaways (3-8 short points), summary=1 sentence overview. For reminders/events→body=null, max 2 bullets, 1 sentence summary.
notificationType: "call" if user mentions calling, "vibrate" if user mentions vibration. null if not mentioned. reminderOffsets:[minutes before]. recurringIntervalMinutes: 30/60/120/1440/10080/43200.
emoji: Pick ONE emoji that best represents the task/event/note content. Examples: call→📞, gym→💪, eat/food→🍽️, meeting→🤝, doctor→🏥, haircut→💇, water plants→🌱, shopping→🛒, email→📧, concert→🎵, study→📚, walk→🚶, medicine→💊, birthday→🎂, travel→✈️, cleaning→🧹, cooking→👨‍🍳, sleep→😴, baby→👶, car→🚗. Always provide exactly 1 emoji.

Single item: {"action":"create|update","searchTitle":"string|null","type":"reminder|event|note","title":"string","description":"string|null","startAt":"ISO|null","endAt":"ISO|null","location":"string|null","tags":["string"],"structuredContent":{"bullets":[],"summary":"","body":"markdown text or null"},"confidence":0.9,"explanation":"short","chatResponse":"","notificationType":"call|vibrate|null","reminderOffsets":[],"recurringIntervalMinutes":null,"emoji":"🔔"}
Multiple items: {"items":[{...item1},{...item2}...],"chatResponse":"combined confirmation"}`;

export async function parseIntent(text: string): Promise<ParseIntentResponse[]> {
  const now = new Date().toISOString();

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Now: ${now}\n"${text}"` },
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 4096,
        temperature: 0.3,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        console.error(`Attempt ${attempt + 1}: AI returned empty content. Finish reason: ${response.choices[0]?.finish_reason}`);
        continue;
      }

      const parsed = JSON.parse(content);

      if (parsed.items && Array.isArray(parsed.items)) {
        const combinedChat = parsed.chatResponse || "";
        const results: ParseIntentResponse[] = [];
        for (const item of parsed.items) {
          if (!item.type || !item.title) continue;
          if (item.tags && Array.isArray(item.tags) && item.tags.length > 1) {
            item.tags = [item.tags[0]];
          }
          if (!item.chatResponse) item.chatResponse = combinedChat;
          results.push(item as ParseIntentResponse);
        }
        if (results.length === 0) {
          console.error(`Attempt ${attempt + 1}: AI returned items array but none were valid:`, content);
          continue;
        }
        return results;
      }

      if (!parsed.type || !parsed.title) {
        console.error(`Attempt ${attempt + 1}: AI returned incomplete JSON:`, content);
        continue;
      }
      if (parsed.tags && Array.isArray(parsed.tags) && parsed.tags.length > 1) {
        parsed.tags = [parsed.tags[0]];
      }
      return [parsed as ParseIntentResponse];
    } catch (err: any) {
      console.error(`Attempt ${attempt + 1} error:`, err.message);
      if (attempt === 1) throw err;
    }
  }

  throw new Error("AI returned incomplete response after retries");
}

export async function transcribeAudio(audioBuffer: Buffer): Promise<string> {
  const { toFile } = await import("openai");
  const file = await toFile(audioBuffer, "audio.webm");
  const response = await openai.audio.transcriptions.create({
    file,
    model: "gpt-4o-transcribe",
    prompt: "Transcribe exactly as spoken in the original language. Do not translate.",
  });
  return response.text;
}

export async function describeImage(base64Image: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_completion_tokens: 1024,
    temperature: 0.3,
    messages: [
      {
        role: "system",
        content: `You extract actionable information from images to create tasks, reminders, events, or notes.

RULES:
1. If you see a LIST (shopping, to-do, groceries, checklist) → output it as: "List: item1, item2, item3..."
2. If you see a SCHEDULE, CALENDAR, or APPOINTMENT → output each event with date/time: "Meeting with John on March 15 at 2 PM", "Doctor appointment March 20 at 10 AM"
3. If you see NOTES, HANDWRITING, or TEXT → transcribe it faithfully, preserving the content
4. If you see a RECEIPT or INVOICE → extract key info: store, total, items
5. If you see a SCREENSHOT of a conversation/message → extract any tasks, dates, or important info mentioned
6. If you see a DOCUMENT or ARTICLE → summarize the key points
7. If you see a PHOTO of a place/object → describe what action might be needed
8. For MULTIPLE distinct items, list each one separately so they can become individual items
9. Respond in the SAME LANGUAGE as any text in the image, or English if no text is visible
10. Be thorough — extract ALL relevant details, dates, times, names, amounts. Up to 300 words.`
      },
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
        ]
      }
    ],
  });
  return response.choices[0]?.message?.content || "Could not describe the image.";
}

export async function parseFileContent(textContent: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_completion_tokens: 1024,
    temperature: 0.3,
    messages: [
      {
        role: "system",
        content: `You extract actionable information from uploaded file content to create tasks, reminders, events, or notes.

RULES:
1. Analyze the text and extract ALL actionable items: tasks, reminders, events, notes, lists
2. If it's a LIST → output as: "List: item1, item2, item3..."
3. If it contains DATES/TIMES/APPOINTMENTS → output each with full date/time info
4. If it's general NOTES or INFO → describe the content naturally as if the user is telling you about it
5. For MULTIPLE distinct items, describe each one separately
6. Respond in the SAME LANGUAGE as the file content
7. Be thorough — extract ALL relevant details. Up to 300 words.
8. Output as natural text, as if the user is speaking to you about what they need.`
      },
      { role: "user", content: textContent }
    ],
  });
  return response.choices[0]?.message?.content || "Could not process the file content.";
}

export async function generateEmojis(items: { id: number; title: string; type: string }[]): Promise<Record<number, string>> {
  if (items.length === 0) return {};
  const itemList = items.map(i => `${i.id}: "${i.title}" (${i.type})`).join("\n");
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.3,
    max_completion_tokens: 1024,
    messages: [
      {
        role: "system",
        content: `Given a list of task/event/note titles, return a JSON object mapping each ID to a single emoji that best represents the content. Examples: call→📞, gym→💪, food→🍽️, meeting→🤝, doctor→🏥, haircut→💇, water/drink→💧, shopping→🛒, email→📧, study→📚, medicine→💊, birthday→🎂, travel→✈️, cleaning→🧹, cooking→👨‍🍳, list→📋, notes→📝. Return ONLY valid JSON like {"1":"📞","2":"💪"}.`
      },
      { role: "user", content: itemList }
    ],
    response_format: { type: "json_object" },
  });
  const text = response.choices[0]?.message?.content;
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    const result: Record<number, string> = {};
    for (const [key, val] of Object.entries(parsed)) {
      if (typeof val === "string") result[Number(key)] = val;
    }
    return result;
  } catch {
    return {};
  }
}

export { openai };
