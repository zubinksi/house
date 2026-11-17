/**
 * On a phone, the menu icon beside a page's name: it opens the markets and
 * address lists full width over the page. Hidden where the sidebar shows.
 */
export function MenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="menu-btn" aria-label="Open the menu of markets and addresses" onClick={onClick}>
      {/* three lines of a list, of uneven length like the names in it */}
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="M4 7h16M4 12h11M4 17h14" />
      </svg>
    </button>
  );
}
