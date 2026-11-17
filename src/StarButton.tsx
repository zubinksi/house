/** A star beside a market's or an address's name: filled when it's kept in the sidebar. */
export function StarButton({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="star-btn"
      aria-pressed={on}
      aria-label={on ? `Unstar ${label}` : `Star ${label}`}
      title={on ? 'Starred: kept at the top of the list' : 'Star to keep it in the list'}
      onClick={onClick}
    >
      <svg viewBox="0 0 16 16" aria-hidden>
        <path d="M8 1.6l1.9 4 4.3.5-3.2 2.9.9 4.3L8 11.1l-3.9 2.2.9-4.3L1.8 6.1l4.3-.5z" />
      </svg>
    </button>
  );
}
