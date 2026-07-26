import { redirect } from '@sveltejs/kit';

// /faq predates the Help AREA (FAQ is now one chapter of four, and the area is
// named for what the "?" opens). Kept as a redirect so links that already
// exist — including the old per-tool anchors, /faq#rotation-planner — still
// land somewhere sensible: the hash is client-side only, so those arrive at
// /help and the sidebar takes it from there.
export function load() {
	redirect(308, '/help');
}
