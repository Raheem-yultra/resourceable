/**
 * Renders a schema.org payload into the page.
 *
 * A server component with no 'use client': the markup is for crawlers, which do
 * not run this site's JavaScript bundle before deciding what a page is about.
 * Emitting it server-side means it is in the HTML on first byte.
 *
 * `JSON.stringify` output is escaped rather than trusted. The payloads carry
 * provider-authored text — business names, descriptions, review bodies — and a
 * `</script>` inside any of them would close this tag early and drop the rest of
 * the object into the document as live markup. Escaping `<` covers that and the
 * `<!--` comment-open variant in one step.
 */
export function JsonLd({ data }: { data: object | object[] }) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');

  return (
    <script
      type="application/ld+json"
      // The content is serialized JSON we just built, not user-supplied HTML, and
      // the one character that could break out of the tag is escaped above.
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
