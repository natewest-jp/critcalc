<!-- Privacy chapter — see $lib/help/areas.ts. Every <h2> carries an id; the area
	 shell reads them for the sidebar's table of contents.

	 Rewritten 2026-10-16 for launch, with Cloudflare Web Analytics on (enabled
	 in the Pages dashboard 2026-10-15; auto-injected, no code in the repo).
	 ⚠️ Every claim here is checked against the code: the key list is
	 stores.ts + boards + rotationTabs + documentBar + visualizers/workspace +
	 storageDurability (the last-backup stamp, and the persist ask on save);
	 Backup is settingsBackup.ts BACKUP_KEYS; Clear data is ProfileForm's
	 clearData and Delete everything is storageSession.wipe. What Cloudflare collects is stated AS CLOUDFLARE STATES
	 IT (its Web Analytics FAQ) — we have not measured the beacon. Update
	 "Last updated" (LAST_UPDATED below) with any change.

	 The text is in messages/*.json (`privacy_*`). A paragraph is one message,
	 its bold words and links as markup, so a translation can move them; `p`
	 below says what each tag renders as. -->
<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import type { MessagePart } from '$lib/paraglide/runtime';
	import Msg from '$lib/components/Msg.svelte';
	import { hrefTo } from '$lib/i18n/paths';
	import { formatDay } from '$lib/i18n/dates';

	/** The day this page last changed. */
	const LAST_UPDATED = '2026-10-26';
</script>

{#snippet strong(t: string)}<strong>{t}</strong>{/snippet}
{#snippet settings(t: string)}<a href={hrefTo('/settings')}>{t}</a>{/snippet}
{#snippet out(href: string, t: string)}<a {href} target="_blank" rel="noopener noreferrer">{t}</a
	>{/snippet}
{#snippet google(t: string)}{@render out('https://policies.google.com/privacy', t)}{/snippet}
{#snippet cfaq(t: string)}{@render out(
		'https://developers.cloudflare.com/web-analytics/faq/',
		t
	)}{/snippet}
{#snippet p(parts: MessagePart[])}<Msg
		{parts}
		tags={{ strong, settings, google, cfaq }}
	/>{/snippet}

<h1>{m.privacy_privacy()}</h1>

<p class="lede">{m.privacy_critcalc_has_no_accounts_and_no_server()}</p>

<section>
	<h2 id="in-your-browser">{m.privacy_what_stays_in_your_browser()}</h2>
	<p>{m.privacy_everything_you_create_is_kept_in_this()}</p>
	<ul>
		<li>{m.privacy_your_settings_display_human_timing()}</li>
		<li>{m.privacy_your_profiles_each_with_its_name_picture()}</li>
		<li>{m.privacy_the_visualizers_layout()}</li>
		<li>{m.privacy_when_you_last_downloaded_a_backup_so()}</li>
		<li>{m.privacy_whether_critcalc_has_already_asked_your()}</li>
	</ul>
	<p>{@render p(m.privacy_critcalc_sets_no_cookies_a_backup_file.parts())}</p>
	<p>{m.privacy_browsers_can_clear_a_site_s_storage_on()}</p>
</section>

<section>
	<h2 id="what-leaves">{m.privacy_what_leaves_it()}</h2>

	<h3>{m.privacy_share_links_when_you_send_one()}</h3>
	<p>{m.privacy_a_share_link_carries_what_you_re_sharing()}</p>

	<h3>{m.privacy_reports_when_you_send_one()}</h3>
	<p>{@render p(m.privacy_the_feedback_form_is_a_google_form.parts())}</p>

	<h3>{m.privacy_visit_counts()}</h3>
	<p>{@render p(m.privacy_critcalc_uses_cloudflare_web_analytics.parts())}</p>

	<h3>{m.privacy_the_host()}</h3>
	<p>{m.privacy_critcalc_is_served_by_cloudflare_pages()}</p>
</section>

<section>
	<h2 id="not-here">{m.privacy_what_critcalc_doesn_t_have()}</h2>
	<p>{m.privacy_no_accounts_no_ads_no_third_party()}</p>
</section>

<section>
	<h2 id="changes">{m.privacy_changes()}</h2>
	<p>{m.privacy_if_any_of_this_changes_this_page_changes()}</p>
	<p>{m.privacy_last_updated_date({ date: formatDay(LAST_UPDATED, { dateStyle: 'long' }) })}</p>
</section>
