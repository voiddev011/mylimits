# Roadmap

## Core tracking first

- Complete the install/build and extension browser checks.
- Verify Claude and Work/Codex against real signed-in account interfaces.
- Improve explicit workspace selection and visibility of quota scopes.
- Add verified Gemini, Grok, and Perplexity usage and reset fields.
- Expand to Cursor, Kimi, Mistral, and other sites that expose useful readings.
- Add bounded history charts, account exports, and opt-in profile snapshot imports.

## Account flexibility

Saved accounts already keep individual names, preferences, and dated readings.
Live accounts in isolated profiles require their own browser sessions. A later
aggregation feature must distinguish live sources from imported snapshots and
must not copy login cookies or silently upload credentials.

## Usage guidance

- A local token-efficiency guide: shorter context, reusable summaries,
  smaller attachments, explicit output length, and purposeful tool use.
- A task chooser for writing, coding, research, extraction, and complex reasoning.
- Model/mode recommendations based on the user's accuracy, speed, and usage
  priorities, with explanations and maintained provider capability metadata.
- Prompt templates and a checklist for improving clarity and avoiding unnecessary
  back-and-forth.
- Optional prompt analysis only after the user explicitly supplies text. The
  quota tracker will not silently inspect conversations to produce advice.

The first guide can be rules-based and local. Any future AI-powered assistance
will show where text is sent, what usage it consumes, and request explicit opt-in.
