# Specification: AI Document Assistant Enhancements

## Goal
Improve the AI Document Editor by adding specialized writing modes tailored for writers and everyday users (e.g., Creative, Formal, Shorten, Expand).

## Technical Requirements
- Extend the `DOCUMENT_AI_ACTIONS` in `backend/app.py`.
- Update the frontend UI in `DocumentsPage.tsx` to include the new modes.
- Ensure the AI responses are consistently formatted as HTML for Tiptap integration.

## UI Requirements
- A selection menu or buttons in the Document editor interface to choose the assistant mode.
- Minimalist design following project guidelines.
